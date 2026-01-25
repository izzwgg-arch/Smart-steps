import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { generateEmployeeMonthlyReportPDF } from '@/lib/pdf/employeeMonthlyReportPDF'

/**
 * GET /api/payroll/employee-reports/[employeeId]
 * 
 * Generate monthly employee report PDF
 * Permission: payroll.employee_reports
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

    const permissions = await getUserPermissions(session.user.id)
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
    const month = monthParam ? parseInt(monthParam) : 1
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
    }

    // Fetch employee
    const employee = await (prisma as any).payrollEmployee.findUnique({
      where: { id: employeeId },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

    // Fetch payroll run lines for the month
    const runLines = await prisma.payrollRunLine.findMany({
      where: {
        employeeId,
        run: {
          periodStart: { lte: endDate },
          periodEnd: { gte: startDate },
        },
      },
      include: {
        run: true,
        payments: true,
      },
      orderBy: { run: { periodStart: 'asc' } },
    })

    // Generate PDF using the new report generator
    const pdfBuffer: Buffer = await generateEmployeeMonthlyReportPDF({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email || '',
        defaultHourlyRate: Number(employee.defaultHourlyRate),
      },
      month,
      year,
      runLines: runLines.map(line => ({
        runName: line.run.name,
        periodStart: line.run.periodStart,
        periodEnd: line.run.periodEnd,
        totalHours: Number(line.totalHours),
        hourlyRate: Number(line.hourlyRateUsed),
        grossPay: Number(line.grossPay),
        amountPaid: Number(line.amountPaid),
        amountOwed: Number(line.amountOwed),
        payments: line.payments.map(pay => ({
          amount: Number(pay.amount),
          paidAt: pay.paidAt,
          method: pay.method,
          reference: pay.reference || '',
        })),
      })),
    })

    const safeFileName = employee.displayName.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `employee-report-${safeFileName}-${month}-${year}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating employee report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}
