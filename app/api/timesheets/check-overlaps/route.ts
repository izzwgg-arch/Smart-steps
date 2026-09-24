import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectTimesheetOverlaps } from '@/lib/server/timesheetOverlapValidation'

/**
 * POST /api/timesheets/check-overlaps
 * Check for overlaps before saving a timesheet
 * Used by frontend to validate in real-time
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const {
      providerId,
      clientId,
      bcbaId, // Required for BCBA timesheets: the BCBA delivering the service
      entries,
      excludeTimesheetId, // Optional: exclude current timesheet when editing
      isBCBA, // True when checking a BCBA timesheet
    } = data

    // Both timesheet types are checked now. A BCBA timesheet has no real provider
    // (the stored providerId is a placeholder), so it needs clientId + bcbaId instead.
    if (!clientId || !entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'clientId and entries array are required' },
        { status: 400 }
      )
    }
    if (isBCBA === true ? !bcbaId : !providerId) {
      return NextResponse.json(
        {
          error: isBCBA === true
            ? 'bcbaId is required for BCBA timesheets'
            : 'providerId is required',
        },
        { status: 400 }
      )
    }

    // Fetch names for error messages
    const { prisma } = await import('@/lib/prisma')
    const [provider, client, bcba] = await Promise.all([
      providerId
        ? prisma.provider.findUnique({ where: { id: providerId }, select: { name: true } })
        : Promise.resolve(null),
      prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }),
      bcbaId
        ? prisma.bCBA.findUnique({ where: { id: bcbaId }, select: { name: true } })
        : Promise.resolve(null),
    ])

    if (!client || (isBCBA === true ? !bcba : !provider)) {
      return NextResponse.json(
        { error: 'Provider, BCBA or Client not found' },
        { status: 404 }
      )
    }

    // Check for overlaps
    const overlapConflicts = await detectTimesheetOverlaps({
      providerId: providerId || '',
      clientId,
      providerName: provider?.name || '',
      clientName: client.name,
      entries,
      excludeTimesheetId,
      isBCBA: isBCBA === true,
      bcbaId,
      bcbaName: bcba?.name,
    })

    return NextResponse.json({
      hasOverlaps: overlapConflicts.length > 0,
      conflicts: overlapConflicts,
    })
  } catch (error) {
    console.error('Error checking overlaps:', error)
    return NextResponse.json(
      { error: 'Failed to check overlaps' },
      { status: 500 }
    )
  }
}
