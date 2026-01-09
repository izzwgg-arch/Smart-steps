import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePassword } from '@/lib/utils'
import { logCreate } from '@/lib/audit'
import { generateTemporaryPassword } from '@/lib/security'
import { sendMailSafe, getNewUserInviteEmailHtml, getNewUserInviteEmailText } from '@/lib/email'
import { generateSecureToken } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const active = searchParams.get('active')

    const where: any = { deletedAt: null }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role) {
      where.role = role
    }

    if (active !== null && active !== undefined && active !== '') {
      where.active = active === 'true'
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    if (!username || !email) {
      return NextResponse.json(
        { error: 'Username and email are required' },
        { status: 400 }
      )
    }

    // Always use temp password for new users (password field is not used in UI)
    // Admin does not enter password - system generates temp password
    const tempPassword = generateTemporaryPassword()
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10)
    
    // Set temp password expiration (72 hours from now)
    const tempPasswordExpiresAt = new Date()
    const ttlHours = parseInt(process.env.TEMP_PASSWORD_TTL_HOURS || '72')
    tempPasswordExpiresAt.setHours(tempPasswordExpiresAt.getHours() + ttlHours)
    
    // Create a placeholder password hash (user must set password on first login)
    // This prevents login until password is set
    const placeholderPassword = await bcrypt.hash(generateSecureToken(32), 10)

    // Check if user already exists by username or email
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUserByUsername && !existingUserByUsername.deletedAt) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUserByEmail && !existingUserByEmail.deletedAt) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Create user with temp password
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: placeholderPassword, // Placeholder - cannot login with this
        tempPasswordHash: tempPasswordHash, // Actual temp password for first login
        tempPasswordExpiresAt: tempPasswordExpiresAt,
        role: role || 'USER',
        customRoleId: role === 'CUSTOM' && data.customRoleId ? data.customRoleId : null,
        active: active !== undefined ? active : true,
        activationStart: activationStart ? new Date(activationStart) : null,
        activationEnd: activationEnd ? new Date(activationEnd) : null,
        mustChangePassword: true, // Always force password change on first login
      },
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

    // Log audit (do NOT log temp password)
    await logCreate('User', user.id, session.user.id, {
      email: user.email,
      role: user.role,
      active: user.active,
      mustChangePassword: true,
      tempPasswordGenerated: true, // Only log that temp password was generated, not the password itself
    })

    // Send invite email with temp password
    try {
      const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://66.94.105.43:3000'
      const loginUrl = `${baseUrl}/login`
      
      await sendMailSafe({
        to: user.email,
        subject: 'Your Smart Steps ABA temporary password',
        html: getNewUserInviteEmailHtml(user.email, tempPassword, loginUrl, user.username),
        text: getNewUserInviteEmailText(user.email, tempPassword, loginUrl),
      }, {
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        userId: session.user.id,
      })

      // Log email sent (do NOT log temp password)
      await logCreate('User', user.id, session.user.id, {
        action: 'invite_email_sent',
        email: user.email,
      })
    } catch (error) {
      console.error('Failed to send invite email:', error)
      // Don't fail user creation if email fails
    }

    // Don't return temp password in response
    const userResponse = { ...user }
    delete (userResponse as any).password

    return NextResponse.json(userResponse, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
