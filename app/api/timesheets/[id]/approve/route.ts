import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logApprove } from '@/lib/audit'
import { getUserPermissions } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[APPROVE] Starting approval for timesheet:', params.id)
    const session = await getServerSession(authOptions)
    if (!session) {
      console.error('[APPROVE] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[APPROVE] Session user:', { id: session.user.id, role: session.user.role })

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        provider: true,
        bcba: true,
        user: true,
      },
    })

    if (!timesheet || timesheet.deletedAt) {
      console.error('[APPROVE] Timesheet not found or deleted:', params.id)
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    console.log('[APPROVE] Timesheet found:', { id: timesheet.id, status: timesheet.status, isBCBA: timesheet.isBCBA })

    // Check permissions based on timesheet type
    const userPermissions = await getUserPermissions(session.user.id)
    const isBCBA = timesheet.isBCBA
    const permissionKey = isBCBA ? 'bcbaTimesheets.approve' : 'timesheets.approve'
    const permission = userPermissions[permissionKey]
    
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const hasPermission = isAdmin || (permission?.canApprove === true)

    console.log('[APPROVE] Permission check:', { permissionKey, hasPermission, isAdmin, permission })

    if (!hasPermission) {
      console.error('[APPROVE] Insufficient permissions')
      return NextResponse.json({ error: 'Unauthorized - Insufficient permissions' }, { status: 403 })
    }

    // Allow approval from DRAFT or SUBMITTED status
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'SUBMITTED') {
      console.error('[APPROVE] Invalid status for approval:', timesheet.status)
      return NextResponse.json(
        { error: 'Only draft or submitted timesheets can be approved' },
        { status: 400 }
      )
    }

    console.log('[APPROVE] Starting transaction to update timesheet and create queue item')

    // Update timesheet to QUEUED_FOR_EMAIL and queue for email in a transaction
    console.log('[APPROVE] Starting transaction')
    const updated = await prisma.$transaction(async (tx) => {
      console.log('[APPROVE] Transaction: Updating timesheet status to QUEUED_FOR_EMAIL')
      // Update timesheet status to QUEUED_FOR_EMAIL (will be EMAILED after batch send)
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: params.id },
        data: {
          status: 'QUEUED_FOR_EMAIL',
          approvedAt: new Date(),
          queuedForEmailAt: new Date(),
          emailStatus: 'QUEUED',
        },
      })
      console.log('[APPROVE] Transaction: Timesheet updated successfully')

      // Create email queue item (check if it doesn't already exist)
      console.log('[APPROVE] Transaction: Checking for existing queue item')
      const existingQueueItem = await tx.emailQueueItem.findFirst({
        where: {
          entityId: params.id,
          status: 'QUEUED',
        },
      })

      if (!existingQueueItem) {
        console.log('[APPROVE] Transaction: Creating new email queue item')
        try {
          await tx.emailQueueItem.create({
            data: {
              type: isBCBA ? 'BCBA_TIMESHEET' : 'REGULAR_TIMESHEET',
              entityId: params.id,
              queuedByUserId: session.user.id,
              status: 'QUEUED',
            },
          })
          console.log('[APPROVE] Transaction: Email queue item created successfully')
        } catch (queueError: any) {
          console.error('[APPROVE] Transaction: Failed to create email queue item:', queueError)
          console.error('[APPROVE] Transaction: Error details:', {
            message: queueError?.message,
            code: queueError?.code,
            meta: queueError?.meta,
          })
          throw queueError // Re-throw to rollback transaction
        }
      } else {
        console.log('[APPROVE] Transaction: Queue item already exists, skipping')
      }

      return updatedTimesheet
    })
    console.log('[APPROVE] Transaction completed successfully')

    // Log audit with appropriate action (non-blocking)
    try {
      const auditAction = isBCBA ? 'BCBA_TIMESHEET_APPROVED' : 'TIMESHEET_APPROVED'
      await logApprove(isBCBA ? 'BCBATimesheet' : 'Timesheet', params.id, session.user.id)

      // Also create specific audit log entry
      await prisma.auditLog.create({
        data: {
          action: auditAction as any,
          entityType: isBCBA ? 'BCBATimesheet' : 'Timesheet',
          entityId: params.id,
          userId: session.user.id,
          metadata: JSON.stringify({
            clientName: timesheet.client.name,
            providerName: timesheet.provider.name,
            bcbaName: timesheet.bcba.name,
            startDate: timesheet.startDate.toISOString(),
            endDate: timesheet.endDate.toISOString(),
            queuedForEmail: true,
          }),
        },
      })
    } catch (auditError) {
      console.error('Failed to create audit log entry (non-blocking):', auditError)
      // Non-blocking - continue even if audit log fails
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error approving timesheet:', error)
    const errorMessage = error?.message || String(error)
    console.error('Error details:', {
      message: errorMessage,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack?.substring(0, 500),
    })
    return NextResponse.json(
      { 
        error: 'Failed to approve timesheet',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
