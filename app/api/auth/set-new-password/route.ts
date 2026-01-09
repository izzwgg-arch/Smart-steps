import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Validate password
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify user must change password
    if (!user.mustChangePassword) {
      return NextResponse.json(
        { error: 'Password change is not required for this account' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password, clear temp password fields, and clear mustChangePassword flag
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tempPasswordHash: null,
        tempPasswordExpiresAt: null,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })

    // Log audit
    await createAuditLog({
      action: 'USER_PASSWORD_SET' as any,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      newValues: {
        action: 'password_set',
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      message: 'Password set successfully',
    })
  } catch (error) {
    console.error('Failed to set password:', error)
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    )
  }
}
