import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { ReportsGenerator } from '@/components/reports/ReportsGenerator'
import { prisma } from '@/lib/prisma'
import { canAccessRoute } from '@/lib/permissions'

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Check route access based on dashboard visibility
  const hasAccess = await canAccessRoute(session.user.id, '/reports')
  if (!hasAccess) {
    redirect('/dashboard?error=not-authorized')
  }

  // Get filter options
  const [providers, clients, insurances, bcbas] = await Promise.all([
    prisma.provider.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.insurance.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.bCBA.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports</h1>
          <ReportsGenerator
            providers={providers}
            clients={clients}
            insurances={insurances}
            bcbas={bcbas}
          />
        </div>
      </main>
    </div>
  )
}

