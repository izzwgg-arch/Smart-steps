import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateUnits } from '@/lib/utils'
import { detectTimesheetOverlaps } from '@/lib/server/timesheetOverlapValidation'
import { startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns'

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

    const where: any = { deletedAt: null }
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (search) {
      where.OR = [
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { provider: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (status) {
      where.status = status
    }

    if (startDate) {
      where.endDate = { gte: new Date(startDate) }
    }

    if (endDate) {
      where.startDate = { lte: new Date(endDate) }
    }

    // Users can only see their own timesheets unless admin
    if (session.user.role !== 'ADMIN') {
      where.userId = session.user.id
    }

    const [timesheets, total] = await Promise.all([
      prisma.timesheet.findMany({
        where,
        include: {
          client: true,
          provider: true,
          bcba: true,
          insurance: true,
          entries: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.timesheet.count({ where }),
    ])

    return NextResponse.json({
      timesheets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching timesheets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timesheets' },
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
    const {
      providerId,
      clientId,
      bcbaId,
      insuranceId,
      startDate,
      endDate,
      timezone,
      entries,
    } = data

    // Validation
    if (!providerId || !clientId || !bcbaId || !insuranceId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Verify entities are active
    const [provider, client, insurance] = await Promise.all([
      prisma.provider.findUnique({ where: { id: providerId } }),
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.insurance.findUnique({ where: { id: insuranceId } }),
    ])

    if (!provider?.active || !client?.active || !insurance?.active) {
      return NextResponse.json(
        { error: 'Provider, Client, and Insurance must be active' },
        { status: 400 }
      )
    }

    // Validate entries
    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: 'At least one entry is required' },
        { status: 400 }
      )
    }

    // Validate entry format and times
    for (const entry of entries) {
      if (!entry.date || !entry.startTime || !entry.endTime) {
        return NextResponse.json(
          { error: 'Each entry must have date, startTime, and endTime' },
          { status: 400 }
        )
      }

      // Validate time format (HH:mm)
      const timeFormat = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/
      if (!timeFormat.test(entry.startTime) || !timeFormat.test(entry.endTime)) {
        return NextResponse.json(
          { error: `Invalid time format. Expected HH:mm, got startTime: ${entry.startTime}, endTime: ${entry.endTime}` },
          { status: 400 }
        )
      }

      // Validate time range (end > start)
      const [startH, startM] = entry.startTime.split(':').map(Number)
      const [endH, endM] = entry.endTime.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (endMinutes <= startMinutes) {
        return NextResponse.json(
          { error: `End time must be after start time. Got ${entry.startTime} - ${entry.endTime}` },
          { status: 400 }
        )
      }

      const calculatedMinutes = endMinutes - startMinutes

      // Validate minutes matches calculated duration (allow small rounding differences)
      if (Math.abs(entry.minutes - calculatedMinutes) > 1) {
        return NextResponse.json(
          { error: `Minutes mismatch. Expected ${calculatedMinutes}, got ${entry.minutes}` },
          { status: 400 }
        )
      }

      if (!entry.minutes || entry.minutes <= 0) {
        return NextResponse.json(
          { error: 'Minutes must be greater than 0' },
          { status: 400 }
        )
      }
    }

    // Overlap validation (provider OR client OR both)
    const overlapConflicts = await detectTimesheetOverlaps({
      providerId,
      clientId,
      providerName: provider.name,
      clientName: client.name,
      entries,
    })

    if (overlapConflicts.length > 0) {
      return NextResponse.json(
        { error: 'Overlap conflicts detected', code: 'OVERLAP_CONFLICT', conflicts: overlapConflicts },
        { status: 400 }
      )
    }

    // Create timesheet
    const timesheet = await prisma.timesheet.create({
      data: {
        userId: session.user.id,
        providerId,
        clientId,
        bcbaId,
        insuranceId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timezone: timezone || 'America/New_York',
        status: 'DRAFT',
        lastEditedBy: session.user.id,
        lastEditedAt: new Date(),
        entries: {
          create: entries.map((entry: any) => {
            // Calculate units (1 unit = 15 minutes, no rounding)
            const units = entry.minutes / 15
            
            return {
              date: new Date(entry.date),
              startTime: entry.startTime, // Already validated as HH:mm
              endTime: entry.endTime, // Already validated as HH:mm
              minutes: entry.minutes, // Store actual minutes
              units: units, // Store units (1 unit = 15 minutes)
              notes: entry.notes || null,
              invoiced: entry.invoiced || false,
            }
          }),
        },
      },
      include: {
        client: true,
        provider: true,
        bcba: true,
        insurance: true,
        entries: true,
      },
    })

    return NextResponse.json(timesheet, { status: 201 })
  } catch (error) {
    console.error('Error creating timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to create timesheet' },
      { status: 500 }
    )
  }
}
