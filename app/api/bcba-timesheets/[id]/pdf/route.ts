import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTimesheetPDFFromId } from '@/lib/pdf/timesheetPDFGenerator'
import { getUserPermissions } from '@/lib/permissions'
import { randomBytes } from 'crypto'

// Ensure Node.js runtime (not Edge)
export const runtime = 'nodejs'

/**
 * GET /api/bcba-timesheets/[id]/pdf
 * 
 * Authenticated route for downloading BCBA Timesheet PDF
 * Requires authentication and timesheet view permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const correlationId = `pdf-bcba-${Date.now()}-${randomBytes(4).toString('hex')}`
  let session: any = null
  
  try {
    session = await getServerSession(authOptions)
    if (!session) {
      console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Unauthorized`)
      return NextResponse.json({ error: 'Unauthorized', correlationId }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const timesheetId = resolvedParams.id

    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Request received`, {
      timesheetId,
      userId: session.user.id,
      userRole: session.user.role,
    })

    // Check permissions
    const userPermissions = await getUserPermissions(session.user.id)
    const canView = 
      userPermissions['timesheets.view']?.canView === true ||
      session.user.role === 'SUPER_ADMIN' ||
      session.user.role === 'ADMIN'

    if (!canView) {
      console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Permission denied`, {
        userId: session.user.id,
        userRole: session.user.role,
      })
      return NextResponse.json(
        { error: 'Forbidden - Not authorized to view timesheets', correlationId },
        { status: 403 }
      )
    }

    // Generate PDF using shared function (same for both regular and BCBA)
    const pdfBuffer = await generateTimesheetPDFFromId(timesheetId, prisma, correlationId)

    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} PDF generated successfully`, {
      timesheetId,
      size: pdfBuffer.length,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bcba-timesheet-${timesheetId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Error:`, {
      timesheetId: (await Promise.resolve(params)).id,
      userId: session?.user?.id,
      userRole: session?.user?.role,
      error: error?.message,
      stack: error?.stack,
    })
    
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: error.message, correlationId },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        correlationId,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
