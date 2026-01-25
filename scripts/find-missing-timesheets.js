const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(80))
  console.log('FINDING MISSING TIMESHEETS FROM DELETED USERS')
  console.log('='.repeat(80))
  console.log('')

  // Get all invoice entries that reference timesheets
  console.log('Checking invoice entries for timesheet references...')
  const invoiceEntries = await prisma.invoiceEntry.findMany({
    select: {
      id: true,
      timesheetId: true,
      invoiceId: true,
    },
    take: 100000,
  })

  console.log(`Found ${invoiceEntries.length} invoice entries`)
  
  // Get unique timesheet IDs from invoices
  const timesheetIdsFromInvoices = new Set()
  invoiceEntries.forEach(entry => {
    if (entry.timesheetId) {
      timesheetIdsFromInvoices.add(entry.timesheetId)
    }
  })

  console.log(`Unique timesheet IDs referenced in invoices: ${timesheetIdsFromInvoices.size}`)
  console.log('')

  // Check which of these timesheets exist
  const invoiceTimesheetIds = Array.from(timesheetIdsFromInvoices)
  if (invoiceTimesheetIds.length > 0) {
    const existingInvoiceTimesheets = await prisma.timesheet.findMany({
      where: {
        id: { in: invoiceTimesheetIds },
      },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        createdAt: true,
      },
    })

    const existingIds = new Set(existingInvoiceTimesheets.map(t => t.id))
    const missingIds = invoiceTimesheetIds.filter(id => !existingIds.has(id))
    const softDeleted = existingInvoiceTimesheets.filter(t => t.deletedAt).map(t => t.id)

    console.log(`Timesheets referenced in invoices:`)
    console.log(`  - Still exist: ${existingInvoiceTimesheets.length}`)
    console.log(`  - Soft-deleted: ${softDeleted.length}`)
    console.log(`  - Hard-deleted (missing): ${missingIds.length}`)
    console.log('')

    if (missingIds.length > 0) {
      console.log(`Found ${missingIds.length} hard-deleted timesheets referenced in invoices:`)
      console.log('(These were likely deleted when users were deleted)')
      console.log('')
      
      // Show first 50
      missingIds.slice(0, 50).forEach(id => {
        const entries = invoiceEntries.filter(e => e.timesheetId === id)
        console.log(`  - ${id} (referenced in ${entries.length} invoice entry/ies)`)
      })
      
      if (missingIds.length > 50) {
        console.log(`  ... and ${missingIds.length - 50} more`)
      }
    }
  }

  // Also check all soft-deleted timesheets
  console.log('')
  console.log('Checking all soft-deleted timesheets...')
  const allSoftDeleted = await prisma.timesheet.findMany({
    where: {
      deletedAt: { not: null },
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      deletedAt: true,
      status: true,
    },
    orderBy: { deletedAt: 'desc' },
  })

  console.log(`Total soft-deleted timesheets: ${allSoftDeleted.length}`)
  console.log('')

  // Group by deletion date
  const deletedToday = allSoftDeleted.filter(t => {
    const deleted = new Date(t.deletedAt)
    const today = new Date()
    return deleted.toDateString() === today.toDateString()
  })

  const deletedYesterday = allSoftDeleted.filter(t => {
    const deleted = new Date(t.deletedAt)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return deleted.toDateString() === yesterday.toDateString()
  })

  console.log(`Deleted today: ${deletedToday.length}`)
  console.log(`Deleted yesterday: ${deletedYesterday.length}`)
  console.log(`Deleted other dates: ${allSoftDeleted.length - deletedToday.length - deletedYesterday.length}`)
  console.log('')

  if (deletedYesterday.length > 0) {
    console.log('Timesheets deleted yesterday (can be restored):')
    deletedYesterday.forEach(ts => {
      console.log(`  - ${ts.id}: Created ${ts.createdAt}, Deleted ${ts.deletedAt}, Status: ${ts.status}, UserId: ${ts.userId}`)
    })
  }

  await prisma.$disconnect()
}

main().catch(console.error)
