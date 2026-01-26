import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, prismaContext } from '@/lib/prisma'
import { requestId, startTimer, endTimer, logRequest, getQueryCount, resetRequest } from '@/lib/perf'

export async function GET(request: NextRequest) {
  const reqId = requestId()
  startTimer(reqId, 'total')
  
  return prismaContext.run(reqId, async () => {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    
    startTimer(reqId, 'query')
    // PERFORMANCE FIX: Add pagination and use select instead of include
    const runs = await (prisma as any).payrollRun?.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true,
        name: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            lines: true,
          },
        },
      },
    }) || []
    endTimer(reqId, 'query')

      const totalMs = endTimer(reqId, 'total') || 0
      const queryCount = getQueryCount(reqId)
      logRequest(reqId, '/api/payroll/runs', totalMs, queryCount)
      resetRequest(reqId)
      
      return NextResponse.json({ runs })
    } catch (error: any) {
      const totalMs = endTimer(reqId, 'total') || 0
      logRequest(reqId, '/api/payroll/runs', totalMs, getQueryCount(reqId))
      resetRequest(reqId)
      console.error('Error fetching payroll runs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payroll runs', details: error.message },
        { status: 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      periodStart,
      periodEnd,
      sourceImportId,
      selectedEmployeeIds,
      employeeRates,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Run name is required' },
        { status: 400 }
      )
    }

    if (!sourceImportId) {
      return NextResponse.json(
        { error: 'Source import is required' },
        { status: 400 }
      )
    }

    if (!selectedEmployeeIds || !Array.isArray(selectedEmployeeIds) || selectedEmployeeIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one employee must be selected' },
        { status: 400 }
      )
    }

    // Get import rows for the selected import and employees
    let importRows: any[] = []
    
    // First, get the import to determine date range
    const payrollImport = await (prisma as any).payrollImport?.findUnique({
      where: { id: sourceImportId },
      select: { periodStart: true, periodEnd: true },
    })
    
    if (!payrollImport) {
      return NextResponse.json(
        { error: 'Import not found' },
        { status: 404 }
      )
    }
    
    // Use import's period dates if available, otherwise use provided dates
    const periodStartDate = payrollImport.periodStart 
      ? new Date(payrollImport.periodStart)
      : (periodStart ? new Date(periodStart) : new Date())
    const periodEndDate = payrollImport.periodEnd
      ? new Date(payrollImport.periodEnd)
      : (periodEnd ? new Date(periodEnd) : new Date())
    
    periodStartDate.setHours(0, 0, 0, 0)
    periodEndDate.setHours(23, 59, 59, 999)
    
    // First, verify that employees exist and are linked to import rows
    const employeeCheck = await (prisma as any).payrollImportRow?.findMany({
      where: {
        importId: sourceImportId,
        linkedEmployeeId: { in: selectedEmployeeIds },
      },
      select: {
        linkedEmployeeId: true,
      },
      distinct: ['linkedEmployeeId'],
    })
    
    console.log(`[PAYROLL RUN] Employee check: Found ${employeeCheck.length} unique linked employees for import ${sourceImportId} with ${selectedEmployeeIds.length} selected employees`)
    
    if (employeeCheck.length === 0) {
      return NextResponse.json(
        { 
          error: 'No employees found in import.',
          details: `No import rows are linked to the selected ${selectedEmployeeIds.length} employee(s) in this import. Please go to the import edit page and link employees to the rows first.`
        },
        { status: 400 }
      )
    }
    
    // Now get import rows with valid clock-in/clock-out pairs (or at least minutesWorked)
    importRows = await (prisma as any).payrollImportRow?.findMany({
      where: {
        importId: sourceImportId,
        linkedEmployeeId: { in: selectedEmployeeIds },
        workDate: {
          gte: periodStartDate,
          lte: periodEndDate,
        },
        OR: [
          { minutesWorked: { not: null } },
          { inTime: { not: null }, outTime: { not: null } },
        ],
      },
      include: {
        linkedEmployee: true,
      },
    })
    console.log(`[PAYROLL RUN] Found ${importRows.length} linked import rows with valid time data for import ${sourceImportId} with ${selectedEmployeeIds.length} selected employees`)
    
    // Check if we have any linked rows with valid time data BEFORE creating the run
    if (importRows.length === 0) {
      return NextResponse.json(
        { 
          error: 'No valid time entries found for selected employees.',
          details: `No import rows with valid clock-in/clock-out pairs or minutes worked found for the selected ${selectedEmployeeIds.length} employee(s) in this import within the specified period. Please ensure employees are linked and have valid time entries.`
        },
        { status: 400 }
      )
    }

    // Create the payroll run (only if we have data)
    const payrollRun = await (prisma as any).payrollRun?.create({
      data: {
        name: name.trim(),
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        createdByUserId: session.user.id,
        status: 'DRAFT',
        sourceImportId: sourceImportId,
      },
    })

    // Aggregate by employee
    const employeeTotals = new Map<string, {
      employeeId: string
      employee: any
      totalMinutes: number
      hourlyRate: number
    }>()

    console.log(`[PAYROLL RUN] Processing ${importRows.length} import rows`)
    let unlinkedCount = 0
    let linkedCount = 0

    for (const row of importRows) {
      if (!row.linkedEmployeeId || !row.linkedEmployee) {
        unlinkedCount++
        console.log(`[PAYROLL RUN] Skipping row ${row.id} - no linked employee (employeeName: ${row.employeeNameRaw}, employeeExternalId: ${row.employeeExternalIdRaw})`)
        continue
      }

      linkedCount++
      const employeeId = row.linkedEmployeeId
      // Use minutesWorked directly - if not available, calculate from inTime/outTime
      let minutesWorked = row.minutesWorked || 0
      
      // If minutesWorked is null but we have inTime and outTime, calculate it
      if (!minutesWorked && row.inTime && row.outTime) {
        const inTime = new Date(row.inTime)
        const outTime = new Date(row.outTime)
        // Handle overnight shifts
        let adjustedOutTime = new Date(outTime)
        if (adjustedOutTime < inTime) {
          adjustedOutTime.setDate(adjustedOutTime.getDate() + 1)
        }
        const diffMs = adjustedOutTime.getTime() - inTime.getTime()
        if (diffMs > 0) {
          minutesWorked = Math.floor(diffMs / (1000 * 60))
        }
      }

      if (!employeeTotals.has(employeeId)) {
        // Get hourly rate from employeeRates override or employee default
        const hourlyRate = employeeRates?.[employeeId] 
          ? parseFloat(employeeRates[employeeId])
          : parseFloat(row.linkedEmployee.defaultHourlyRate.toString())

        console.log(`[PAYROLL RUN] Adding employee ${row.linkedEmployee.fullName} (${employeeId}) with rate $${hourlyRate}`)

        employeeTotals.set(employeeId, {
          employeeId,
          employee: row.linkedEmployee,
          totalMinutes: 0,
          hourlyRate,
        })
      }

      const totals = employeeTotals.get(employeeId)!
      totals.totalMinutes += minutesWorked
      
      console.log(`[PAYROLL RUN] Row ${row.id}: employee=${row.linkedEmployee.fullName}, minutes=${minutesWorked}, newTotalMinutes=${totals.totalMinutes}`)
    }

    console.log(`[PAYROLL RUN] Summary: ${linkedCount} linked rows, ${unlinkedCount} unlinked rows, ${employeeTotals.size} employees with totals`)

    if (employeeTotals.size === 0) {
      return NextResponse.json(
        { 
          error: 'No employees found in import rows. Please link employees to import rows first.',
          details: `Found ${importRows.length} import rows, but ${unlinkedCount} are not linked to employees. Please go to the import edit page and link employees to the rows.`
        },
        { status: 400 }
      )
    }

    // Create PayrollRunLine records
    const runLines = Array.from(employeeTotals.values()).map(totals => {
      // Calculate hours and minutes as integers
      const hours = Math.floor(totals.totalMinutes / 60)
      const minutes = totals.totalMinutes % 60
      
      // Calculate gross pay: (hours * hourlyRate) + (minutes / 60 * hourlyRate)
      const grossPay = parseFloat(((hours * totals.hourlyRate) + (minutes / 60 * totals.hourlyRate)).toFixed(2))
      
      // Store totalHours as decimal for backward compatibility, but we'll display hours/minutes separately
      const totalHoursDecimal = parseFloat((totals.totalMinutes / 60).toFixed(2))
      
      console.log(`[PAYROLL RUN] Creating line for ${totals.employee.fullName}: totalMinutes=${totals.totalMinutes}, hours=${hours}, minutes=${minutes}, rate=$${totals.hourlyRate}, gross=$${grossPay}`)
      
      return {
        runId: payrollRun.id,
        employeeId: totals.employeeId,
        hourlyRateUsed: totals.hourlyRate,
        totalMinutes: totals.totalMinutes,
        totalHours: totalHoursDecimal, // Keep for backward compatibility
        grossPay: grossPay,
        amountPaid: 0,
        amountOwed: grossPay,
        notes: null,
      }
    })

    console.log(`[PAYROLL RUN] Creating ${runLines.length} payroll run lines...`)
    await (prisma as any).payrollRunLine?.createMany({
      data: runLines,
    })
    console.log(`[PAYROLL RUN] Successfully created ${runLines.length} payroll run lines`)

    // Fetch the created run with lines
    const createdRun = await (prisma as any).payrollRun?.findUnique({
      where: { id: payrollRun.id },
      include: {
        lines: {
          include: {
            employee: true,
          },
        },
      },
    })

    return NextResponse.json({ run: createdRun })
  } catch (error: any) {
    console.error('Error creating payroll run:', error)
    return NextResponse.json(
      { error: 'Failed to create payroll run', details: error.message },
      { status: 500 }
    )
  }
}
