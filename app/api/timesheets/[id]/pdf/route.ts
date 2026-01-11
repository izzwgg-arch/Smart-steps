import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTimesheetPDF } from '@/lib/pdf/timesheetPDFGenerator'
import { getUserPermissions } from '@/lib/permissions'

/**
 * GET /api/timesheets/[id]/pdf
 * 
 * Authenticated route for downloading Timesheet PDF
 * Requires authentication and timesheet view permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const timesheetId = resolvedParams.id

    // Check permissions
    const userPermissions = await getUserPermissions(session.user.id)
    const canView = 
      userPermissions['timesheets.view']?.canView === true ||
      session.user.role === 'SUPER_ADMIN' ||
      session.user.role === 'ADMIN'

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden - Not authorized to view timesheets' }, { status: 403 })
    }

    // Fetch timesheet with all required data
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            address: true,
            idNumber: true,
            dlb: true,
            signature: true,
          },
        },
        provider: {
          select: {
            name: true,
            phone: true,
            signature: true,
            dlb: true,
          },
        },
        bcba: {
          select: {
            name: true,
          },
        },
        entries: {
          orderBy: { date: 'asc' },
          select: {
            date: true,
            startTime: true,
            endTime: true,
            minutes: true,
            notes: true,
          },
        },
      },
    })

    if (!timesheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Generate PDF
    const pdfBuffer = await generateTimesheetPDF({
      id: timesheet.id,
      client: timesheet.client as any,
      provider: timesheet.provider as any,
      bcba: timesheet.bcba,
      startDate: timesheet.startDate,
      endDate: timesheet.endDate,
      isBCBA: timesheet.isBCBA,
      serviceType: timesheet.serviceType || undefined,
      sessionData: timesheet.sessionData || undefined,
      entries: timesheet.entries.map((entry) => ({
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        minutes: entry.minutes,
        notes: entry.notes,
      })),
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="timesheet-${timesheetId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('[TIMESHEET_PDF_ROUTE] Error:', {
      error: error?.message,
      stack: error?.stack,
    })
    
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}
