import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeSaturdayEntries() {
  try {
    console.log('🔍 Finding all Saturday timesheet entries...')
    
    // Find all entries where the date is a Saturday (day of week = 6)
    // We need to check the day of week in the database
    // PostgreSQL uses EXTRACT(DOW FROM date) where Saturday = 6
    
    // First, let's get all entries and filter in JavaScript to be safe
    const allEntries = await prisma.timesheetEntry.findMany({
      select: {
        id: true,
        date: true,
        timesheetId: true,
        startTime: true,
        endTime: true,
      },
    })
    
    console.log(`📊 Total entries found: ${allEntries.length}`)
    
    // Filter entries where date is Saturday (getDay() === 6)
    const saturdayEntries = allEntries.filter((entry) => {
      const entryDate = new Date(entry.date)
      return entryDate.getDay() === 6 // Saturday
    })
    
    console.log(`📅 Saturday entries found: ${saturdayEntries.length}`)
    
    if (saturdayEntries.length === 0) {
      console.log('✅ No Saturday entries found. Nothing to delete.')
      return
    }
    
    // Show some examples
    console.log('\n📋 Sample Saturday entries to be deleted:')
    saturdayEntries.slice(0, 5).forEach((entry, idx) => {
      const date = new Date(entry.date)
      console.log(`  ${idx + 1}. Entry ID: ${entry.id}, Date: ${date.toLocaleDateString()}, Timesheet: ${entry.timesheetId}`)
    })
    if (saturdayEntries.length > 5) {
      console.log(`  ... and ${saturdayEntries.length - 5} more`)
    }
    
    // Delete all Saturday entries in a transaction
    console.log('\n🗑️  Deleting Saturday entries...')
    
    const result = await prisma.$transaction(async (tx) => {
      const deletedIds = saturdayEntries.map((e) => e.id)
      
      const deleteResult = await tx.timesheetEntry.deleteMany({
        where: {
          id: {
            in: deletedIds,
          },
        },
      })
      
      return deleteResult
    })
    
    console.log(`✅ Successfully deleted ${result.count} Saturday entries`)
    console.log(`\n📊 Summary:`)
    console.log(`   - Total entries checked: ${allEntries.length}`)
    console.log(`   - Saturday entries found: ${saturdayEntries.length}`)
    console.log(`   - Saturday entries deleted: ${result.count}`)
    console.log(`   - Remaining entries: ${allEntries.length - result.count}`)
    
  } catch (error) {
    console.error('❌ Error removing Saturday entries:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
removeSaturdayEntries()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
