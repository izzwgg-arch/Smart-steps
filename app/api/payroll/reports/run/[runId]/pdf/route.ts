import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePDFFromHTML } from '@/lib/pdf/playwrightPDF'
import { generateRunSummaryReportHTML } from '@/lib/pdf/payrollRunSummaryReportHtml'
import { format } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> | { runId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = await Promise.resolve(params)

    console.log(`[PAYROLL PDF] Generating run summary: runId=${runId}`)

    // Fetch run with all related data — always fresh from DB
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        lines: {
          include: { employee: true },
          orderBy: { employee: { fullName: 'asc' } },
        },
      },
    })

    if (!run) {
      console.warn(`[PAYROLL PDF] Run not found: ${runId}`)
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    const lines = run.lines ?? []

    // Pre-generation validation
    if (lines.length === 0) {
      console.warn(`[PAYROLL PDF] Run ${runId} has no employee lines — generating empty report`)
    }

    // Calculate summary
    const totalGross    = lines.reduce((s, l) => s + parseFloat(l.grossPay?.toString()   || '0'), 0)
    const totalPaid     = lines.reduce((s, l) => s + parseFloat(l.amountPaid?.toString() || '0'), 0)
    const totalOwed     = lines.reduce((s, l) => s + parseFloat(l.amountOwed?.toString() || '0'), 0)
    const employeeCount = lines.length

    const employees = lines.map(line => ({
      employeeName: line.employee.fullName,
      totalHours:   parseFloat(line.totalHours.toString()),
      hourlyRate:   parseFloat(line.hourlyRateUsed.toString()),
      grossPay:     parseFloat(line.grossPay.toString()),
      amountPaid:   parseFloat(line.amountPaid.toString()),
      amountOwed:   parseFloat(line.amountOwed.toString()),
    }))

    const html = generateRunSummaryReportHTML({
      run: {
        id:         run.id,
        name:       run.name,
        periodStart: run.periodStart,
        periodEnd:  run.periodEnd,
        status:     run.status,
        createdAt:  run.createdAt,
      },
      summary: { totalGross, totalPaid, totalOwed, employeeCount },
      employees,
    })

    // Generate PDF — stateless, re-initializes on every request
    const pdfBuffer = await generatePDFFromHTML(html, `run-summary-${runId}`)

    console.log(`[PAYROLL PDF] Run summary done: runId=${runId} employees=${employeeCount} bytes=${pdfBuffer.length}`)

    // Track artifact (non-fatal)
    try {
      await prisma.payrollReportArtifact.create({
        data: {
          type:             'RUN_SUMMARY',
          runId,
          storageKeyOrPath: `run-${runId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
          generatedByUserId: session.user.id,
        },
      })
    } catch (artifactError) {
      console.warn('[PAYROLL PDF] Failed to save run artifact (non-fatal):', artifactError)
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="payroll-run-${run.name.replace(/\s+/g, '-')}-${format(run.periodStart, 'yyyy-MM-dd')}.pdf"`,
        'Content-Length':      pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('[PAYROLL PDF] Run summary generation failed', {
      error: error?.message,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}
