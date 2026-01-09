import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logReject } from '@/lib/audit'
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

    const data = await request.json()
    const { reason } = data

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
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
    const permissionKey = isBCBA ? 'bcbaTimesheets.reject' : 'timesheets.reject'
    const permission = userPermissions[permissionKey]
    
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const hasPermission = isAdmin || (permission?.canApprove === true) // Reject uses canApprove permission

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized - Insufficient permissions' }, { status: 403 })
    }

    // Allow rejection from DRAFT or SUBMITTED status
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Only draft or submitted timesheets can be rejected' },
        { status: 400 }
      )
    }

    // Update timesheet to REJECTED (do NOT queue for email)
    const updated = await prisma.timesheet.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
      },
    })

    // Log audit with appropriate action
    const auditAction = isBCBA ? 'BCBA_TIMESHEET_REJECTED' : 'TIMESHEET_REJECTED'
    await logReject(isBCBA ? 'BCBATimesheet' : 'Timesheet', params.id, session.user.id, reason.trim())

    // Also create specific audit log entry
    await prisma.auditLog.create({
      data: {
        action: auditAction as any,
        entityType: isBCBA ? 'BCBATimesheet' : 'Timesheet',
        entityId: params.id,
        userId: session.user.id,
        metadata: JSON.stringify({
          reason: reason.trim(),
          clientName: timesheet.client.name,
          providerName: timesheet.provider.name,
          bcbaName: timesheet.bcba.name,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error rejecting timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to reject timesheet' },
      { status: 500 }
    )
  }
}
