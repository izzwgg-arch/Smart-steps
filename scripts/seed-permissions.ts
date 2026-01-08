import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const permissions = [
  // Providers
  { name: 'providers.view', description: 'View providers', category: 'providers' },
  { name: 'providers.create', description: 'Create providers', category: 'providers' },
  { name: 'providers.update', description: 'Update providers', category: 'providers' },
  { name: 'providers.delete', description: 'Delete providers', category: 'providers' },
  { name: 'providers.export', description: 'Export providers', category: 'providers' },
  
  // Clients
  { name: 'clients.view', description: 'View clients', category: 'clients' },
  { name: 'clients.create', description: 'Create clients', category: 'clients' },
  { name: 'clients.update', description: 'Update clients', category: 'clients' },
  { name: 'clients.delete', description: 'Delete clients', category: 'clients' },
  { name: 'clients.export', description: 'Export clients', category: 'clients' },
  
  // BCBAs
  { name: 'bcbas.view', description: 'View BCBAs', category: 'bcbas' },
  { name: 'bcbas.create', description: 'Create BCBAs', category: 'bcbas' },
  { name: 'bcbas.update', description: 'Update BCBAs', category: 'bcbas' },
  { name: 'bcbas.delete', description: 'Delete BCBAs', category: 'bcbas' },
  { name: 'bcbas.export', description: 'Export BCBAs', category: 'bcbas' },
  
  // Insurance
  { name: 'insurance.view', description: 'View insurance', category: 'insurance' },
  { name: 'insurance.create', description: 'Create insurance', category: 'insurance' },
  { name: 'insurance.update', description: 'Update insurance', category: 'insurance' },
  { name: 'insurance.delete', description: 'Delete insurance', category: 'insurance' },
  { name: 'insurance.export', description: 'Export insurance', category: 'insurance' },
  
  // Timesheets
  { name: 'timesheets.view', description: 'View timesheets', category: 'timesheets' },
  { name: 'timesheets.viewAll', description: 'View all timesheets', category: 'timesheets' },
  { name: 'timesheets.viewSelectedUsers', description: 'View selected users\' timesheets', category: 'timesheets' },
  { name: 'timesheets.create', description: 'Create timesheets', category: 'timesheets' },
  { name: 'timesheets.update', description: 'Update timesheets', category: 'timesheets' },
  { name: 'timesheets.delete', description: 'Delete timesheets', category: 'timesheets' },
  { name: 'timesheets.submit', description: 'Submit timesheets', category: 'timesheets' },
  { name: 'timesheets.approve', description: 'Approve timesheets', category: 'timesheets' },
  { name: 'timesheets.reject', description: 'Reject timesheets', category: 'timesheets' },
  { name: 'timesheets.export', description: 'Export timesheets', category: 'timesheets' },
  
  // Invoices
  { name: 'invoices.view', description: 'View invoices', category: 'invoices' },
  { name: 'invoices.create', description: 'Create invoices', category: 'invoices' },
  { name: 'invoices.update', description: 'Update invoices', category: 'invoices' },
  { name: 'invoices.delete', description: 'Delete invoices', category: 'invoices' },
  { name: 'invoices.payment', description: 'Record payments', category: 'invoices' },
  { name: 'invoices.adjustment', description: 'Make adjustments', category: 'invoices' },
  { name: 'invoices.export', description: 'Export invoices', category: 'invoices' },
  
  // Users
  { name: 'users.view', description: 'View users', category: 'users' },
  { name: 'users.create', description: 'Create users', category: 'users' },
  { name: 'users.update', description: 'Update users', category: 'users' },
  { name: 'users.delete', description: 'Delete users', category: 'users' },
  
  // Roles
  { name: 'roles.view', description: 'View roles', category: 'roles' },
  { name: 'roles.create', description: 'Create roles', category: 'roles' },
  { name: 'roles.update', description: 'Update roles', category: 'roles' },
  { name: 'roles.delete', description: 'Delete roles', category: 'roles' },
  
  // Reports
  { name: 'reports.view', description: 'View reports', category: 'reports' },
  { name: 'reports.generate', description: 'Generate reports', category: 'reports' },
  { name: 'reports.export', description: 'Export reports', category: 'reports' },
  
  // Analytics
  { name: 'analytics.view', description: 'View analytics', category: 'analytics' },
  
  // Audit Logs
  { name: 'audit.view', description: 'View audit logs', category: 'audit' },
  
  // Dashboard Visibility
  { name: 'dashboard.analytics', description: 'Show Analytics in Dashboard', category: 'dashboard' },
  { name: 'dashboard.providers', description: 'Show Providers in Dashboard', category: 'dashboard' },
  { name: 'dashboard.clients', description: 'Show Clients in Dashboard', category: 'dashboard' },
  { name: 'dashboard.timesheets', description: 'Show Timesheets in Dashboard', category: 'dashboard' },
  { name: 'dashboard.invoices', description: 'Show Invoices in Dashboard', category: 'dashboard' },
  { name: 'dashboard.reports', description: 'Show Reports in Dashboard', category: 'dashboard' },
  { name: 'dashboard.users', description: 'Show Users in Dashboard', category: 'dashboard' },
  { name: 'dashboard.bcbas', description: 'Show BCBAs in Dashboard', category: 'dashboard' },
  { name: 'dashboard.insurance', description: 'Show Insurance in Dashboard', category: 'dashboard' },
]

async function main() {
  console.log('Seeding permissions...')
  
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    })
  }
  
  console.log(`Seeded ${permissions.length} permissions`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
