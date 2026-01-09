import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // 'QUEUED', 'SENT', 'FAILED', or null for all

    const where: any = {}
    if (status) {
      where.status = status
    }

    const queueItems = await prisma.emailQueueItem.findMany({
      where,
      orderBy: { queuedAt: 'desc' },
      include: {
        queuedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    })

    // Fetch timesheet details for each item
    const itemsWithTimesheets = await Promise.all(
      queueItems.map(async (item) => {
        const timesheet = await prisma.timesheet.findUnique({
          where: { id: item.entityId },
          include: {
            client: { select: { name: true } },
            provider: { select: { name: true } },
            bcba: { select: { name: true } },
            entries: {
              select: {
                minutes: true,
              },
            },
          },
        })

        const totalMinutes = timesheet?.entries.reduce((sum, entry) => sum + entry.minutes, 0) || 0
        const totalHours = totalMinutes / 60

        return {
          id: item.id,
          type: item.type,
          entityId: item.entityId,
          queuedAt: item.queuedAt.toISOString(),
          sentAt: item.sentAt?.toISOString() || null,
          status: item.status,
          lastError: item.lastError,
          batchId: item.batchId,
          queuedBy: item.queuedBy,
          timesheet: timesheet
            ? {
                id: timesheet.id,
                client: timesheet.client,
                provider: timesheet.provider,
                bcba: timesheet.bcba,
                startDate: timesheet.startDate.toISOString(),
                endDate: timesheet.endDate.toISOString(),
                totalHours,
                serviceType: timesheet.serviceType || undefined,
                sessionData: timesheet.sessionData || undefined,
              }
            : null,
        }
      })
    )

    return NextResponse.json({ items: itemsWithTimesheets })
  } catch (error) {
    console.error('Error fetching email queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email queue' },
      { status: 500 }
    )
  }
}
