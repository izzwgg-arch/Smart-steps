import { prisma } from '@/lib/prisma'
import { renderInvoicePdf, BRANDING_PRESETS, InvoiceForPDF } from './invoiceTemplate'

/**
 * Generate Regular Invoice PDF from invoiceId
 * Uses shared invoice template with Smart Steps ABA branding
 */
export async function generateRegularInvoicePdf(invoiceId: string): Promise<Buffer> {
  const startTime = Date.now()
  const correlationId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  console.error(`[REGULAR_INVOICE_PDF] ${correlationId} Starting PDF generation for invoiceId: ${invoiceId}`)
  
  try {
    // Fetch invoice with related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, deletedAt: null },
      include: {
        client: true,
        entries: {
          include: {
            timesheet: {
              select: {
                startDate: true,
                endDate: true,
                isBCBA: true,
              },
            },
            provider: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            timesheet: {
              startDate: 'asc',
            },
          },
        },
      },
    })

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`)
    }

    if (!invoice.client) {
      throw new Error(`Client not found for invoice ${invoiceId}`)
    }

    console.error(`[REGULAR_INVOICE_PDF] ${correlationId} Invoice data fetched`, {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      entriesCount: invoice.entries.length,
      clientName: invoice.client.name,
    })

    // Convert invoice entries to PDF format
    const pdfEntries = invoice.entries.map(entry => {
      const entryDate = entry.timesheet?.startDate || invoice.startDate
      const description = entry.provider?.name || `Provider ${entry.providerId}`
      
      return {
        date: entryDate,
        description,
        units: entry.units.toNumber(),
        amount: entry.amount.toNumber(),
      }
    })

    // Prepare invoice data for PDF template
    const invoiceForPdf: InvoiceForPDF = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      serviceDate: invoice.startDate, // Use start date as service date
      totalAmount: invoice.totalAmount.toNumber(),
      notes: invoice.notes,
      client: {
        name: invoice.client.name,
        address: invoice.client.address,
        idNumber: invoice.client.idNumber, // Use idNumber as Medicaid ID
      },
      entries: pdfEntries,
    }

    // Generate PDF using shared template with Smart Steps ABA branding
    const pdfBuffer = await renderInvoicePdf(invoiceForPdf, BRANDING_PRESETS.SMART_STEPS_ABA)
    const duration = Date.now() - startTime

    console.error(`[REGULAR_INVOICE_PDF] ${correlationId} PDF generated successfully`, {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      bytes: pdfBuffer.length,
      ms: duration,
      success: true,
    })

    return pdfBuffer
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[REGULAR_INVOICE_PDF] ${correlationId} PDF generation failed`, {
      invoiceId,
      bytes: 0,
      ms: duration,
      success: false,
      error: error?.message || 'Unknown error',
      stack: error?.stack,
    })
    throw error
  }
}
