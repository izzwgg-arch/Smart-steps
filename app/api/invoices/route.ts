import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { logCreate } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const insuranceId = searchParams.get('insuranceId') || ''

    const where: any = { deletedAt: null }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (insuranceId) {
      where.entries = {
        some: {
          insurance: { id: insuranceId }
        }
      }
    }

    // Users can only see invoices (read-only) unless admin
    // This is enforced at UI level, but we can add DB level if needed

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client: {
            include: { insurance: true },
          },
          entries: {
            include: {
              provider: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { clientId, startDate, endDate, timesheetIds } = data

    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Client, start date, and end date are required' },
        { status: 400 }
      )
    }

    // Find approved timesheets for the client in date range
    const timesheets = await prisma.timesheet.findMany({
      where: {
        clientId,
        status: 'APPROVED',
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
        // Timesheets that are approved/emailed can be invoiced (not locked)
        deletedAt: null,
        ...(timesheetIds && timesheetIds.length > 0
          ? { id: { in: timesheetIds } }
          : {}),
      },
      include: {
        entries: true,
        insurance: true,
        provider: true,
      },
    })

    if (timesheets.length === 0) {
      return NextResponse.json(
        { error: 'No approved timesheets found for the selected period' },
        { status: 400 }
      )
    }

    // Check for existing invoices that might overlap
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        clientId,
        deletedAt: null,
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(startDate) } },
            ],
          },
        ],
      },
    })

    if (existingInvoices.length > 0 && !timesheetIds) {
      return NextResponse.json(
        {
          error:
            'Overlapping invoices exist. Please select specific timesheets or adjust date range.',
        },
        { status: 400 }
      )
    }

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count()
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
      invoiceCount + 1
    ).padStart(5, '0')}`

    // Calculate totals
    let totalAmount = new Decimal(0)
    const invoiceEntries: any[] = []

    for (const timesheet of timesheets) {
      // Skip BCBA timesheets (they don't have insurance)
      if (!timesheet.insurance || timesheet.isBCBA) {
        continue
      }

      const rate = parseFloat(timesheet.insurance.ratePerUnit.toString())

      for (const entry of timesheet.entries) {
        const amount = new Decimal(entry.units.toString()).times(rate)
        totalAmount = totalAmount.plus(amount)

        invoiceEntries.push({
          timesheetId: timesheet.id,
          providerId: timesheet.providerId,
          insuranceId: timesheet.insuranceId!,
          units: entry.units,
          rate: rate,
          amount: amount,
        })
      }
    }

    // Create invoice
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalAmount,
          paidAmount: new Decimal(0),
          adjustments: new Decimal(0),
          outstanding: totalAmount,
          status: 'DRAFT',
          createdBy: session.user.id,
          entries: {
            create: invoiceEntries,
          },
        },
        include: {
          client: true,
          entries: {
            include: {
              provider: true,
              timesheet: true,
            },
          },
        },
      })

      // Mark all timesheet entries as invoiced
      const timesheetEntryIds = timesheets.flatMap(ts => ts.entries.map((e: any) => e.id))
      await tx.timesheetEntry.updateMany({
        where: {
          id: { in: timesheetEntryIds },
        },
        data: {
          invoiced: true,
        },
      })

      // Lock timesheets
      await tx.timesheet.updateMany({
        where: {
          id: { in: timesheets.map((t) => t.id) },
        },
        data: {
          // Status remains APPROVED - invoice tracking is handled via invoiceEntries
        },
      })

      return newInvoice
    })

    // Log audit
    await logCreate('Invoice', invoice.id, session.user.id, {
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      totalAmount: invoice.totalAmount.toString(),
      timesheetCount: timesheets.length,
    })

    // Timesheet locking removed - invoice tracking handled via invoiceEntries

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
