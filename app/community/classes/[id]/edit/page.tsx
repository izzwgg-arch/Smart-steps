import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { CommunityClassForm } from '@/components/community/CommunityClassForm'
import { prisma } from '@/lib/prisma'

export default async function EditCommunityClassPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedParams = await Promise.resolve(params)
  const classItem = await prisma.communityClass.findUnique({
    where: { id: resolvedParams.id },
  })

  if (!classItem || classItem.deletedAt) {
    redirect('/community/classes')
  }

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <CommunityClassForm classItem={{
          id: classItem.id,
          name: classItem.name,
          ratePerUnit: classItem.ratePerUnit.toNumber(),
          isActive: classItem.isActive ?? true,
        }} />
      </main>
    </div>
  )
}
