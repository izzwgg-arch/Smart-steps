import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildEmployeeMonthlyReport } from '@/lib/payroll/employeeMonthlyReportBuilder'
import { generateEmployeeMonthlyReportPDF } from '@/lib/pdf/employeeMonthlyReportPDF'

/**
 * GET /api/payroll/employee-reports/[employeeId]?month=1-12&year=YYYY
 *
 * Legacy PDF endpoint kept for compatibility. Uses the shared report builder.
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

    const canGenerate =
      session.user.role === 'ADMIN' ||
      session.user.role === 'SUPER_ADMIN'

    if (!canGenerate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { employeeId } = await Promise.resolve(params)
    const searchParams = request.nextUrl.searchParams
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const month = monthParam ? parseInt(monthParam, 10) : 1
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
    }

    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    const report = await buildEmployeeMonthlyReport(employeeId, monthKey)
    const pdfBuffer = await generateEmployeeMonthlyReportPDF(report)

    const safeFileName = report.employee.fullName.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `employee-report-${safeFileName}-${month}-${year}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    if (error?.message === 'Employee not found') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    console.error('Error generating employee report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}
