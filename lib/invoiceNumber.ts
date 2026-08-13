import { PrismaClient } from '@prisma/client'

// Minimum starting sequence — first new invoice will be 202604-0215
const MIN_SEQUENCE = 214

/**
 * Returns the next invoice number in the format YYYYMM-XXXX.
 * Reads the highest existing sequence number from the DB so numbers
 * never go backwards, and always start at MIN_SEQUENCE + 1.
 *
 * Pass `offset` (0-based) when generating multiple invoices in a single
 * batch call — e.g. offset=0 for the 1st, offset=1 for the 2nd, etc.
 */
export async function nextInvoiceNumber(
  prisma: PrismaClient | ReturnType<PrismaClient['$extends']>,
  offset = 0
): Promise<string> {
  const now = new Date()
  const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  // Find the highest sequential number already stored
  const latest = await (prisma as PrismaClient).invoice.findFirst({
    select: { invoiceNumber: true },
    orderBy: { createdAt: 'desc' },
  })

  let maxSeq = MIN_SEQUENCE
  if (latest?.invoiceNumber) {
    // Works for both old "INV-2026-00123" and new "202604-0215" formats
    const match = latest.invoiceNumber.match(/(\d+)$/)
    if (match) {
      const parsed = parseInt(match[1], 10)
      if (parsed > maxSeq) maxSeq = parsed
    }
  }

  const seq = maxSeq + 1 + offset
  return `${prefix}-${String(seq).padStart(4, '0')}`
}
