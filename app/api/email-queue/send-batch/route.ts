import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMailSafe, getBatchApprovalEmailHtml, getBatchApprovalEmailText, QueuedTimesheetItem } from '@/lib/email'
import { generateTimesheetPDF } from '@/lib/pdf/timesheetPDFGenerator'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all queued items
    const queuedItems = await prisma.emailQueueItem.findMany({
      where: { status: 'QUEUED' },
      orderBy: { queuedAt: 'asc' },
    })

    if (queuedItems.length === 0) {
      return NextResponse.json({ error: 'No items in queue to send' }, { status: 400 })
    }

    // Generate batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const batchDate = format(new Date(), 'yyyy-MM-dd')

    // Fetch timesheet details
    const timesheetsWithDetails = await Promise.all(
      queuedItems.map(async (item) => {
        const timesheet = await prisma.timesheet.findUnique({
          where: { id: item.entityId },
          include: {
            client: {
              select: {
                name: true,
                address: true,
                idNumber: true,
                dlb: true,
                signature: true,
              },
            },
            provider: {
              select: {
                name: true,
                phone: true,
                signature: true,
                dlb: true,
              },
            },
            bcba: {
              select: {
                name: true,
              },
            },
            entries: {
              orderBy: { date: 'asc' },
              select: {
                date: true,
                startTime: true,
                endTime: true,
                minutes: true,
                notes: true,
              },
            },
          },
        })

        if (!timesheet) {
          return null
        }

        const totalMinutes = timesheet.entries.reduce((sum, entry) => sum + entry.minutes, 0)
        const totalHours = totalMinutes / 60

        return {
          queueItemId: item.id,
          type: item.type as 'REGULAR_TIMESHEET' | 'BCBA_TIMESHEET',
          timesheet,
          totalHours,
        }
      })
    )

    // Filter out null values
    const validTimesheets = timesheetsWithDetails.filter((ts): ts is NonNullable<typeof ts> => ts !== null)

    if (validTimesheets.length === 0) {
      return NextResponse.json({ error: 'No valid timesheets found in queue' }, { status: 400 })
    }

    // Generate PDFs for each timesheet
    const pdfAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
    const emailItems: QueuedTimesheetItem[] = []

    const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://66.94.105.43:3000'

    for (const item of validTimesheets) {
      try {
        // Generate PDF
        const pdfBuffer = await generateTimesheetPDF({
          id: item.timesheet.id,
          client: item.timesheet.client as any,
          provider: item.timesheet.provider as any,
          bcba: item.timesheet.bcba,
          startDate: item.timesheet.startDate,
          endDate: item.timesheet.endDate,
          isBCBA: item.timesheet.isBCBA,
          serviceType: item.timesheet.serviceType,
          sessionData: item.timesheet.sessionData,
          entries: item.timesheet.entries.map((entry) => ({
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            minutes: entry.minutes,
            notes: entry.notes,
          })),
        })

        const filename = `${item.type === 'BCBA_TIMESHEET' ? 'BCBA' : 'Regular'}_Timesheet_${item.timesheet.client.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(item.timesheet.startDate), 'yyyy-MM-dd')}.pdf`

        pdfAttachments.push({
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        })

        emailItems.push({
          id: item.timesheet.id,
          type: item.type,
          clientName: item.timesheet.client.name,
          providerName: item.timesheet.provider.name,
          bcbaName: item.timesheet.bcba.name,
          startDate: item.timesheet.startDate.toISOString(),
          endDate: item.timesheet.endDate.toISOString(),
          totalHours: item.totalHours,
          timesheetUrl: `${baseUrl}/${item.timesheet.isBCBA ? 'bcba-timesheets' : 'timesheets'}/${item.timesheet.id}`,
          serviceType: item.timesheet.serviceType || undefined,
          sessionData: item.timesheet.sessionData || undefined,
        })
      } catch (error) {
        console.error(`Failed to generate PDF for timesheet ${item.timesheet.id}:`, error)
        // Continue with other timesheets even if one PDF generation fails
      }
    }

    // Calculate totals
    const regularCount = emailItems.filter(item => item.type === 'REGULAR_TIMESHEET').length
    const bcbaCount = emailItems.filter(item => item.type === 'BCBA_TIMESHEET').length
    const totalHours = emailItems.reduce((sum, item) => sum + item.totalHours, 0)

    // Get email recipients from env
    const recipientsStr = process.env.EMAIL_APPROVAL_RECIPIENTS || 'info@productivebilling.com,jacobw@apluscenterinc.org'
    const recipients = recipientsStr.split(',').map((email) => email.trim()).filter(Boolean)

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No email recipients configured' }, { status: 500 })
    }

    // Send batch email
    const emailResult = await sendMailSafe(
      {
        to: recipients,
        subject: `Smart Steps ABA – Approved Timesheets Batch (${batchDate})`,
        html: getBatchApprovalEmailHtml(regularCount, bcbaCount, totalHours, emailItems, batchDate),
        text: getBatchApprovalEmailText(regularCount, bcbaCount, totalHours, emailItems, batchDate),
        attachments: pdfAttachments,
      },
      {
        action: 'EMAIL_SENT',
        entityType: 'EmailQueue',
        entityId: batchId,
        userId: session.user.id,
      }
    )

    if (!emailResult.success) {
      // Mark all items as failed
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: queuedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          lastError: emailResult.error || 'Unknown error',
        },
      })

      return NextResponse.json(
        { error: emailResult.error || 'Failed to send batch email' },
        { status: 500 }
      )
    }

    // Update timesheets and queue items on success
    const sentAt = new Date()

    await prisma.$transaction(async (tx) => {
      // Update queue items
      await tx.emailQueueItem.updateMany({
        where: { id: { in: queuedItems.map((item) => item.id) } },
        data: {
          status: 'SENT',
          sentAt,
          batchId,
        },
      })

      // Update timesheets
      await tx.timesheet.updateMany({
        where: { id: { in: validTimesheets.map((item) => item.timesheet.id) } },
        data: {
          status: 'EMAILED',
          emailedAt: sentAt,
          emailedBatchId: batchId,
          emailStatus: 'SENT',
        },
      })
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'EMAIL_SENT',
        entityType: 'EmailQueue',
        entityId: batchId,
        userId: session.user.id,
        metadata: JSON.stringify({
          batchId,
          sentCount: validTimesheets.length,
          regularCount,
          bcbaCount,
          totalHours,
          recipients: recipients.length,
          messageId: emailResult.messageId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      batchId,
      sentCount: validTimesheets.length,
      regularCount,
      bcbaCount,
      totalHours,
      messageId: emailResult.messageId,
    })
  } catch (error: any) {
    console.error('Error sending batch email:', error)
    
    // Mark all queued items as failed if we got that far
    try {
      const session = await getServerSession(authOptions)
      if (session) {
        const queuedItems = await prisma.emailQueueItem.findMany({
          where: { status: 'QUEUED' },
          select: { id: true },
        })
        
        if (queuedItems.length > 0) {
          await prisma.emailQueueItem.updateMany({
            where: { id: { in: queuedItems.map((item) => item.id) } },
            data: {
              status: 'FAILED',
              lastError: error.message || 'Unknown error during batch send',
            },
          })
        }
      }
    } catch (updateError) {
      console.error('Failed to update failed items:', updateError)
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to send batch email' },
      { status: 500 }
    )
  }
}
