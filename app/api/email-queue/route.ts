import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - use permission check instead of just role check
    const userPermissions = await getUserPermissions(session.user.id)
    const canViewQueue = userPermissions['emailQueue.view']?.canView === true || 
                        session.user.role === 'SUPER_ADMIN' || 
                        session.user.role === 'ADMIN'

    if (!canViewQueue) {
      return NextResponse.json({ error: 'Forbidden - Not authorized to view email queue' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // 'QUEUED', 'SENT', 'FAILED', or null for all

    const where: any = {}
    if (status) {
      where.status = status
    }

    console.log('[EMAIL-QUEUE] Fetching queue items with status:', status || 'all')
    let queueItems
    try {
      queueItems = await prisma.emailQueueItem.findMany({
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
      console.log('[EMAIL-QUEUE] Found', queueItems.length, 'queue items')
    } catch (error: any) {
      console.error('[EMAIL-QUEUE] Error fetching queue items:', error)
      console.error('[EMAIL-QUEUE] Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
      })
      throw error
    }

    // Fetch timesheet details for each item
    const itemsWithTimesheets = await Promise.all(
      queueItems.map(async (item) => {
        try {
          const timesheet = await prisma.timesheet.findFirst({
            where: { 
              id: item.entityId,
              deletedAt: null, // Only get non-deleted timesheets
            },
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

          if (!timesheet) {
            // Timesheet not found or deleted - still return item but without timesheet data
            return {
              id: item.id,
              type: item.type,
              entityId: item.entityId,
              queuedAt: item.queuedAt.toISOString(),
              sentAt: item.sentAt?.toISOString() || null,
              status: item.status,
              lastError: item.lastError || 'Timesheet not found or deleted',
              batchId: item.batchId,
              queuedBy: item.queuedBy,
              timesheet: null,
            }
          }

          const totalMinutes = timesheet.entries.reduce((sum, entry) => sum + entry.minutes, 0)
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
            timesheet: {
              id: timesheet.id,
              client: timesheet.client,
              provider: timesheet.provider,
              bcba: timesheet.bcba,
              startDate: timesheet.startDate.toISOString(),
              endDate: timesheet.endDate.toISOString(),
              totalHours,
              serviceType: timesheet.serviceType || undefined,
              sessionData: timesheet.sessionData || undefined,
            },
          }
        } catch (error) {
          console.error(`Error fetching timesheet ${item.entityId}:`, error)
          return {
            id: item.id,
            type: item.type,
            entityId: item.entityId,
            queuedAt: item.queuedAt.toISOString(),
            sentAt: item.sentAt?.toISOString() || null,
            status: item.status,
            lastError: item.lastError || `Error loading timesheet: ${error instanceof Error ? error.message : 'Unknown error'}`,
            batchId: item.batchId,
            queuedBy: item.queuedBy,
            timesheet: null,
          }
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
