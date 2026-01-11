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
  
  const method = request.method
  const pathname = request.nextUrl.pathname
  
  console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} ==== REQUEST START ====`)
  console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Method: ${method}, Pathname: ${pathname}`)
  
  try {
    session = await getServerSession(authOptions)
    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Session present: ${!!session}, User ID: ${session?.user?.id || 'N/A'}`)
    
    if (!session) {
      console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Unauthorized - returning 401 JSON (NO REDIRECT)`)
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

    // PHASE 4: Verify PDF size and content
    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} PDF generated, bytes=${pdfBuffer.length}`)
    
    if (pdfBuffer.length < 10000) {
      console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} ERROR: PDF is too small (<10KB), likely empty or error document`)
      return NextResponse.json(
        { error: 'PDF generation failed: PDF is too small', correlationId },
        { status: 500 }
      )
    }

    // Verify PDF starts with %PDF
    const pdfHeader = pdfBuffer.slice(0, 4).toString('ascii')
    const first16Bytes = pdfBuffer.slice(0, 16).toString('hex')
    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} PDF header check: "${pdfHeader}" (expected: "%PDF")`)
    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} First 16 bytes (hex): ${first16Bytes}`)

    if (pdfHeader !== '%PDF') {
      console.error(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} ERROR: PDF does not start with %PDF! First 20 bytes:`, pdfBuffer.slice(0, 20).toString('hex'))
      return NextResponse.json(
        { error: 'Invalid PDF generated', correlationId },
        { status: 500 }
      )
    }

    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} PDF generated OK, bytes=${pdfBuffer.length} (>10KB)`)
    console.log(`[BCBA_TIMESHEET_PDF_ROUTE] ${correlationId} Returning response: Status=200, Content-Type=application/pdf`)

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
