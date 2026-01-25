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
    
    importRows = await (prisma as any).payrollImportRow?.findMany({
      where: {
        importId: sourceImportId,
        linkedEmployeeId: { in: selectedEmployeeIds },
        workDate: {
          gte: periodStartDate,
          lte: periodEndDate,
        },
      },
      include: {
        linkedEmployee: true,
      },
    })
    console.log(`[PAYROLL RUN] Found ${importRows.length} linked import rows for import ${sourceImportId} with ${selectedEmployeeIds.length} selected employees`)
    
    // Check if we have any linked rows BEFORE creating the run
    if (importRows.length === 0) {
      return NextResponse.json(
        { 
          error: 'No import rows found for selected employees.',
          details: `No import rows found for the selected ${selectedEmployeeIds.length} employee(s) in this import. Please ensure employees are linked to import rows.`
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
      totalHours: number
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
      const minutesWorked = row.minutesWorked || 0
      const hoursWorked = row.hoursWorked ? parseFloat(row.hoursWorked.toString()) : 0

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
          totalHours: 0,
          hourlyRate,
        })
      }

      const totals = employeeTotals.get(employeeId)!
      totals.totalMinutes += minutesWorked || 0
      // Calculate hours: prefer hoursWorked, fallback to minutes/60, ensure it's a number
      const calculatedHours = hoursWorked > 0 ? hoursWorked : (minutesWorked > 0 ? minutesWorked / 60 : 0)
      totals.totalHours += calculatedHours
      
      console.log(`[PAYROLL RUN] Row ${row.id}: employee=${row.linkedEmployee.fullName}, minutes=${minutesWorked}, hours=${hoursWorked}, calculatedHours=${calculatedHours}, newTotal=${totals.totalHours.toFixed(2)}`)
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
      const totalHoursRounded = parseFloat(totals.totalHours.toFixed(2))
      const grossPay = parseFloat((totals.totalHours * totals.hourlyRate).toFixed(2))
      
      console.log(`[PAYROLL RUN] Creating line for ${totals.employee.fullName}: minutes=${totals.totalMinutes}, hours=${totalHoursRounded}, rate=$${totals.hourlyRate}, gross=$${grossPay}`)
      
      return {
        runId: payrollRun.id,
        employeeId: totals.employeeId,
        hourlyRateUsed: totals.hourlyRate,
        totalMinutes: totals.totalMinutes,
        totalHours: totalHoursRounded,
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
