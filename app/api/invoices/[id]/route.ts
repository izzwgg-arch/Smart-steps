import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        client: {
          include: { insurance: true },
        },
        entries: {
          include: {
            provider: true,
            timesheet: {
              include: {
                entries: true,
                bcba: true,
              },
            },
          },
        },
        timesheets: {
          select: {
            id: true,
            timesheetNumber: true,
            isBCBA: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        adjustmentsList: {
          orderBy: { createdAt: 'desc' },
        },
        creator: {
          select: { email: true },
        },
      },
    })

    if (!invoice || invoice.deletedAt) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    })

    if (!invoice || invoice.deletedAt) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Only DRAFT and READY invoices can be edited
    if (!['DRAFT', 'READY'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Only draft or ready invoices can be edited' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { status, checkNumber, notes } = data

    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: status || invoice.status,
        checkNumber: checkNumber !== undefined ? checkNumber : invoice.checkNumber,
        notes: notes !== undefined ? notes : invoice.notes,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    })

    if (!invoice || invoice.deletedAt) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Only DRAFT invoices can be deleted
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted' },
        { status: 400 }
      )
    }

    await prisma.invoice.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}
