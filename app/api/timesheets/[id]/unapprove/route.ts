import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Decimal } from '@prisma/client/runtime/library'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUpdate } from '@/lib/audit'
import { getUserPermissions } from '@/lib/permissions'

// Invoices that can still be changed. Once an invoice is SENT or has any money
// against it, pulling a timesheet off it would rewrite a bill someone already has.
const EDITABLE_INVOICE_STATUSES = ['DRAFT', 'READY']

/**
 * UNAPPROVE TIMESHEET — returns an APPROVED or EMAILED timesheet to DRAFT so it
 * can be corrected and approved again.
 *
 * Flow:
 * 1. Check permissions
 * 2. Status must be APPROVED or EMAILED
 * 3. Every invoice holding this timesheet's lines must still be editable
 *    (DRAFT/READY, nothing paid) — otherwise refuse and name the invoice
 * 4. In one transaction:
 *    - remove this timesheet's InvoiceEntry rows and recompute each invoice's
 *      total/outstanding; soft-delete an invoice that is left with no lines
 *    - reset the timesheet's entries to invoiced=false so they are billed again
 *    - timesheet → DRAFT, clear approval/queue/email/invoice stamps
 *    - drop any pending email-queue items for it
 * 5. Audit log (non-blocking)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let session: any = null
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid timesheet ID' },
        { status: 400 }
      )
    }

    session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { ok: false, code: 'PERMISSION_DENIED', message: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: resolvedParams.id },
      include: {
        invoiceEntries: {
          include: {
            invoice: {
              include: { payments: { where: { deletedAt: null }, select: { id: true } } },
            },
          },
        },
        invoice: true,
      },
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Timesheet not found' },
        { status: 404 }
      )
    }

    const userPermissions = await getUserPermissions(session.user.id)
    const isBCBA = timesheet.isBCBA
    const permissionKey = isBCBA ? 'bcbaTimesheets.unapprove' : 'timesheets.unapprove'
    const permission = userPermissions[permissionKey]

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const hasPermission = isAdmin || (permission?.canApprove === true)

    if (!hasPermission) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: 'Permission denied - Insufficient permissions to unapprove timesheets',
        },
        { status: 403 }
      )
    }

    if (timesheet.status !== 'APPROVED' && timesheet.status !== 'EMAILED') {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: `Only approved or emailed timesheets can be unapproved. Current status: ${timesheet.status}`,
        },
        { status: 400 }
      )
    }

    // Collect every live invoice this timesheet is on: via its line items, and
    // via the timesheet.invoiceId link (which may exist without line items).
    const invoices = new Map<string, { id: string; invoiceNumber: string; status: string; paidAmount: any; hasPayments: boolean }>()
    for (const entry of timesheet.invoiceEntries) {
      const inv = entry.invoice
      if (inv && !inv.deletedAt) {
        invoices.set(inv.id, {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          paidAmount: inv.paidAmount,
          hasPayments: inv.payments.length > 0,
        })
      }
    }
    if (timesheet.invoice && !timesheet.invoice.deletedAt && !invoices.has(timesheet.invoice.id)) {
      const payments = await prisma.payment.count({
        where: { invoiceId: timesheet.invoice.id, deletedAt: null },
      })
      invoices.set(timesheet.invoice.id, {
        id: timesheet.invoice.id,
        invoiceNumber: timesheet.invoice.invoiceNumber,
        status: timesheet.invoice.status,
        paidAmount: timesheet.invoice.paidAmount,
        hasPayments: payments > 0,
      })
    }

    const locked = Array.from(invoices.values()).filter(
      (inv) =>
        !EDITABLE_INVOICE_STATUSES.includes(inv.status) ||
        new Decimal(inv.paidAmount.toString()).gt(0) ||
        inv.hasPayments
    )
    if (locked.length > 0) {
      const list = locked
        .map((inv) => `${inv.invoiceNumber} (${inv.status}${inv.hasPayments ? ', has payments' : ''})`)
        .join(', ')
      return NextResponse.json(
        {
          ok: false,
          code: 'INVOICE_LOCKED',
          message: `This timesheet is on invoice ${list}, which has already been sent or paid, so it cannot be unapproved. Use an invoice adjustment instead.`,
        },
        { status: 400 }
      )
    }

    const timesheetId = resolvedParams.id
    const userId = session.user.id
    const touchedInvoices: { invoiceNumber: string; newTotal: string; deleted: boolean }[] = []

    const result = await prisma.$transaction(async (tx) => {
      for (const inv of Array.from(invoices.values())) {
        await tx.invoiceEntry.deleteMany({
          where: { invoiceId: inv.id, timesheetId },
        })

        const remaining = await tx.invoiceEntry.findMany({
          where: { invoiceId: inv.id },
          select: { amount: true },
        })
        const current = await tx.invoice.findUniqueOrThrow({
          where: { id: inv.id },
          select: { adjustments: true, paidAmount: true },
        })
        const newTotal = remaining.reduce(
          (sum, e) => sum.plus(new Decimal(e.amount.toString())),
          new Decimal(0)
        )
        const outstanding = newTotal
          .plus(new Decimal(current.adjustments.toString()))
          .minus(new Decimal(current.paidAmount.toString()))

        // An invoice with no lines left has nothing to bill: soft-delete it so it
        // does not sit in the list as a $0 draft. Other timesheets still linked
        // to it by invoiceId alone are unlinked so the next run can bill them.
        const deleteInvoice = remaining.length === 0
        if (deleteInvoice) {
          await tx.timesheet.updateMany({
            where: { invoiceId: inv.id, id: { not: timesheetId } },
            data: { invoiceId: null, invoicedAt: null },
          })
        }

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            totalAmount: newTotal,
            outstanding,
            ...(deleteInvoice ? { deletedAt: new Date() } : {}),
          },
        })

        touchedInvoices.push({
          invoiceNumber: inv.invoiceNumber,
          newTotal: newTotal.toFixed(2),
          deleted: deleteInvoice,
        })
      }

      // Entries go back to un-invoiced so the corrected timesheet is billed on
      // the next invoice run after it is re-approved.
      await tx.timesheetEntry.updateMany({
        where: { timesheetId },
        data: { invoiced: false },
      })

      const updatedTimesheet = await tx.timesheet.update({
        where: { id: timesheetId },
        data: {
          status: 'DRAFT',
          approvedAt: null,
          queuedAt: null,
          emailedAt: null,
          invoicedAt: null,
          invoiceId: null,
          rejectedAt: null,
          rejectionReason: null,
          lastEditedBy: userId,
          lastEditedAt: new Date(),
        },
      })

      await tx.emailQueueItem.deleteMany({
        where: {
          entityType: isBCBA ? 'BCBA' : 'REGULAR',
          entityId: timesheetId,
          status: { in: ['QUEUED', 'FAILED'] },
        },
      })

      return updatedTimesheet
    })

    try {
      await logUpdate(
        isBCBA ? 'BCBATimesheet' : 'Timesheet',
        timesheetId,
        userId,
        {
          status: timesheet.status,
          approvedAt: timesheet.approvedAt,
          emailedAt: timesheet.emailedAt,
          invoiceId: timesheet.invoiceId,
        },
        {
          status: 'DRAFT',
          approvedAt: null,
          emailedAt: null,
          invoiceId: null,
          removedFromInvoices: touchedInvoices,
        }
      )
    } catch (auditError) {
      console.error('Failed to create audit log (non-blocking):', auditError)
    }

    return NextResponse.json({ ...result, removedFromInvoices: touchedInvoices }, { status: 200 })
  } catch (error) {
    console.error('Error unapproving timesheet:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to unapprove timesheet' },
      { status: 500 }
    )
  }
}
