import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildEmployeeMonthlyReport } from '@/lib/payroll/employeeMonthlyReportBuilder'

/**
 * GET /api/payroll/reports/employee/[employeeId]?month=YYYY-MM
 *
 * Shared JSON payload for browser preview and PDF export.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> | { employeeId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canView =
      session.user.role === 'ADMIN' ||
      session.user.role === 'SUPER_ADMIN'

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { employeeId } = await Promise.resolve(params)
    const monthParam = request.nextUrl.searchParams.get('month')

    if (!monthParam) {
      return NextResponse.json({ error: 'Month parameter is required (format: YYYY-MM)' }, { status: 400 })
    }

    const report = await buildEmployeeMonthlyReport(employeeId, monthParam)
    return NextResponse.json(report)
  } catch (error: any) {
    if (error?.message === 'Employee not found') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (error?.message?.includes('Invalid month format')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[EMPLOYEE MONTHLY REPORT] Failed to build report payload:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to build employee monthly report' },
      { status: 500 }
    )
  }
}
