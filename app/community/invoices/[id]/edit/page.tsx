import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { CommunityInvoiceForm } from '@/components/community/CommunityInvoiceForm'
import { prisma } from '@/lib/prisma'

export default async function EditCommunityInvoicePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedParams = await Promise.resolve(params)
  const invoice = await prisma.communityInvoice.findUnique({
    where: { id: resolvedParams.id },
  })

  if (!invoice || invoice.deletedAt) {
    redirect('/community/invoices')
  }

  // Only allow editing DRAFT invoices
  if (invoice.status !== 'DRAFT') {
    redirect('/community/invoices')
  }

  return (
    <div className="min-h-screen">
      <DashboardNav userRole={session.user.role} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <CommunityInvoiceForm invoice={{
          id: invoice.id,
          clientId: invoice.clientId,
          classId: invoice.classId,
          units: invoice.units,
          serviceDate: invoice.serviceDate?.toISOString().split('T')[0] || null,
          notes: invoice.notes || null,
        }} />
      </main>
    </div>
  )
}
