import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { calculateEntryTotals } from '@/lib/billing'

/**
 * POST /api/invoices/fix-all
 * Admin-only endpoint to recalculate all existing invoices using ceil() rounding
 * 
 * Query params:
 *   - dryRun=true: Preview changes without applying
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin only
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'

    console.log(`[INVOICE FIX] Starting ${dryRun ? 'DRY RUN' : 'FIX'} for all invoices`)

    const invoices = await (prisma as any).invoice.findMany({
      where: { deletedAt: null },
      include: {
        entries: {
          include: {
            timesheet: {
              include: {
                entries: true,
              },
            },
          },
        },
        client: {
          include: {
            insurance: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const results: Array<{
      invoiceNumber: string
      fixed: boolean
      oldTotal: number
      newTotal: number
      oldUnits: number
      newUnits: number
      entriesUpdated: number
      error?: string
    }> = []

    let fixedCount = 0
    let skippedCount = 0

    for (const invoice of invoices) {
      try {
        const insurance = invoice.client?.insurance
        if (!insurance) {
          results.push({
            invoiceNumber: invoice.invoiceNumber,
            fixed: false,
            oldTotal: invoice.totalAmount.toNumber(),
            newTotal: invoice.totalAmount.toNumber(),
            oldUnits: 0,
            newUnits: 0,
            entriesUpdated: 0,
            error: 'No insurance',
          })
          skippedCount++
          continue
        }

        const ratePerUnit = (insurance as any).regularRatePerUnit 
          ? new Decimal((insurance as any).regularRatePerUnit.toString())
          : new Decimal(insurance.ratePerUnit.toString())
        const unitMinutes = (insurance as any).regularUnitMinutes || 15

        if (ratePerUnit.toNumber() <= 0) {
          results.push({
            invoiceNumber: invoice.invoiceNumber,
            fixed: false,
            oldTotal: invoice.totalAmount.toNumber(),
            newTotal: invoice.totalAmount.toNumber(),
            oldUnits: 0,
            newUnits: 0,
            entriesUpdated: 0,
            error: 'Invalid rate',
          })
          skippedCount++
          continue
        }

        // Recalculate all entries
        let totalRecalculatedAmount = new Decimal(0)
        let totalRecalculatedUnits = 0
        const entryUpdates: Array<{
          id: string
          newUnits: number
          newAmount: Decimal
        }> = []

        for (const entry of invoice.entries) {
          const timesheet = entry.timesheet
          let entryMinutes: number = 0

          // InvoiceEntry represents ALL entries from a Timesheet
          // Sum all timesheet entry minutes for this timesheet
          if (timesheet?.entries && timesheet.entries.length > 0) {
            entryMinutes = timesheet.entries.reduce((sum: number, e: any) => {
              // Only count entries that fall within the invoice date range
              const entryDate = new Date(e.date)
              if (entryDate >= invoice.startDate && entryDate <= invoice.endDate) {
                return sum + (e.minutes || 0)
              }
              return sum
            }, 0)
          }

          // Fallback: estimate from stored units if no timesheet entries found
          if (entryMinutes === 0) {
            entryMinutes = Math.round(entry.units.toNumber() * unitMinutes)
          }

          const { unitsBilled, amount } = calculateEntryTotals(entryMinutes, ratePerUnit, unitMinutes)

          entryUpdates.push({
            id: entry.id,
            newUnits: unitsBilled,
            newAmount: amount,
          })

          totalRecalculatedAmount = totalRecalculatedAmount.plus(amount)
          totalRecalculatedUnits += unitsBilled
        }

        const oldTotal = invoice.totalAmount.toNumber()
        const newTotal = totalRecalculatedAmount.toNumber()
        const oldUnits = invoice.entries.reduce((sum: number, e: any) => sum + e.units.toNumber(), 0)
        const hasChanges = entryUpdates.some(e => {
          const oldEntry = invoice.entries.find((ent: any) => ent.id === e.id)
          return oldEntry && (
            Math.abs(oldEntry.units.toNumber() - e.newUnits) > 0.001 ||
            Math.abs(oldEntry.amount.toNumber() - e.newAmount.toNumber()) > 0.01
          )
        }) || Math.abs(oldTotal - newTotal) > 0.01

        if (!hasChanges) {
          results.push({
            invoiceNumber: invoice.invoiceNumber,
            fixed: false,
            oldTotal,
            newTotal,
            oldUnits,
            newUnits: totalRecalculatedUnits,
            entriesUpdated: 0,
          })
          skippedCount++
          continue
        }

        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            for (const update of entryUpdates) {
              await (tx as any).invoiceEntry.update({
                where: { id: update.id },
                data: {
                  units: new Decimal(update.newUnits),
                  amount: update.newAmount,
                },
              })
            }

            const newOutstanding = totalRecalculatedAmount
              .minus(invoice.paidAmount || 0)
              .plus(invoice.adjustments || 0)

            await (tx as any).invoice.update({
              where: { id: invoice.id },
              data: {
                totalAmount: totalRecalculatedAmount,
                outstanding: newOutstanding,
              },
            })
          })
        }

        results.push({
          invoiceNumber: invoice.invoiceNumber,
          fixed: true,
          oldTotal,
          newTotal,
          oldUnits,
          newUnits: totalRecalculatedUnits,
          entriesUpdated: entryUpdates.length,
        })

        fixedCount++
      } catch (error: any) {
        results.push({
          invoiceNumber: invoice.invoiceNumber,
          fixed: false,
          oldTotal: invoice.totalAmount.toNumber(),
          newTotal: invoice.totalAmount.toNumber(),
          oldUnits: 0,
          newUnits: 0,
          entriesUpdated: 0,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        total: invoices.length,
        fixed: fixedCount,
        skipped: skippedCount,
        errors: results.filter(r => r.error).length,
      },
      results: results.slice(0, 100), // Limit to first 100 for response size
      message: dryRun 
        ? `Dry run complete: Would fix ${fixedCount} invoices, ${skippedCount} already correct`
        : `Fixed ${fixedCount} invoices, ${skippedCount} already correct`,
    })
  } catch (error: any) {
    console.error('[INVOICE FIX] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fix invoices', details: error?.message },
      { status: 500 }
    )
  }
}
