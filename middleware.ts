import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // If user must change password, redirect to change-password page
    // Allow access to change-password, logout, and API routes
    if (
      token &&
      (token as any).mustChangePassword &&
      pathname !== '/change-password' &&
      !pathname.startsWith('/api/auth/signout') &&
      !pathname.startsWith('/api/auth/change-password')
    ) {
      return NextResponse.redirect(new URL('/change-password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
