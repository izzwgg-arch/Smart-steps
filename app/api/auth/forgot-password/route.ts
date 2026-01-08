import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, getPasswordResetEmailHtml, getPasswordResetEmailText } from '@/lib/email'
import { hashToken, generateSecureToken, checkRateLimit } from '@/lib/security'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 5 requests per 15 minutes per IP
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `forgot-password:${clientIp}:${email.toLowerCase().trim()}`
    
    if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Don't reveal if user exists or not (security best practice)
    // Always return success message
    if (!user || user.deletedAt || !user.active) {
      // Still return success to prevent email enumeration
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Generate reset token (plain text for email)
    const resetToken = generateSecureToken(32)
    // Hash token for storage
    const hashedToken = hashToken(resetToken)
    const resetTokenExpiry = new Date()
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1) // Token expires in 1 hour

    // Save hashed token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    })

    // Log audit
    await logAudit('SUBMIT', 'User', user.id, 'system', {
      action: 'password_reset_requested',
      email: user.email,
    })

    // Generate reset link
    const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Smart Steps',
        html: getPasswordResetEmailHtml(resetLink, user.email.split('@')[0]),
        text: getPasswordResetEmailText(resetLink),
      })
    } catch (error) {
      console.error('Failed to send password reset email:', error)
      // Don't fail the request if email fails - token is still saved
      // In production, you might want to handle this differently
    }

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Failed to process password reset request:', error)
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}
