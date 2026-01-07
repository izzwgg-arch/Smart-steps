import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    // Get pending timesheets (SUBMITTED status)
    const pendingTimesheetsWhere: any = isAdmin
      ? { status: 'SUBMITTED' as const, deletedAt: null }
      : { status: 'SUBMITTED' as const, userId, deletedAt: null }

    const pendingTimesheets = await prisma.timesheet.findMany({
      where: pendingTimesheetsWhere,
      include: {
        client: { select: { name: true } },
        provider: { select: { name: true } },
        user: { select: { email: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    })

    // Get recent activity (audit logs)
    const recentActivity = await prisma.auditLog.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Get unread notifications count
    const unreadNotificationsCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    })

    // Get quick stats
    const statsWhere = isAdmin ? {} : { userId }

    const [
      totalTimesheets,
      draftTimesheets,
      submittedTimesheets,
      approvedTimesheets,
      totalInvoices,
      draftInvoices,
      totalBilled,
      totalPaid,
      totalOutstanding,
    ] = await Promise.all([
      // Timesheet counts
      prisma.timesheet.count({
        where: { ...statsWhere, deletedAt: null },
      }),
      prisma.timesheet.count({
        where: { ...statsWhere, status: 'DRAFT', deletedAt: null },
      }),
      prisma.timesheet.count({
        where: { ...statsWhere, status: 'SUBMITTED', deletedAt: null },
      }),
      prisma.timesheet.count({
        where: { ...statsWhere, status: 'APPROVED', deletedAt: null },
      }),
      // Invoice counts
      prisma.invoice.count({
        where: { deletedAt: null },
      }),
      prisma.invoice.count({
        where: { status: 'DRAFT', deletedAt: null },
      }),
      // Financial totals
      prisma.invoice.aggregate({
        where: { deletedAt: null },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { deletedAt: null },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { deletedAt: null },
        _sum: { outstanding: true },
      }),
    ])

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      stats: {
        timesheets: {
          total: totalTimesheets,
          draft: draftTimesheets,
          submitted: submittedTimesheets,
          approved: approvedTimesheets,
        },
        invoices: {
          total: totalInvoices,
          draft: draftInvoices,
        },
        financial: {
          totalBilled: parseFloat(totalBilled._sum.totalAmount?.toString() || '0'),
          totalPaid: parseFloat(totalPaid._sum.paidAmount?.toString() || '0'),
          totalOutstanding: parseFloat(totalOutstanding._sum.outstanding?.toString() || '0'),
        },
      },
      pendingTimesheets,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        userEmail: log.user.email,
        createdAt: log.createdAt,
        oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
        newValues: log.newValues ? JSON.parse(log.newValues) : null,
      })),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.name,
        status: inv.status,
        totalAmount: parseFloat(inv.totalAmount.toString()),
        createdAt: inv.createdAt,
      })),
      unreadNotificationsCount,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
