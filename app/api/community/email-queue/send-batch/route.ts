import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMailSafe } from '@/lib/email'
import { generateCommunityInvoicePdf } from '@/lib/pdf/communityInvoicePdf'
import { logEmailSent, logEmailFailed } from '@/lib/audit'
import { getUserPermissions } from '@/lib/permissions'
import { format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

/**
 * SEND BATCH EMAIL FOR COMMUNITY INVOICES
 * 
 * Transactional flow:
 * 1. Check permissions
 * 2. Lock all QUEUED items to SENDING (transaction)
 * 3. Generate PDFs for all invoices
 * 4. Send ONE email with all PDFs attached
 * 5. On success: Mark items SENT, update invoices EMAILED
 * 6. On failure: Mark items FAILED, store error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Community Classes subsection permission
    const { canAccessCommunitySection } = await import('@/lib/permissions')
    const hasAccess = await canAccessCommunitySection(session.user.id, 'emailQueue')
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden - No access to Community Classes Email Queue' },
        { status: 403 }
      )
    }

    // Parse request body to get selected item IDs and recipients
    const requestBody = await request.json().catch(() => ({}))
    const selectedItemIds = requestBody.itemIds // Optional: array of item IDs to send
    const customRecipients = requestBody.recipients // Array of email addresses from request

    // Step 1: Lock selected QUEUED items to SENDING in a transaction
    const lockedItems = await prisma.$transaction(async (tx) => {
      // Find QUEUED items for community invoices (optionally filtered by selectedItemIds)
      const where: any = {
        status: 'QUEUED',
        entityType: 'COMMUNITY_INVOICE',
      }
      if (selectedItemIds && Array.isArray(selectedItemIds) && selectedItemIds.length > 0) {
        where.id = { in: selectedItemIds }
      }

      const queuedItems = await tx.emailQueueItem.findMany({
        where,
        orderBy: { queuedAt: 'asc' },
      })

      if (queuedItems.length === 0) {
        return []
      }

      // Lock them to SENDING
      await tx.emailQueueItem.updateMany({
        where: { id: { in: queuedItems.map((item) => item.id) } },
        data: { status: 'SENDING' },
      })

      return queuedItems
    })

    if (lockedItems.length === 0) {
      return NextResponse.json({ message: 'No items in queue to send' })
    }

    // Step 2: Generate batch ID
    const batchId = uuidv4()
    const batchDate = format(new Date(), 'yyyy-MM-dd')

    // Step 3: Fetch invoice details for all locked items
    const invoicesWithDetails = await Promise.all(
      lockedItems.map(async (item) => {
        try {
          const invoice = await prisma.communityInvoice.findUnique({
            where: { id: item.entityId },
            include: {
              client: true,
              class: true,
            },
          })

          if (!invoice || invoice.deletedAt) {
            return null
          }

          return {
            queueItemId: item.id,
            invoice,
          }
        } catch (error: any) {
          console.error(`Error fetching invoice ${item.entityId}:`, error)
          return null
        }
      })
    )

    // Filter out null values
    const validInvoices = invoicesWithDetails.filter(
      (inv): inv is NonNullable<typeof inv> => inv !== null
    )

    if (validInvoices.length === 0) {
      // Mark all locked items as FAILED
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: lockedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          errorMessage: 'No valid invoices found',
        },
      })
      return NextResponse.json(
        { error: 'No valid invoices found in queue' },
        { status: 400 }
      )
    }

    // Step 4: Generate PDFs for each invoice
    const pdfAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
    const emailItems: Array<{
      id: string
      clientName: string
      className: string
      units: number
      totalAmount: number
      invoiceUrl: string
    }> = []
    const pdfErrors: Array<{ queueItemId: string; error: string }> = []

    const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://66.94.105.43:3000'

    for (const item of validInvoices) {
      const correlationId = `email-pdf-${item.invoice.id}-${Date.now()}`
      try {
        console.error(`[COMMUNITY EMAIL QUEUE] ${correlationId} Generating PDF for invoice ${item.invoice.id}...`)
        // Use the SAME PDF generation function as the print route
        const pdfBuffer = await generateCommunityInvoicePdf(item.invoice.id)

        console.error(`[COMMUNITY EMAIL QUEUE] ${correlationId} PDF generated successfully, size: ${pdfBuffer.length} bytes`)
        // Attachment filename with KJ Play Center branding (no Smart Steps ABA)
        const filename = `KJ_Play_Center_Invoice_${item.invoice.client.firstName}_${item.invoice.client.lastName}_${format(new Date(item.invoice.createdAt), 'yyyy-MM-dd')}.pdf`

        pdfAttachments.push({
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        })

        // Build public invoice URL with token (NO AUTH REQUIRED)
        // Fetch the invoice again to get the viewToken (it was generated during approval)
        const invoiceWithToken = await prisma.communityInvoice.findUnique({
          where: { id: item.invoice.id },
          select: { viewToken: true },
        })
        
        const publicInvoiceUrl = invoiceWithToken?.viewToken
          ? `${baseUrl}/public/community/invoice/${item.invoice.id}?token=${invoiceWithToken.viewToken}`
          : `${baseUrl}/community/invoices/${item.invoice.id}` // Fallback if token missing

        emailItems.push({
          id: item.invoice.id,
          clientName: `${item.invoice.client.firstName} ${item.invoice.client.lastName}`,
          className: item.invoice.class.name,
          units: item.invoice.units,
          totalAmount: item.invoice.totalAmount.toNumber(),
          invoiceUrl: publicInvoiceUrl,
        })
      } catch (error: any) {
        console.error(`[COMMUNITY EMAIL QUEUE] ${correlationId} Failed to generate PDF for invoice ${item.invoice.id}:`, {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
          queueItemId: item.queueItemId,
        })
        pdfErrors.push({
          queueItemId: item.queueItemId,
          error: error.message || 'PDF generation failed',
        })
      }
    }

    // If all PDFs failed, mark all as FAILED
    if (pdfAttachments.length === 0) {
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: lockedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          errorMessage: 'All PDF generation failed',
        },
      })
      return NextResponse.json(
        { error: 'Failed to generate PDFs for all invoices' },
        { status: 500 }
      )
    }

    // Step 5: Calculate totals
    const totalAmount = emailItems.reduce((sum, item) => sum + item.totalAmount, 0)
    const totalUnits = emailItems.reduce((sum, item) => sum + item.units, 0)

    // Step 6: Get email recipients from request body or env
    const recipientsStr =
      customRecipients && Array.isArray(customRecipients) && customRecipients.length > 0
        ? customRecipients.join(',')
        : process.env.EMAIL_APPROVAL_RECIPIENTS || 'info@productivebilling.com,jacobw@apluscenterinc.org'
    const recipients = recipientsStr.split(',').map((email) => email.trim()).filter(Boolean)

    if (recipients.length === 0) {
      // Mark all as FAILED
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: lockedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          errorMessage: 'No email recipients configured',
        },
      })
      return NextResponse.json(
        { error: 'No email recipients configured' },
        { status: 500 }
      )
    }

    // Step 7: Build email content with KJ Play Center branding
    // NOTE: To avoid Gmail generic avatar, use a domain-based email address (not gmail.com)
    // Example: invoices@kjplaycenter.com (requires SPF/DKIM/DMARC DNS records)
    // Gmail shows generic avatar when:
    //   - Sender uses gmail.com domain
    //   - OR domain lacks proper authentication (SPF/DKIM/DMARC)
    // Once domain-authenticated, Gmail removes the generic icon automatically
    const emailBrandName = process.env.COMMUNITY_EMAIL_FROM_NAME || 'KJ Play Center'
    // Use domain-based address (default: invoices@kjplaycenter.com) to avoid Gmail generic avatar
    const emailFromAddress = process.env.COMMUNITY_EMAIL_FROM_ADDRESS || 'invoices@kjplaycenter.com'
    const emailFrom = `${emailBrandName} <${emailFromAddress}>`
    const emailSubjectPrefix = process.env.COMMUNITY_EMAIL_SUBJECT_PREFIX || 'KJ Play Center'
    
    // Log the From header for verification
    console.error('[COMMUNITY_EMAIL] Email From header:', emailFrom)

    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>${emailSubjectPrefix} – Approved Community Invoices Batch (${batchDate})</h2>
          <p>This email contains ${emailItems.length} approved community invoice(s) for processing.</p>
          
          <h3>Summary</h3>
          <ul>
            <li><strong>Total Invoices:</strong> ${emailItems.length}</li>
            <li><strong>Total Units:</strong> ${totalUnits}</li>
            <li><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</li>
          </ul>
          
          <h3>Invoice Details</h3>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th>Client</th>
                <th>Class</th>
                <th>Units</th>
                <th>Total Amount</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              ${emailItems.map(item => `
                <tr>
                  <td>${item.clientName}</td>
                  <td>${item.className}</td>
                  <td>${item.units}</td>
                  <td>$${item.totalAmount.toFixed(2)}</td>
                  <td><a href="${item.invoiceUrl}">View Invoice</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            All invoices are attached as PDF files. Please review and process accordingly.
          </p>
        </body>
      </html>
    `

    const emailText = `
${emailSubjectPrefix} – Approved Community Invoices Batch (${batchDate})

This email contains ${emailItems.length} approved community invoice(s) for processing.

Summary:
- Total Invoices: ${emailItems.length}
- Total Units: ${totalUnits}
- Total Amount: $${totalAmount.toFixed(2)}

Invoice Details:
${emailItems.map(item => `- ${item.clientName} | ${item.className} | ${item.units} units | $${item.totalAmount.toFixed(2)} | ${item.invoiceUrl}`).join('\n')}

All invoices are attached as PDF files. Please review and process accordingly.
    `

    // Step 8: Send batch email
    const emailResult = await sendMailSafe(
      {
        to: recipients,
        from: emailFrom,
        subject: `${emailSubjectPrefix} – Approved Community Invoices Batch (${batchDate})`,
        html: emailHtml,
        text: emailText,
        attachments: pdfAttachments,
      },
      {
        action: 'EMAIL_SENT',
        entityType: 'EmailQueue',
        entityId: batchId,
        userId: session.user.id,
      }
    )

    const sentAt = new Date()

    // Step 9: Update database based on result
    if (emailResult.success) {
      // SUCCESS: Mark items SENT, update invoices EMAILED
      await prisma.$transaction(async (tx) => {
        // Update queue items to SENT
        await tx.emailQueueItem.updateMany({
          where: { id: { in: lockedItems.map((item) => item.id) } },
          data: {
            status: 'SENT',
            sentAt,
            batchId,
          },
        })

        // Update invoices to EMAILED
        await tx.communityInvoice.updateMany({
          where: {
            id: { in: validInvoices.map((item) => item.invoice.id) },
          },
          data: {
            status: 'EMAILED',
            emailedAt: sentAt,
          },
        })
      })

      // Log audit events
      for (const item of validInvoices) {
        try {
          await logEmailSent(
            'CommunityInvoice',
            item.invoice.id,
            session.user.id,
            {
              type: 'COMMUNITY_INVOICE',
              batchId,
              clientName: `${item.invoice.client.firstName} ${item.invoice.client.lastName}`,
              className: item.invoice.class.name,
              totalAmount: item.invoice.totalAmount.toFixed(2),
            }
          )
        } catch (error) {
          console.error('Failed to log email sent event (non-blocking):', error)
        }
      }

      return NextResponse.json({
        success: true,
        sentCount: validInvoices.length,
        batchId,
        message: `Successfully sent ${validInvoices.length} invoice(s) in batch email`,
      })
    } else {
      // FAILURE: Mark items FAILED
      await prisma.$transaction(async (tx) => {
        await tx.emailQueueItem.updateMany({
          where: { id: { in: lockedItems.map((item) => item.id) } },
          data: {
            status: 'FAILED',
            errorMessage: emailResult.error || 'Email sending failed',
          },
        })
      })

      // Log audit events
      for (const item of validInvoices) {
        try {
          await logEmailFailed(
            'CommunityInvoice',
            item.invoice.id,
            session.user.id,
            emailResult.error || 'Email sending failed',
            {
              type: 'COMMUNITY_INVOICE',
            }
          )
        } catch (error) {
          console.error('Failed to log email failed event (non-blocking):', error)
        }
      }

      return NextResponse.json(
        {
          error: emailResult.error || 'Failed to send batch email',
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[COMMUNITY EMAIL QUEUE SEND BATCH] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send batch email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
