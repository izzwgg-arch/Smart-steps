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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Check permissions based on timesheet type
    const userPermissions = await getUserPermissions(session.user.id)
    const isBCBA = timesheet.isBCBA
    const permissionKey = isBCBA ? 'bcbaTimesheets.approve' : 'timesheets.approve'
    const permission = userPermissions[permissionKey]
    
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const hasPermission = isAdmin || (permission?.canApprove === true)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized - Insufficient permissions' }, { status: 403 })
    }

    // Allow approval from DRAFT or SUBMITTED status
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Only draft or submitted timesheets can be approved' },
        { status: 400 }
      )
    }

    // Update timesheet to QUEUED_FOR_EMAIL and queue for email in a transaction
    const updated = await prisma.$transaction(async (tx) => {
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

      // Create email queue item (check if it doesn't already exist)
      const existingQueueItem = await tx.emailQueueItem.findFirst({
        where: {
          entityId: params.id,
          status: 'QUEUED',
        },
      })

      if (!existingQueueItem) {
        await tx.emailQueueItem.create({
          data: {
            type: isBCBA ? 'BCBA_TIMESHEET' : 'REGULAR_TIMESHEET',
            entityId: params.id,
            queuedByUserId: session.user.id,
            status: 'QUEUED',
          },
        })
      }

      return updatedTimesheet
    })

    // Log audit with appropriate action
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
    }).catch((err) => {
      console.error('Failed to create audit log entry:', err)
      // Non-blocking - continue even if audit log fails
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to approve timesheet' },
      { status: 500 }
    )
  }
}
