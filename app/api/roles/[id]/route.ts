import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logUpdate, logDelete } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        dashboardVisibility: true,
        _count: {
          select: { users: true }
        }
      }
    })

    if (!role || role.deletedAt) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role' },
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
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, description, active, permissions, dashboardVisibility } = data

    const existing = await prisma.role.findUnique({
      where: { id: params.id }
    })

    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Update role
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (active !== undefined) updateData.active = active

    const role = await prisma.role.update({
      where: { id: params.id },
      data: updateData
    })

    // Update permissions if provided
    if (permissions) {
      // Delete existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: params.id }
      })

      // Create new permissions
      await prisma.rolePermission.createMany({
        data: permissions.map((p: any) => ({
          roleId: params.id,
          permissionId: p.permissionId,
          canView: p.canView || false,
          canCreate: p.canCreate || false,
          canUpdate: p.canUpdate || false,
          canDelete: p.canDelete || false,
          canApprove: p.canApprove || false,
          canExport: p.canExport || false,
        }))
      })
    }

    // Update dashboard visibility if provided
    if (dashboardVisibility) {
      // Delete existing visibility settings
      await prisma.roleDashboardVisibility.deleteMany({
        where: { roleId: params.id }
      })

      // Create new visibility settings
      await prisma.roleDashboardVisibility.createMany({
        data: dashboardVisibility.map((dv: any) => ({
          roleId: params.id,
          section: dv.section,
          visible: dv.visible || false,
        }))
      })
    }

    await logUpdate('Role', role.id, session.user.id, {}, {
      name: name || existing.name,
      description: description !== undefined ? description : existing.description,
    })

    const updated = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        dashboardVisibility: true
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Failed to update role' },
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
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    if (!role || role.deletedAt) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Check if role is in use
    if (role._count.users > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role that is assigned to users' },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.role.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        active: false
      }
    })

    await logDelete('Role', params.id, session.user.id, {
      name: role.name
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    )
  }
}
