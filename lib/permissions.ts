import { prisma } from './prisma'

export interface UserPermissions {
  [key: string]: {
    canView: boolean
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    canApprove: boolean
    canExport: boolean
  }
}

/**
 * Get all permissions for a user based on their role
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customRole: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  })

  if (!user) {
    return {}
  }

  const permissions: UserPermissions = {}

  // SUPER_ADMIN has all permissions
  if (user.role === 'SUPER_ADMIN') {
    const allPerms = await prisma.permission.findMany()
    allPerms.forEach(perm => {
      permissions[perm.name] = {
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canApprove: true,
        canExport: true,
      }
    })
    return permissions
  }

  // ADMIN has admin permissions
  if (user.role === 'ADMIN') {
    const adminPerms = await prisma.permission.findMany({
      where: {
        name: {
          not: {
            in: ['users.delete', 'roles.delete'] // Limit some dangerous operations
          }
        }
      }
    })
    adminPerms.forEach(perm => {
      permissions[perm.name] = {
        canView: true,
        canCreate: !perm.name.includes('.delete'),
        canUpdate: true,
        canDelete: false,
        canApprove: true,
        canExport: true,
      }
    })
    return permissions
  }

  // CUSTOM role uses role permissions
  if (user.role === 'CUSTOM' && user.customRole) {
    user.customRole.permissions.forEach(rp => {
      permissions[rp.permission.name] = {
        canView: rp.canView,
        canCreate: rp.canCreate,
        canUpdate: rp.canUpdate,
        canDelete: rp.canDelete,
        canApprove: rp.canApprove,
        canExport: rp.canExport,
      }
    })
    return permissions
  }

  // USER role has basic view permissions
  const basicPerms = await prisma.permission.findMany({
    where: {
      name: {
        in: [
          'timesheets.view',
          'timesheets.create',
          'timesheets.update',
          'timesheets.submit',
          'invoices.view',
        ]
      }
    }
  })
  basicPerms.forEach(perm => {
    permissions[perm.name] = {
      canView: true,
      canCreate: perm.name.includes('.create'),
      canUpdate: perm.name.includes('.update'),
      canDelete: false,
      canApprove: false,
      canExport: false,
    }
  })

  return permissions
}

/**
 * Check if user can see a dashboard section
 */
export async function canSeeDashboardSection(userId: string, section: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  const permissionName = `dashboard.${section}`
  
  // SUPER_ADMIN and ADMIN can see everything
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
    return true
  }

  // Check permission
  return permissions[permissionName]?.canView === true
}

/**
 * Check if user can access a route based on dashboard visibility permission
 * Returns true if user has access, false otherwise
 */
export async function canAccessRoute(userId: string, route: string): Promise<boolean> {
  // Map routes to dashboard section names
  const routeSectionMap: Record<string, string> = {
    '/providers': 'providers',
    '/clients': 'clients',
    '/timesheets': 'timesheets',
    '/invoices': 'invoices',
    '/reports': 'reports',
    '/analytics': 'analytics',
    '/users': 'users',
    '/bcbas': 'bcbas',
    '/insurance': 'insurance',
  }

  const section = routeSectionMap[route]
  if (!section) {
    // Route not in map, allow access (default behavior)
    return true
  }

  return canSeeDashboardSection(userId, section)
}