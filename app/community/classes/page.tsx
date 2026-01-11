import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { CommunityClassesList } from '@/components/community/CommunityClassesList'
import { canAccessCommunitySection } from '@/lib/permissions'

export default async function CommunityClassesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check Community Classes subsection access
  const hasAccess = await canAccessCommunitySection(session.user.id, 'classes')
  if (!hasAccess) {
    redirect('/community?error=not-authorized')
  }

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <CommunityClassesList />
      </main>
    </div>
  )
}
