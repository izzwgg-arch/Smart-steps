import { prisma } from '@/lib/prisma'
import { generateCommunityInvoicePDF } from './communityInvoicePDFGenerator'

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

    // Generate PDF using old PDFKit-based generator
    const pdfBuffer = await generateCommunityInvoicePDF({
      id: invoice.id,
      totalAmount: invoice.totalAmount.toNumber(),
      units: invoice.units,
      ratePerUnit: invoice.class.ratePerUnit?.toNumber() || 0,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      client: {
        firstName: invoice.client.firstName,
        lastName: invoice.client.lastName,
        email: invoice.client.email,
        phone: invoice.client.phone,
        address: invoice.client.address,
        city: invoice.client.city,
        state: invoice.client.state,
        zipCode: invoice.client.zipCode,
        medicaidId: invoice.client.medicaidId,
      },
      class: {
        name: invoice.class.name,
        ratePerUnit: invoice.class.ratePerUnit?.toNumber() || 0,
      },
      serviceDate: invoice.serviceDate?.toISOString() || null,
    })
    
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

