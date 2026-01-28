import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { logCreate } from '@/lib/audit'
import { getWeekStart, getWeekEnd, getWeekKey } from '@/lib/weekUtils'
import { utcToZonedTime, format } from 'date-fns-tz'
import { minutesToUnits, calculateEntryTotals, calculateInvoiceTotals } from '@/lib/billing'

/**
 * POST /api/timesheets/batch/generate-invoice
 * Generate invoices from selected regular timesheets (from archive)
 * Groups by client + calendar week (Monday-Sunday)
 * Uses regular Insurance rates
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[BATCH INVOICE GEN] Request received')
    
    let session
    try {
      session = await getServerSession(authOptions)
    } catch (sessionError: any) {
      console.error('[BATCH INVOICE GEN] Session error:', sessionError)
      return NextResponse.json({ error: 'Session error', details: sessionError?.message }, { status: 500 })
    }
    
    if (!session) {
      console.log('[BATCH INVOICE GEN] No session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[BATCH INVOICE GEN] Session valid, user:', session.user.id)

    // Check permissions: user needs to view timesheets AND create invoices
    let permissions
    try {
      const { getUserPermissions } = await import('@/lib/permissions')
      permissions = await getUserPermissions(session.user.id)
    } catch (permError: any) {
      console.error('[BATCH INVOICE GEN] Permissions error:', permError)
      return NextResponse.json({ error: 'Permissions check failed', details: permError?.message }, { status: 500 })
    }
    
    const canViewTimesheets = permissions['timesheets.view']?.canView === true ||
                              session.user.role === 'ADMIN' ||
                              session.user.role === 'SUPER_ADMIN'
    const canCreateInvoice = permissions['invoices.create']?.canCreate === true ||
                             session.user.role === 'ADMIN' ||
                             session.user.role === 'SUPER_ADMIN'

    if (!canViewTimesheets || !canCreateInvoice) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    let data
    try {
      data = await request.json()
    } catch (jsonError: any) {
      console.error('[BATCH INVOICE GEN] JSON parse error:', jsonError)
      return NextResponse.json({ error: 'Invalid JSON in request', details: jsonError?.message }, { status: 400 })
    }
    
    const { timesheetIds } = data
    console.log('[BATCH INVOICE GEN] Timesheet IDs:', timesheetIds)

    if (!timesheetIds || !Array.isArray(timesheetIds) || timesheetIds.length === 0) {
      console.log('[BATCH INVOICE GEN] No timesheets selected')
      return NextResponse.json(
        { error: 'No timesheets selected' },
        { status: 400 }
      )
    }

    // Fetch selected timesheets with all necessary data (regular timesheets only)
    const timesheets = await prisma.timesheet.findMany({
      where: {
        id: { in: timesheetIds },
        deletedAt: null,
        isBCBA: false, // Only regular timesheets
        status: {
          in: ['APPROVED', 'EMAILED'],
        },
      },
      include: {
        entries: {},
        client: {
          include: {
            insurance: true,
          },
        },
        provider: true,
        insurance: true,
      },
    })

    if (timesheets.length === 0) {
      return NextResponse.json(
        { error: 'No eligible timesheets found. Timesheets must be APPROVED or EMAILED, not deleted, and not BCBA.' },
        { status: 400 }
      )
    }

    // Group timesheets by client + week (Monday-Sunday)
    const grouped = new Map<string, typeof timesheets>()
    
    for (const timesheet of timesheets) {
      const nonInvoicedEntries = timesheet.entries.filter(e => !e.invoiced)
      if (nonInvoicedEntries.length === 0) {
        continue
      }
      
      const weekKey = `${timesheet.clientId}-${getWeekKey(timesheet.startDate)}`
      
      if (!grouped.has(weekKey)) {
        grouped.set(weekKey, [])
      }
      grouped.get(weekKey)!.push(timesheet)
    }

    const createdInvoices: string[] = []
    const errors: string[] = []
    const skipped: string[] = []

    let invoiceCounter = await (prisma as any).invoice.count()

    // Process each client + week group
    for (const [weekKey, weekTimesheets] of grouped.entries()) {
      if (weekTimesheets.length === 0) continue

      const client = weekTimesheets[0].client
      const clientId = weekTimesheets[0].clientId

      // Get insurance from timesheet's insuranceId (for regular timesheets)
      // Use the insurance specified on the timesheet, not just client's default
      const timesheetInsuranceId = weekTimesheets[0].insuranceId
      let insurance = client.insurance // Fallback to client's insurance
      
      if (timesheetInsuranceId) {
        // Fetch the insurance from the timesheet's insuranceId
        const timesheetInsurance = await prisma.insurance.findUnique({
          where: { id: timesheetInsuranceId, deletedAt: null },
        })
        if (timesheetInsurance) {
          insurance = timesheetInsurance
        }
      }
      
      if (!insurance) {
        const errorMsg = `MISSING_INSURANCE_RATE: Client "${client.name}" has no insurance assigned`
        console.error(`[BATCH INVOICE GEN] ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }

      // Use regular-specific rates, with fallbacks
      const ratePerUnit = (insurance as any).regularRatePerUnit 
        ? new Decimal((insurance as any).regularRatePerUnit.toString())
        : new Decimal(insurance.ratePerUnit.toString()) // Legacy fallback
      const unitMinutes = (insurance as any).regularUnitMinutes || 15 // Default to 15 minutes

      // Validate rate exists
      if (!ratePerUnit || ratePerUnit.toNumber() <= 0) {
        const errorMsg = `MISSING_INSURANCE_RATE: Client "${client.name}" has invalid or missing rate per unit`
        console.error(`[BATCH INVOICE GEN] ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }

      const weekStart = getWeekStart(weekTimesheets[0].startDate)
      const weekEnd = getWeekEnd(weekTimesheets[0].startDate)

      // Check for existing invoice
      const existingInvoice = await (prisma as any).invoice.findFirst({
        where: {
          clientId,
          deletedAt: null,
          startDate: { lte: weekEnd },
          endDate: { gte: weekStart },
        },
      })

      if (existingInvoice) {
        const weekStartStr = format(utcToZonedTime(weekStart, 'America/New_York'), 'MMM d, yyyy')
        const weekEndStr = format(utcToZonedTime(weekEnd, 'America/New_York'), 'MMM d, yyyy')
        skipped.push(`Client "${client.name}" - Week ${weekStartStr} to ${weekEndStr} (Invoice ${existingInvoice.invoiceNumber} already exists)`)
        continue
      }

      // Collect all non-invoiced entries
      const allEntries = weekTimesheets.flatMap(ts => ts.entries.filter(e => !e.invoiced))

      if (allEntries.length === 0) {
        errors.push(`No eligible entries found for client "${client.name}" in this week`)
        continue
      }

      // Calculate totals using billing utility (rounds UP to next whole unit)
      const { totalMinutes, unitsBilled, amount: totalAmount } = calculateInvoiceTotals(
        allEntries,
        ratePerUnit,
        unitMinutes
      )

      invoiceCounter++
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(4, '0')}`

      console.log(`[BATCH INVOICE GEN] Creating invoice ${invoiceNumber} for client "${client.name}"`)
      console.log(`[BATCH INVOICE GEN] Calculation breakdown:`)
      console.log(`  - Total minutes: ${totalMinutes}`)
      console.log(`  - Units billed (ceil): ${unitsBilled}`)
      console.log(`  - Rate per unit: $${ratePerUnit.toNumber()}`)
      console.log(`  - Total amount: $${totalAmount.toNumber()}`)
      console.log(`  - Date range: ${format(utcToZonedTime(weekStart, 'America/New_York'), 'MMM d, yyyy')} to ${format(utcToZonedTime(weekEnd, 'America/New_York'), 'MMM d, yyyy')}`)
      console.log(`  - Entries included: ${allEntries.length}`)

      // Create invoice entries (calculate per entry, then sum)
      // CRITICAL: For regular timesheets, exclude SV (Supervision) entries from total amount
      // SV entries should be displayed but charged at $0 to prevent double charging
      const invoiceEntries: any[] = []
      let entryTotalUnits = 0
      let entryTotalAmount = new Decimal(0)
      
      // Check if this is a BCBA timesheet (use BCBA rates if so)
      const isBCBATimesheet = weekTimesheets.some(ts => ts.isBCBA === true)
      const rateToUse = isBCBATimesheet 
        ? ((insurance as any).bcbaRatePerUnit 
            ? new Decimal((insurance as any).bcbaRatePerUnit.toString())
            : ratePerUnit) // Fallback to regular rate if BCBA rate not set
        : ratePerUnit
      
      for (const entry of allEntries) {
        const timesheet = weekTimesheets.find(ts => ts.entries.some(e => e.id === entry.id))
        if (!timesheet) continue
        
        // Calculate units for this entry (Hours × 4)
        const { unitsBilled: entryUnits } = calculateEntryTotals(
          entry.minutes,
          rateToUse,
          unitMinutes
        )
        
        // For regular timesheets: SV entries are displayed but charged at $0
        // For BCBA timesheets: All entries (including SV) are charged normally
        const isSVEntry = entry.notes === 'SV'
        const isRegularTimesheet = !timesheet.isBCBA
        const entryAmount = (isSVEntry && isRegularTimesheet) 
          ? new Decimal(0) // SV entries on regular timesheets = $0
          : new Decimal(entryUnits).times(rateToUse) // Normal calculation
        
        entryTotalUnits += entryUnits
        entryTotalAmount = entryTotalAmount.plus(entryAmount)
        
        invoiceEntries.push({
          timesheetId: entry.timesheetId,
          providerId: timesheet.providerId,
          insuranceId: client.insuranceId!,
          units: new Decimal(entryUnits),
          rate: rateToUse.toNumber(),
          amount: entryAmount,
        })
      }
      
      console.log(`[BATCH INVOICE GEN] Entry-level totals: ${entryTotalUnits} units, $${entryTotalAmount.toNumber()}`)

      // Create invoice in transaction
      try {
        const invoice = await prisma.$transaction(async (tx) => {
          const newInvoice = await (tx as any).invoice.create({
            data: {
              invoiceNumber,
              clientId,
              startDate: weekStart,
              endDate: weekEnd,
              totalAmount: entryTotalAmount, // Use sum of entry amounts (may differ slightly from aggregate due to per-entry rounding)
              paidAmount: new Decimal(0),
              adjustments: new Decimal(0),
              outstanding: entryTotalAmount,
              status: 'DRAFT',
              createdBy: session.user.id,
              entries: {
                create: invoiceEntries,
              },
            },
          })
          
          console.log(`[BATCH INVOICE GEN] ✅ Invoice ${newInvoice.invoiceNumber} created with ID ${newInvoice.id}`)
          console.log(`[BATCH INVOICE GEN] Final totals: ${entryTotalUnits} units, $${entryTotalAmount.toNumber()}`)

          // Mark entries as invoiced
          const entryIds = allEntries.map(e => e.id)
          if (entryIds.length > 0) {
            await tx.timesheetEntry.updateMany({
              where: {
                id: { in: entryIds },
                invoiced: false,
              },
              data: {
                invoiced: true,
              },
            })
          }

          // Mark timesheets as invoiced
          const timesheetIds = weekTimesheets.map(ts => ts.id)
          if (timesheetIds.length > 0) {
            await tx.$executeRawUnsafe(`
              UPDATE "Timesheet"
              SET "invoiceId" = $1, "invoicedAt" = $2
              WHERE id = ANY($3::text[])
                AND "deletedAt" IS NULL
                AND ("invoiceId" IS NULL OR "invoiceId" = '')
            `, newInvoice.id, new Date(), timesheetIds)
          }

          await logCreate('Invoice', newInvoice.id, session.user.id, {
            invoiceNumber: newInvoice.invoiceNumber,
            clientId: newInvoice.clientId,
            totalAmount: newInvoice.totalAmount.toString(),
            timesheetCount: weekTimesheets.length,
          })

          return newInvoice
        })

        createdInvoices.push(invoice.invoiceNumber)
      } catch (error: any) {
        errors.push(`Failed to create invoice for client "${client.name}": ${error.message}`)
      }
    }

    let message = ''
    if (createdInvoices.length > 0) {
      message = `Successfully generated ${createdInvoices.length} invoice(s): ${createdInvoices.join(', ')}`
    }
    if (skipped.length > 0) {
      message += (message ? '. ' : '') + `Skipped ${skipped.length} group(s)`
    }
    if (errors.length > 0) {
      message += (message ? '. ' : '') + `Errors: ${errors.join('; ')}`
    }

    if (createdInvoices.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: message || 'Failed to generate invoices', errors, skipped },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: message || 'Invoices generated successfully',
      invoicesCreated: createdInvoices.length,
      invoices: createdInvoices,
      skipped: skipped.length > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[BATCH INVOICE GEN] Unhandled error:', error)
    console.error('[BATCH INVOICE GEN] Error stack:', error?.stack)
    console.error('[BATCH INVOICE GEN] Error message:', error?.message)
    return NextResponse.json(
      { error: 'Failed to generate invoices', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
