import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/utils'
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

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        active: true,
        activationStart: true,
        activationEnd: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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
    const {
      username,
      email,
      password,
      role,
      active,
      activationStart,
      activationEnd,
    } = data

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser || existingUser.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}

    if (username !== undefined) {
      // Check if username is being changed and if it's already taken
      if (username !== existingUser.username) {
        const usernameTaken = await prisma.user.findUnique({
          where: { username },
        })

        if (usernameTaken && !usernameTaken.deletedAt) {
          return NextResponse.json(
            { error: 'Username already in use' },
            { status: 400 }
          )
        }
        updateData.username = username
      }
    }

    if (email !== undefined) {
      // Check if email is being changed and if it's already taken
      if (email !== existingUser.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email },
        })

        if (emailTaken && !emailTaken.deletedAt) {
          return NextResponse.json(
            { error: 'Email already in use' },
            { status: 400 }
          )
        }
        updateData.email = email
      }
    }

    if (password !== undefined && password !== '') {
      // Validate password if provided
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: passwordValidation.errors.join(', ') },
          { status: 400 }
        )
      }
      updateData.password = await bcrypt.hash(password, 10)
    }

    if (role !== undefined) {
      updateData.role = role
      if (role === 'CUSTOM' && data.customRoleId) {
        updateData.customRoleId = data.customRoleId
      } else if (role !== 'CUSTOM') {
        updateData.customRoleId = null
      }
    }

    if (active !== undefined) {
      updateData.active = active
    }

    if (activationStart !== undefined) {
      updateData.activationStart = activationStart ? new Date(activationStart) : null
    }

    if (activationEnd !== undefined) {
      updateData.activationEnd = activationEnd ? new Date(activationEnd) : null
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
          }
        },
        active: true,
        activationStart: true,
        activationEnd: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Log audit (only log changed fields)
    const oldValues: Record<string, any> = {}
    const newValues: Record<string, any> = {}
    
    if (email !== undefined && email !== existingUser.email) {
      oldValues.email = existingUser.email
      newValues.email = email
    }
    if (role !== undefined && role !== existingUser.role) {
      oldValues.role = existingUser.role
      newValues.role = role
    }
    if (active !== undefined && active !== existingUser.active) {
      oldValues.active = existingUser.active
      newValues.active = active
    }
    if (password !== undefined && password !== '') {
      newValues.passwordChanged = true
    }

    if (Object.keys(newValues).length > 0) {
      await logUpdate('User', user.id, session.user.id, oldValues, newValues)
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
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

    // Prevent deleting yourself
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!user || user.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.user.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    })

    // Log audit
    await logDelete('User', params.id, session.user.id, {
      email: user.email,
      role: user.role,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
