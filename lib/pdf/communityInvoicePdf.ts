import { prisma } from '@/lib/prisma'
import { generateInvoiceHTML, InvoiceForHTML } from './invoiceHtmlTemplate'
import { generatePDFFromHTML } from './playwrightPDF'

/**
 * Generate Community Invoice PDF from invoiceId
 * This is the SINGLE source of truth for Community invoice PDF generation
 * Used by both Print/Download route and Email Queue
 */
export async function generateCommunityInvoicePdf(invoiceId: string): Promise<Buffer> {
  const startTime = Date.now()
  const correlationId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  console.error(`[COMMUNITY_INVOICE_PDF] ${correlationId} Starting PDF generation for invoiceId: ${invoiceId}`)
  
  try {
    // Fetch invoice with related data
    const invoice = await prisma.communityInvoice.findUnique({
      where: { id: invoiceId, deletedAt: null },
      include: {
        client: true,
        class: true,
      },
    })

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`)
    }

    if (!invoice.client) {
      throw new Error(`Client not found for invoice ${invoiceId}`)
    }

    if (!invoice.class) {
      throw new Error(`Class not found for invoice ${invoiceId}`)
    }

    console.error(`[COMMUNITY_INVOICE_PDF] ${correlationId} Invoice data fetched`, {
      invoiceId,
      clientId: invoice.clientId,
      classId: invoice.classId,
      clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
      className: invoice.class.name,
    })

    // Generate PDF using HTML template with KJ Play Center branding
    const invoiceForHtml: InvoiceForHTML = {
      id: invoice.id,
      createdAt: invoice.createdAt,
      serviceDate: invoice.serviceDate ?? undefined,
      totalAmount: invoice.totalAmount.toNumber(),
      units: invoice.units,
      notes: invoice.notes,
      client: {
        firstName: invoice.client.firstName,
        lastName: invoice.client.lastName,
        medicaidId: invoice.client.medicaidId,
      },
      class: {
        name: invoice.class.name,
      },
      branding: {
        orgName: 'KJ PLAY CENTER',
        tagline: 'Where you Discover Intelligence Creativity, Excitement and Fun.',
        addressLine: 'Address 68 Jefferson St. Highland Mills N.Y.10930',
        phoneLine: '845-827-9585',
        emailLine: 'kjplaycanter@gmail.com',
      },
    }
    
    // Generate HTML and convert to PDF using Playwright
    const html = generateInvoiceHTML(invoiceForHtml)
    const pdfBuffer = await generatePDFFromHTML(html, correlationId)
    const duration = Date.now() - startTime

    console.error(`[COMMUNITY_INVOICE_PDF] ${correlationId} PDF generated successfully`, {
      invoiceId,
      clientId: invoice.clientId,
      classId: invoice.classId,
      bytes: pdfBuffer.length,
      ms: duration,
      success: true,
    })

    return pdfBuffer
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[COMMUNITY_INVOICE_PDF] ${correlationId} PDF generation failed`, {
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

