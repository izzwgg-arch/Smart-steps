import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCommunitySection } from '@/lib/permissions'

/**
 * REMOVE ITEM FROM COMMUNITY EMAIL QUEUE
 * 
 * Removes an invoice from the email queue without deleting the invoice itself.
 * Permission: community.invoices.emailqueue.send (same as sending)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)

    // Check Community Classes subsection permission
    const hasAccess = await canAccessCommunitySection(session.user.id, 'emailQueue')
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden - No access to Community Classes Email Queue' },
        { status: 403 }
      )
    }

    // Find the queue item
    const queueItem = await prisma.emailQueueItem.findUnique({
      where: { id: resolvedParams.id },
    })

    if (!queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }

    // Only allow removal of QUEUED items (not SENDING, SENT, or FAILED)
    if (queueItem.status !== 'QUEUED') {
      return NextResponse.json(
        { error: `Cannot remove item with status ${queueItem.status}. Only QUEUED items can be removed.` },
        { status: 400 }
      )
    }

    // Ensure it's a community invoice queue item
    if (queueItem.entityType !== 'COMMUNITY_INVOICE') {
      return NextResponse.json(
        { error: 'Invalid queue item type' },
        { status: 400 }
      )
    }

    // Delete the queue item (does not delete the invoice)
    await prisma.emailQueueItem.delete({
      where: { id: resolvedParams.id },
    })

    // Optionally update the invoice status back to APPROVED (not QUEUED)
    // This is optional - the invoice status can remain as is
    await prisma.communityInvoice.updateMany({
      where: {
        id: queueItem.entityId,
        status: 'QUEUED',
      },
      data: {
        status: 'APPROVED',
        queuedAt: null,
      },
    })

    return NextResponse.json({ success: true, message: 'Item removed from queue' })
  } catch (error: any) {
    console.error('[COMMUNITY EMAIL QUEUE REMOVE] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to remove item from queue',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
