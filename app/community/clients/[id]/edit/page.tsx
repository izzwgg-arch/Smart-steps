import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { CommunityClientForm } from '@/components/community/CommunityClientForm'
import { prisma } from '@/lib/prisma'

export default async function EditCommunityClientPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedParams = await Promise.resolve(params)
  const client = await prisma.communityClient.findUnique({
    where: { id: resolvedParams.id },
  })

  if (!client || client.deletedAt) {
    redirect('/community/clients')
  }

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <CommunityClientForm client={client} />
      </main>
    </div>
  )
}
