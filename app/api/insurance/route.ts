import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const insurances = await prisma.insurance.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(insurances)
  } catch (error) {
    console.error('Error fetching insurance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, ratePerUnit, active } = data

    if (!name || ratePerUnit === undefined || ratePerUnit === null) {
      return NextResponse.json(
        { error: 'Name and rate per unit are required' },
        { status: 400 }
      )
    }

    // Create insurance
    const insurance = await prisma.insurance.create({
      data: {
        name,
        ratePerUnit: parseFloat(ratePerUnit),
        active: active !== undefined ? active : true,
      },
    })

    // Record rate history
    await prisma.insuranceRateHistory.create({
      data: {
        insuranceId: insurance.id,
        ratePerUnit: parseFloat(ratePerUnit),
        effectiveFrom: new Date(),
      },
    })

    return NextResponse.json(insurance, { status: 201 })
  } catch (error) {
    console.error('Error creating insurance:', error)
    return NextResponse.json(
      { error: 'Failed to create insurance' },
      { status: 500 }
    )
  }
}
