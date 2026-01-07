import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateUnits } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        provider: true,
        bcba: true,
        insurance: true,
        entries: {
          orderBy: { date: 'asc' },
        },
        user: true,
      },
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Users can only view their own timesheets unless admin
    if (session.user.role !== 'ADMIN' && timesheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(timesheet)
  } catch (error) {
    console.error('Error fetching timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timesheet' },
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Only DRAFT timesheets can be edited
    if (timesheet.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft timesheets can be edited' },
        { status: 400 }
      )
    }

    // Users can only edit their own timesheets unless admin
    if (session.user.role !== 'ADMIN' && timesheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const { entries, ...timesheetData } = data

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

      // Validate minutes matches calculated duration
      const calculatedMinutes = endMinutes - startMinutes
      if (entry.minutes !== calculatedMinutes) {
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

    // Update timesheet
    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing entries
      await tx.timesheetEntry.deleteMany({
        where: { timesheetId: params.id },
      })

      // Update timesheet
      const updatedTimesheet = await tx.timesheet.update({
        where: { id: params.id },
        data: {
          ...timesheetData,
          entries: {
            create: entries.map((entry: any) => ({
              date: new Date(entry.date),
              startTime: entry.startTime, // Already validated as HH:mm
              endTime: entry.endTime, // Already validated as HH:mm
              minutes: entry.minutes, // Already validated
              units: calculateUnits(entry.minutes),
              notes: entry.notes || null,
            })),
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

      return updatedTimesheet
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to update timesheet' },
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
    })

    if (!timesheet || timesheet.deletedAt) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }

    // Only DRAFT timesheets can be deleted
    if (timesheet.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft timesheets can be deleted' },
        { status: 400 }
      )
    }

    // Users can only delete their own timesheets unless admin
    if (session.user.role !== 'ADMIN' && timesheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.timesheet.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting timesheet:', error)
    return NextResponse.json(
      { error: 'Failed to delete timesheet' },
      { status: 500 }
    )
  }
}
