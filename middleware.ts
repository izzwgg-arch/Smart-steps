import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// The canonical public URL of the app. Used to build correct redirect URLs
// regardless of what the Edge Runtime derives from proxy headers.
const APP_URL = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://app.smartstepsabapc.org'

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect unauthenticated users to /login using the correct public URL
    if (!token) {
      const loginUrl = new URL('/login', APP_URL)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // If user must change password, redirect to set-new-password page
    // Allow access to set-new-password, logout, and API routes
    if (
      (token as any).mustChangePassword &&
      pathname !== '/set-new-password' &&
      !pathname.startsWith('/api/auth/signout') &&
      !pathname.startsWith('/api/auth/set-new-password') &&
      !pathname.startsWith('/api/auth/log-activity')
    ) {
      return NextResponse.redirect(new URL('/set-new-password', APP_URL))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Always return true so our middleware function above handles the redirect
      // with the correct APP_URL, instead of NextAuth guessing the origin from
      // proxy headers (which caused redirects to localhost:3000).
      authorized: () => true,
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - api/public (public API routes - NO AUTH REQUIRED)
     * - public (public pages - NO AUTH REQUIRED)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - set-new-password (to prevent redirect loops)
     * - login (to allow login)
     * - forgot-password (to allow password reset)
     * - reset-password (to allow password reset)
     */
    '/((?!api/auth|api/public|public|portal/sign|_next/static|_next/image|favicon.ico|set-new-password|login|forgot-password|reset-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
