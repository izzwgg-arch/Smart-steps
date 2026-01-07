import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/DashboardNav'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { getUserPermissions, canSeeDashboardSection } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import {
  BarChart3,
  Users,
  UserCheck,
  Calendar,
  FileText,
  FileCheck,
  Shield,
  Receipt,
} from 'lucide-react'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Get user permissions for dashboard visibility control
  const userPermissions = await getUserPermissions(session.user.id)
  
  // Get user with customRoleId to check dashboard visibility
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { customRoleId: true },
  })
  
  // Get dashboard section visibility for custom roles
  let dashboardVisibility: Record<string, boolean> = {}
  if (session.user.role === 'CUSTOM' && user?.customRoleId) {
    const roleVisibility = await prisma.roleDashboardVisibility.findMany({
      where: { roleId: user.customRoleId },
    })
    roleVisibility.forEach(v => {
      dashboardVisibility[v.section] = v.visible
    })
  }
  
  // Helper to check if a dashboard section is visible
  const isSectionVisible = (section: string): boolean => {
    if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN') {
      return true
    }
    return dashboardVisibility[section] === true
  }

  const cards = [
    {
      title: 'Analytics',
      description: 'View detailed analytics and reports',
      href: '/analytics',
      icon: BarChart3,
      color: 'bg-blue-500',
      permissionKey: 'dashboard.analytics',
    },
    {
      title: 'Providers',
      description: 'Manage provider information',
      href: '/providers',
      icon: Users,
      color: 'bg-green-500',
      permissionKey: 'dashboard.providers',
    },
    {
      title: 'Clients',
      description: 'Track client details and activities',
      href: '/clients',
      icon: UserCheck,
      color: 'bg-purple-500',
      permissionKey: 'dashboard.clients',
    },
    {
      title: 'Timesheet',
      description: 'Monitor time tracking and hours',
      href: '/timesheets',
      icon: Calendar,
      color: 'bg-orange-500',
      permissionKey: 'dashboard.timesheets',
    },
    {
      title: 'Invoices',
      description: 'View and manage invoices',
      href: '/invoices',
      icon: Receipt,
      color: 'bg-cyan-500',
      permissionKey: 'dashboard.invoices',
    },
    {
      title: 'Reports',
      description: 'Generate and view system reports',
      href: '/reports',
      icon: FileCheck,
      color: 'bg-pink-500',
      permissionKey: 'dashboard.reports',
    },
  ]

  const adminCards = [
    {
      title: 'Users',
      description: 'Manage users, roles, and permissions',
      href: '/users',
      icon: Users,
      color: 'bg-red-500',
      permissionKey: 'dashboard.users',
    },
    {
      title: 'BCBAs',
      description: 'Manage Board Certified Behavior Analysts',
      href: '/bcbas',
      icon: UserCheck,
      color: 'bg-indigo-500',
      permissionKey: 'dashboard.bcbas',
    },
    {
      title: 'Insurance',
      description: 'Configure insurance rates and settings',
      href: '/insurance',
      icon: Shield,
      color: 'bg-teal-500',
      permissionKey: 'dashboard.insurance',
    },
  ]

  // Helper function to check if user can see a dashboard section
  const canSeeSection = (permissionKey: string): boolean => {
    // SUPER_ADMIN and ADMIN see all by default
    if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN') {
      return true
    }

    // CUSTOM roles check dashboard visibility settings
    if (session.user.role === 'CUSTOM') {
      // Map permission keys to dashboard visibility section keys
      const sectionKeyMap: Record<string, string> = {
        'dashboard.analytics': 'quickAccess.analytics',
        'dashboard.providers': 'quickAccess.providers',
        'dashboard.clients': 'quickAccess.clients',
        'dashboard.timesheets': 'quickAccess.timesheets',
        'dashboard.invoices': 'quickAccess.invoices',
        'dashboard.reports': 'quickAccess.reports',
        'dashboard.users': 'quickAccess.users',
        'dashboard.bcbas': 'quickAccess.bcbas',
        'dashboard.insurance': 'quickAccess.insurance',
      }
      const sectionKey = sectionKeyMap[permissionKey]
      if (sectionKey && dashboardVisibility[sectionKey] !== undefined) {
        return dashboardVisibility[sectionKey] === true
      }
    }

    // USER roles check permissions
    const permission = userPermissions[permissionKey]
    return permission?.canView === true
  }

  // Filter cards based on permissions and visibility
  const visibleCards = cards.filter(card => {
    return canSeeSection(card.permissionKey)
  })

  // Filter admin cards based on permissions and role
  const visibleAdminCards = adminCards.filter(card => {
    // Only show admin cards to ADMIN and SUPER_ADMIN roles
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return false
    }
    // Check permission for the card
    return canSeeSection(card.permissionKey)
  })

  return (
    <div className="min-h-screen bg-amber-50">
      <DashboardNav userRole={session.user.role} />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Dashboard</h1>
          <p className="text-gray-600 mb-8">Welcome to Smart Steps Dashboard</p>

          {/* Quick Access - FIRST SECTION */}
          <div className="mb-8">
            {visibleCards.length === 0 && visibleAdminCards.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">
                  No dashboard sections available. Contact your administrator to grant access.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`${card.color} p-3 rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {card.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {visibleAdminCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`${card.color} p-3 rounded-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {card.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dashboard Stats - Other Sections Below Quick Access */}
          <div className="mt-8">
            <DashboardStats 
              showPendingApprovals={isSectionVisible('sections.pendingApprovals')}
              showRecentActivity={isSectionVisible('sections.recentActivity')}
              showRecentInvoices={isSectionVisible('sections.recentInvoices')}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
