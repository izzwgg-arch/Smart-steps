import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await Promise.resolve(params)

    const payrollImport = await prisma.payrollImport.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        rows: {
          orderBy: { rowIndex: 'asc' },
          include: {
            linkedEmployee: {
              select: {
                id: true,
                fullName: true,
                scannerExternalId: true,
              },
            },
          },
        },
      },
    })

    if (!payrollImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    return NextResponse.json({ import: payrollImport })
  } catch (error: any) {
    console.error('Error fetching import:', error)
    return NextResponse.json(
      { error: 'Failed to fetch import', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await Promise.resolve(params)
    const body = await request.json()
    const { status, periodStart, periodEnd } = body

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (periodStart !== undefined) updateData.periodStart = periodStart ? new Date(periodStart) : null
    if (periodEnd !== undefined) updateData.periodEnd = periodEnd ? new Date(periodEnd) : null

    const payrollImport = await prisma.payrollImport.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ import: payrollImport })
  } catch (error: any) {
    console.error('Error updating import:', error)
    return NextResponse.json(
      { error: 'Failed to update import', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await Promise.resolve(params)

    // Check if import exists
    const payrollImport = await prisma.payrollImport.findUnique({
      where: { id },
      include: {
        runs: {
          select: { id: true },
        },
      },
    })

    if (!payrollImport) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 })
    }

    // Check if import is used in any payroll runs
    if (payrollImport.runs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete import that is used in payroll runs. Please delete the associated payroll runs first.' },
        { status: 400 }
      )
    }

    // Delete import (rows will be cascade deleted per Prisma schema)
    await prisma.payrollImport.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Import deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting import:', error)
    return NextResponse.json(
      { error: 'Failed to delete import', details: error.message },
      { status: 500 }
    )
  }
}
