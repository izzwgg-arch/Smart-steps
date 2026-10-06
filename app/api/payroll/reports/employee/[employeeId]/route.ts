import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildEmployeeMonthlyReport } from '@/lib/payroll/employeeMonthlyReportBuilder'

/**
 * GET /api/payroll/reports/employee/[employeeId]?month=YYYY-MM
 * OR /api/payroll/reports/employee/[employeeId]?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Shared JSON payload for browser preview and PDF export.
 * Supports both legacy month parameter and new date range parameters.
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
    const startDateParam = request.nextUrl.searchParams.get('startDate')
    const endDateParam = request.nextUrl.searchParams.get('endDate')

    // Support both month and date range parameters
    if (monthParam) {
      const report = await buildEmployeeMonthlyReport(employeeId, monthParam)
      return NextResponse.json(report)
    } else if (startDateParam && endDateParam) {
      const report = await buildEmployeeMonthlyReport(employeeId, undefined, startDateParam, endDateParam)
      return NextResponse.json(report)
    } else {
      return NextResponse.json(
        { error: 'Either month parameter (YYYY-MM) or both startDate and endDate parameters (YYYY-MM-DD) are required' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    if (error?.message === 'Employee not found') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (error?.message?.includes('Invalid') && error?.message?.includes('format')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[EMPLOYEE MONTHLY REPORT] Failed to build report payload:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to build employee monthly report' },
      { status: 500 }
    )
  }
}
