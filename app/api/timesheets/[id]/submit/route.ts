import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logSubmit } from '@/lib/audit'
import { sendEmail, getTimesheetSubmittedEmailHtml } from '@/lib/email'
import { formatDate } from '@/lib/utils'

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
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    if (timesheet.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft timesheets can be submitted' },
        { status: 400 }
      )
    }

    if (session.user.role !== 'ADMIN' && timesheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        provider: true,
      },
    })

    if (!updated) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    await prisma.timesheet.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // Log audit
    await logSubmit('Timesheet', params.id, session.user.id)

    // Send email to all admins
    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          active: true,
          deletedAt: null,
        },
      })

      const emailPromises = adminUsers.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `Timesheet Submitted for Review - ${updated.client.name}`,
          html: getTimesheetSubmittedEmailHtml(
            params.id,
            updated.client.name,
            updated.provider.name,
            formatDate(updated.startDate),
            formatDate(updated.endDate)
          ),
        })
      )

      await Promise.allSettled(emailPromises)
    } catch (error) {
      console.error('Failed to send timesheet submission emails:', error)
      // Don't fail the request if email fails
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error submitting timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to submit timesheet' },
      { status: 500 }
    )
  }
}
