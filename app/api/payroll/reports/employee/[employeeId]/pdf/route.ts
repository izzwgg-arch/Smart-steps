import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePDFFromHTML } from '@/lib/pdf/playwrightPDF'
import { generateEmployeeMonthlyReportHTML } from '@/lib/pdf/payrollEmployeeMonthlyReportHtml'
import { buildEmployeeMonthlyReport } from '@/lib/payroll/employeeMonthlyReportBuilder'
import { format } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> | { employeeId: string } }
) {
  const genStart = Date.now()

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')

    if (!monthParam) {
      return NextResponse.json({ error: 'Month parameter is required (format: YYYY-MM)' }, { status: 400 })
    }

    const { employeeId } = await Promise.resolve(params)

    console.log(`[PAYROLL PDF] Generating employee monthly report: employeeId=${employeeId} month=${monthParam}`)

    const report = await buildEmployeeMonthlyReport(employeeId, monthParam)

  if (report.validation.warnings.length > 0) {
      console.warn('[PAYROLL PDF] Report validation warnings:', report.validation.warnings)
    }

    const html = generateEmployeeMonthlyReportHTML(report)
    const pdfBuffer = await generatePDFFromHTML(html, `employee-monthly-${employeeId}-${monthParam}`)

    const genMs = Date.now() - genStart
    console.log(
      `[PAYROLL PDF] Done: employeeId=${employeeId} month=${monthParam} entries=${report.timeEntries.length} bytes=${pdfBuffer.length} time=${genMs}ms`
    )

    try {
      await prisma.payrollReportArtifact.create({
        data: {
          type: 'EMPLOYEE_MONTHLY',
          employeeId,
          year: report.period.year,
          month: report.period.month,
          storageKeyOrPath: `employee-${employeeId}-${report.period.year}-${report.period.month}.pdf`,
          generatedByUserId: session.user.id,
        },
      })
    } catch (artifactError) {
      console.warn('[PAYROLL PDF] Failed to save report artifact (non-fatal):', artifactError)
    }

    const periodStart = new Date(report.period.year, report.period.month - 1, 1)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="employee-monthly-${report.employee.fullName.replace(/\s+/g, '-')}-${format(periodStart, 'yyyy-MM')}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    const genMs = Date.now() - genStart
    console.error('[PAYROLL PDF] Employee monthly report generation failed', {
      error: error?.message,
      stack: error?.stack,
      elapsed: `${genMs}ms`,
    })

    if (error?.message === 'Employee not found') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (error?.message?.includes('Invalid month format')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
