import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { isWithinScheduledWindow } from './utils'
import { logAudit } from './audit'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user || user.deletedAt) {
          throw new Error('Invalid credentials')
        }

        if (!user.active) {
          throw new Error('Account is inactive')
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
          throw new Error(`Account is locked. Please try again in ${minutesLeft} minute(s).`)
        }

        // Check scheduled activation window
        if (!isWithinScheduledWindow(user.activationStart, user.activationEnd)) {
          throw new Error('Account access is outside scheduled window')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          // Increment failed login attempts
          const failedAttempts = (user.failedLoginAttempts || 0) + 1
          const maxAttempts = 5
          const lockDuration = 30 * 60 * 1000 // 30 minutes

          let updateData: any = {
            failedLoginAttempts: failedAttempts,
          }

          // Lock account after max attempts
          if (failedAttempts >= maxAttempts) {
            updateData.lockedUntil = new Date(Date.now() + lockDuration)
            await logAudit('SUBMIT', 'User', user.id, 'system', {
              action: 'account_locked',
              reason: 'too_many_failed_login_attempts',
              email: user.email,
            })
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })

          // Log failed login attempt
          await logAudit('SUBMIT', 'User', user.id, 'system', {
            action: 'failed_login_attempt',
            email: user.email,
            attempts: failedAttempts,
          })

          throw new Error('Invalid credentials')
        }

        // Reset failed login attempts on successful login
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          })
        }

        // Log successful login
        await logAudit('SUBMIT', 'User', user.id, user.id, {
          action: 'login_success',
          email: user.email,
        })

        return {
          id: user.id,
          email: user.email,
          role: user.role as any, // NextAuth type compatibility
          mustChangePassword: user.mustChangePassword || false,
        } as any
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.mustChangePassword = (user as any).mustChangePassword || false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as any
        session.user.id = token.id as string
        ;(session.user as any).mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    },
  },
}
