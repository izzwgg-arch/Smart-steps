import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logReject } from '@/lib/audit'
import { sendEmail, getTimesheetRejectedEmailHtml } from '@/lib/email'
import { formatDate } from '@/lib/utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
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
        user: true,
      },
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    if (timesheet.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: 'Only submitted timesheets can be rejected' },
        { status: 400 }
      )
    }

    const updated = await prisma.timesheet.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
      },
    })

    // Log audit
    await logReject('Timesheet', params.id, session.user.id, reason.trim())

    // Send email to timesheet owner
    try {
      await sendEmail({
        to: timesheet.user.email,
        subject: `Timesheet Rejected - ${timesheet.client.name}`,
        html: getTimesheetRejectedEmailHtml(
          timesheet.client.name,
          timesheet.provider.name,
          formatDate(timesheet.startDate),
          formatDate(timesheet.endDate),
          reason.trim()
        ),
      })
    } catch (error) {
      console.error('Failed to send timesheet rejection email:', error)
      // Don't fail the request if email fails
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error rejecting timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to reject timesheet' },
      { status: 500 }
    )
  }
}
