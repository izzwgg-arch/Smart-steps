import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const insurance = await prisma.insurance.findUnique({
      where: { id: params.id },
      include: {
        rateHistory: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    })

    if (!insurance || insurance.deletedAt) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    return NextResponse.json(insurance)
  } catch (error) {
    console.error('Error fetching insurance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance' },
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

    const data = await request.json()
    const { name, ratePerUnit, active } = data

    const existingInsurance = await prisma.insurance.findUnique({
      where: { id: params.id },
    })

    if (!existingInsurance) {
      return NextResponse.json({ error: 'Insurance not found' }, { status: 404 })
    }

    // If rate changed, record in history
    if (ratePerUnit !== undefined && parseFloat(ratePerUnit) !== parseFloat(existingInsurance.ratePerUnit.toString())) {
      // End previous rate period
      await prisma.insuranceRateHistory.updateMany({
        where: {
          insuranceId: params.id,
          effectiveTo: null,
        },
        data: {
          effectiveTo: new Date(),
        },
      })

      // Create new rate period
      await prisma.insuranceRateHistory.create({
        data: {
          insuranceId: params.id,
          ratePerUnit: parseFloat(ratePerUnit),
          effectiveFrom: new Date(),
        },
      })
    }

    const insurance = await prisma.insurance.update({
      where: { id: params.id },
      data: {
        name,
        ratePerUnit: ratePerUnit !== undefined ? parseFloat(ratePerUnit) : existingInsurance.ratePerUnit,
        active,
      },
    })

    return NextResponse.json(insurance)
  } catch (error) {
    console.error('Error updating insurance:', error)
    return NextResponse.json(
      { error: 'Failed to update insurance' },
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

    await prisma.insurance.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json(
      { error: 'Failed to delete insurance' },
      { status: 500 }
    )
  }
}
