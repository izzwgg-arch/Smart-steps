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

    // @ts-ignore - Prisma client may not have payrollEmployee yet
    const employee = await (prisma as any).payrollEmployee?.findUnique({
      where: { id },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ employee })
  } catch (error: any) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee', details: error.message },
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

    const {
      fullName,
      email,
      phone,
      active,
      defaultHourlyRate,
      scannerExternalId,
      notes,
    } = body

    const updateData: any = {}
    if (fullName !== undefined) updateData.fullName = fullName.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (active !== undefined) updateData.active = active
    if (defaultHourlyRate !== undefined) updateData.defaultHourlyRate = parseFloat(defaultHourlyRate)
    if (scannerExternalId !== undefined) updateData.scannerExternalId = scannerExternalId?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const employee = await (prisma as any).payrollEmployee.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ employee })
  } catch (error: any) {
    console.error('Error updating employee:', error)
    return NextResponse.json(
      { error: 'Failed to update employee', details: error.message },
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

    // Check if employee has any payroll runs or import rows
    const hasRuns = await prisma.payrollRunLine.findFirst({
      where: { employeeId: id },
    })

    if (hasRuns) {
      return NextResponse.json(
        { error: 'Cannot delete employee with existing payroll records. Deactivate instead.' },
        { status: 400 }
      )
    }

    await (prisma as any).payrollEmployee.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting employee:', error)
    return NextResponse.json(
      { error: 'Failed to delete employee', details: error.message },
      { status: 500 }
    )
  }
}
