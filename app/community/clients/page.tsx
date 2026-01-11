import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { CommunityClientsList } from '@/components/community/CommunityClientsList'
import { canAccessCommunitySection } from '@/lib/permissions'

export default async function CommunityClientsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check Community Classes subsection access
  const hasAccess = await canAccessCommunitySection(session.user.id, 'clients')
  if (!hasAccess) {
    redirect('/community?error=not-authorized')
  }

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <CommunityClientsList />
      </main>
    </div>
  )
}
