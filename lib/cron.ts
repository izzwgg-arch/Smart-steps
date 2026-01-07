import cron from 'node-cron'
import { generateInvoicesForApprovedTimesheets } from './jobs/invoiceGeneration'
import { prisma } from './prisma'
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/New_York'

// Schedule: Every Tuesday at 7:00 AM ET
// Cron expression: 0 7 * * 2
// Minute (0), Hour (7 = 7 AM), Day of month (*), Month (*), Day of week (2 = Tuesday)
const INVOICE_GENERATION_SCHEDULE = '0 7 * * 2'

let invoiceGenerationTask: cron.ScheduledTask | null = null

/**
 * Initialize and start all scheduled cron jobs
 */
export function initializeCronJobs() {
  console.log('Initializing cron jobs...')

  // Initialize invoice generation job
  initializeInvoiceGenerationJob()

  console.log('Cron jobs initialized')
}

/**
 * Initialize the automatic invoice generation job (Tuesday 7:00 AM ET)
 * Generates invoices for the previous week's billing period (Monday 12:00 AM → Monday 11:59 PM)
 * One invoice per client, aggregating all timesheets for the week
 */
function initializeInvoiceGenerationJob() {
  if (invoiceGenerationTask) {
    invoiceGenerationTask.stop()
  }

  invoiceGenerationTask = cron.schedule(
    INVOICE_GENERATION_SCHEDULE,
    async () => {
      console.log(`[CRON] Running automatic invoice generation at ${new Date().toISOString()}`)
      
      try {
        const result = await generateInvoicesForApprovedTimesheets()
        
        if (result.success) {
          console.log(
            `[CRON] Invoice generation completed successfully: ${result.invoicesCreated} invoice(s) created for ${result.clientsProcessed} client(s)`
          )
        } else {
          console.error(
            `[CRON] Invoice generation completed with errors: ${result.errors.join('; ')}`
          )
        }

        // Update scheduled job record
        await updateScheduledJobRecord('INVOICE_GENERATION', result)
      } catch (error) {
        console.error('[CRON] Error in invoice generation job:', error)
        await updateScheduledJobRecord('INVOICE_GENERATION', {
          success: false,
          invoicesCreated: 0,
          clientsProcessed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        })
      }
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  )

  // Update scheduled job record in database
  updateScheduledJobRecord('INVOICE_GENERATION').catch(console.error)

  console.log(`[CRON] Invoice generation job scheduled: ${INVOICE_GENERATION_SCHEDULE} (${TIMEZONE})`)
}

/**
 * Update or create the scheduled job record in the database
 */
async function updateScheduledJobRecord(
  jobType: string,
  lastResult?: {
    success: boolean
    invoicesCreated: number
    clientsProcessed: number
    errors: string[]
  }
) {
  try {
    const now = new Date()
    const nextRun = getNextRunTime(INVOICE_GENERATION_SCHEDULE, TIMEZONE)

    // Find existing job record
    const existing = await prisma.scheduledJob.findFirst({
      where: {
        jobType,
        active: true,
      },
    })

    if (existing) {
      await prisma.scheduledJob.update({
        where: { id: existing.id },
        data: {
          lastRun: lastResult ? now : existing.lastRun,
          nextRun,
          updatedAt: now,
        },
      })
    } else {
      await prisma.scheduledJob.create({
        data: {
          jobType,
          schedule: INVOICE_GENERATION_SCHEDULE,
          nextRun,
          active: true,
          lastRun: lastResult ? now : undefined,
        },
      })
    }
  } catch (error) {
    console.error(`Failed to update scheduled job record for ${jobType}:`, error)
  }
}

/**
 * Calculate the next run time for a cron schedule in the given timezone
 */
function getNextRunTime(cronExpression: string, timezone: string): Date {
  // Parse cron expression: "0 16 * * 5"
  const parts = cronExpression.split(' ')
  const minute = parseInt(parts[0])
  const hour = parseInt(parts[1])
  const dayOfWeek = parseInt(parts[4]) // 0-6, where 0 = Sunday, 5 = Friday

  const now = utcToZonedTime(new Date(), timezone)
  const nextRun = new Date(now)

  // Calculate days until next Tuesday
  const currentDay = now.getDay() // 0 = Sunday, 2 = Tuesday
  let daysUntilTuesday = (dayOfWeek - currentDay + 7) % 7

  // If it's already Tuesday and past the scheduled time, schedule for next Tuesday
  if (currentDay === dayOfWeek) {
    const scheduledTime = new Date(now)
    scheduledTime.setHours(hour, minute, 0, 0)
    if (now >= scheduledTime) {
      daysUntilTuesday = 7
    }
  }

  // If daysUntilTuesday is 0, it means we're scheduling for today
  if (daysUntilTuesday === 0 && currentDay === dayOfWeek) {
    const scheduledTime = new Date(now)
    scheduledTime.setHours(hour, minute, 0, 0)
    if (now < scheduledTime) {
      nextRun.setHours(hour, minute, 0, 0)
      return zonedTimeToUtc(nextRun, timezone)
    }
  }

  // Set to next Tuesday
  nextRun.setDate(nextRun.getDate() + daysUntilTuesday)
  nextRun.setHours(hour, minute, 0, 0)

  return zonedTimeToUtc(nextRun, timezone)
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopCronJobs() {
  console.log('Stopping cron jobs...')
  
  if (invoiceGenerationTask) {
    invoiceGenerationTask.stop()
    invoiceGenerationTask = null
  }

  console.log('Cron jobs stopped')
}

/**
 * Manually trigger invoice generation (for testing or manual execution)
 */
export async function triggerInvoiceGeneration() {
  console.log('Manually triggering invoice generation...')
  return await generateInvoicesForApprovedTimesheets()
}
