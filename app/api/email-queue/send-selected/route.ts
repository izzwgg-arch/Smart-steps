import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMailSafe, getBatchApprovalEmailHtml, getBatchApprovalEmailText, QueuedTimesheetItem } from '@/lib/email'
import { generateTimesheetPDF } from '@/lib/pdf/timesheetPDFGenerator'
import { logEmailSent, logEmailFailed } from '@/lib/audit'
import { getUserPermissions } from '@/lib/permissions'
import { format } from 'date-fns'

function generateBatchId(): string {
  return `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * SEND SELECTED EMAIL QUEUE ITEMS
 * 
 * Sends only the selected queued items
 * Permission: emailQueue.sendBatch
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const userPermissions = await getUserPermissions(session.user.id)
    const canSendBatch =
      userPermissions['emailQueue.sendBatch']?.canCreate === true ||
      session.user.role === 'SUPER_ADMIN' ||
      session.user.role === 'ADMIN'

    if (!canSendBatch) {
      return NextResponse.json(
        { error: 'Forbidden - Not authorized to send batch emails' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid request: ids array required' }, { status: 400 })
    }

    // Step 1: Lock selected QUEUED items to SENDING in a transaction
    const lockedItems = await prisma.$transaction(async (tx) => {
      // Find selected QUEUED items (not deleted)
      const queuedItems = await tx.emailQueueItem.findMany({
        where: {
          id: { in: ids },
          status: 'QUEUED',
          deletedAt: null,
        },
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
      return NextResponse.json({ message: 'No queued items found to send' })
    }

    // Step 2: Generate batch ID
    const batchId = generateBatchId()
    const batchDate = format(new Date(), 'yyyy-MM-dd')

    // Step 3: Fetch timesheet details for all locked items
    const timesheetsWithDetails = await Promise.all(
      lockedItems.map(async (item) => {
        try {
          const timesheet = await prisma.timesheet.findFirst({
            where: {
              id: item.entityId,
              deletedAt: null,
            },
            include: {
              client: {
                select: {
                  id: true,
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
              bcba: { select: { name: true } },
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
            queueItem: item,
            timesheet: {
              ...timesheet,
              totalHours,
            },
          }
        } catch (error: any) {
          console.error(`Error fetching timesheet ${item.entityId}:`, error)
          return null
        }
      })
    )

    // Filter out null results
    const validTimesheets = timesheetsWithDetails.filter((item) => item !== null) as Array<{
      queueItem: any
      timesheet: any
    }>

    if (validTimesheets.length === 0) {
      // Mark items as FAILED
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: lockedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          errorMessage: 'No valid timesheets found',
        },
      })
      return NextResponse.json({ error: 'No valid timesheets found' }, { status: 400 })
    }

    // Step 4: Generate PDFs for all timesheets
    const pdfPromises = validTimesheets.map(async (item) => {
      try {
        const pdfBuffer = await generateTimesheetPDF({
          id: item.timesheet.id,
          client: item.timesheet.client as any,
          provider: item.timesheet.provider as any,
          bcba: item.timesheet.bcba,
          startDate: item.timesheet.startDate,
          endDate: item.timesheet.endDate,
          isBCBA: item.timesheet.isBCBA,
          serviceType: item.timesheet.serviceType || undefined,
          sessionData: item.timesheet.sessionData || undefined,
          entries: item.timesheet.entries.map((entry: any) => ({
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            minutes: entry.minutes,
            notes: entry.notes,
          })),
        })
        return {
          queueItem: item.queueItem,
          timesheet: item.timesheet,
          pdfBuffer,
        }
      } catch (error: any) {
        console.error(`Error generating PDF for timesheet ${item.timesheet.id}:`, error)
        return null
      }
    })

    const pdfResults = await Promise.all(pdfPromises)
    const validPdfs = pdfResults.filter((item) => item !== null) as Array<{
      queueItem: any
      timesheet: any
      pdfBuffer: Buffer
    }>

    if (validPdfs.length === 0) {
      // Mark items as FAILED
      await prisma.emailQueueItem.updateMany({
        where: { id: { in: lockedItems.map((item) => item.id) } },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to generate PDFs',
        },
      })
      return NextResponse.json({ error: 'Failed to generate PDFs' }, { status: 500 })
    }

    // Step 5: Prepare email data
    const regularCount = validPdfs.filter((item) => item.queueItem.entityType === 'REGULAR').length
    const bcbaCount = validPdfs.filter((item) => item.queueItem.entityType === 'BCBA').length
    const totalHours = validPdfs.reduce((sum, item) => sum + item.timesheet.totalHours, 0)

    const emailItems: QueuedTimesheetItem[] = validPdfs.map((item) => ({
      id: item.timesheet.id,
      timesheetUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://app.smartstepsabapc.org'}/timesheets/${item.timesheet.id}`,
      clientName: item.timesheet.client.name,
      providerName: item.timesheet.provider.name,
      bcbaName: item.timesheet.bcba?.name || 'N/A',
      startDate: item.timesheet.startDate,
      endDate: item.timesheet.endDate,
      totalHours: item.timesheet.totalHours,
      serviceType: item.timesheet.serviceType || undefined,
      sessionData: item.timesheet.sessionData || undefined,
      type: item.queueItem.entityType === 'BCBA' ? 'BCBA_TIMESHEET' : 'REGULAR_TIMESHEET',
    }))

    // Step 6: Prepare PDF attachments
    const pdfAttachments = validPdfs.map((item, index) => ({
      filename: `timesheet-${item.timesheet.id}-${index + 1}.pdf`,
      content: item.pdfBuffer,
      contentType: 'application/pdf',
    }))

    // Step 7: Send batch email
    const emailResult = await sendMailSafe(
      {
        to: process.env.APPROVAL_EMAIL || 'approval@smartstepsabapc.org',
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

    const sentAt = new Date()

    // Step 8: Update database based on result
    if (emailResult.success) {
      // SUCCESS: Mark items SENT, update timesheets EMAILED
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

        // Update timesheets to EMAILED
        await tx.timesheet.updateMany({
          where: {
            id: { in: validTimesheets.map((item) => item.timesheet.id) },
          },
          data: {
            status: 'EMAILED',
            emailedAt: sentAt,
          },
        })
      })

      // Log audit (non-blocking)
      try {
        await logEmailSent('EmailQueue', batchId, session.user.id, {
          sentCount: validPdfs.length,
          batchDate,
        })
      } catch (auditError) {
        console.error('Failed to log email sent audit:', auditError)
      }

      return NextResponse.json({
        success: true,
        sentCount: validPdfs.length,
        batchId,
        message: `Successfully sent ${validPdfs.length} timesheet(s)`,
      })
    } else {
      // FAILURE: Mark items FAILED, store error
      await prisma.$transaction(async (tx) => {
        await tx.emailQueueItem.updateMany({
          where: { id: { in: lockedItems.map((item) => item.id) } },
          data: {
            status: 'FAILED',
            errorMessage: emailResult.error || 'Unknown error sending email',
          },
        })
      })

      // Log audit (non-blocking)
      try {
        await logEmailFailed('EmailQueue', batchId, session.user.id, emailResult.error || 'Unknown error', {
          attemptedCount: validPdfs.length,
          batchDate,
        })
      } catch (auditError) {
        console.error('Failed to log email failed audit:', auditError)
      }

      return NextResponse.json(
        {
          error: emailResult.error || 'Failed to send batch email',
          details: process.env.NODE_ENV === 'development' ? emailResult.error : undefined,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[EMAIL QUEUE SEND SELECTED] Error:', {
      error: error?.message,
      stack: error?.stack,
    })

    return NextResponse.json(
      {
        error: error.message || 'Failed to send batch email',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
