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

    // Update timesheet to APPROVED and queue for email
    const updated = await prisma.timesheet.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        queuedForEmailAt: new Date(),
        emailStatus: 'QUEUED',
      },
    })

    // Create email queue item
    await prisma.emailQueueItem.create({
      data: {
        type: isBCBA ? 'BCBA_TIMESHEET' : 'REGULAR_TIMESHEET',
        entityId: params.id,
        queuedByUserId: session.user.id,
        status: 'QUEUED',
      },
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
