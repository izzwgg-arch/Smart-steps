import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface InvoiceGenerationResult {
  success: boolean
  invoicesCreated: number
  clientsProcessed: number
  errors: string[]
}

/**
 * Generate invoices automatically for all approved, unlocked timesheets.
 * Groups timesheets by client and creates one invoice per client.
 */
export async function generateInvoicesForApprovedTimesheets(): Promise<InvoiceGenerationResult> {
  const result: InvoiceGenerationResult = {
    success: true,
    invoicesCreated: 0,
    clientsProcessed: 0,
    errors: [],
  }

  try {
    // Find all approved timesheets that haven't been invoiced yet
    const approvedTimesheets = await prisma.timesheet.findMany({
      where: {
        status: 'APPROVED',
        lockedAt: null, // Not already invoiced
        deletedAt: null,
      },
      include: {
        entries: true,
        insurance: true,
        provider: true,
        client: true,
      },
      orderBy: [
        { clientId: 'asc' },
        { startDate: 'asc' },
      ],
    })

    if (approvedTimesheets.length === 0) {
      console.log('No approved timesheets found for invoice generation')
      return result
    }

    // Group timesheets by client
    const timesheetsByClient = new Map<string, typeof approvedTimesheets>()
    
    for (const timesheet of approvedTimesheets) {
      const clientId = timesheet.clientId
      if (!timesheetsByClient.has(clientId)) {
        timesheetsByClient.set(clientId, [])
      }
      timesheetsByClient.get(clientId)!.push(timesheet)
    }

    result.clientsProcessed = timesheetsByClient.size

    const invoicesCreated: any[] = []

    // Process each client
    for (const [clientId, clientTimesheets] of timesheetsByClient) {
      try {
        const invoice = await generateInvoiceForClient(clientId, clientTimesheets)
        invoicesCreated.push(invoice)
        result.invoicesCreated++
      } catch (error) {
        const errorMessage = `Failed to generate invoice for client ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMessage, error)
        result.errors.push(errorMessage)
        result.success = false
      }
    }

    // Create notifications for admins if invoices were created
    if (result.invoicesCreated > 0) {
      // Calculate total amount for all created invoices
      const totalAmount = invoicesCreated.reduce((sum, inv) => {
        return sum + parseFloat(inv.totalAmount.toString())
      }, 0)

      await notifyAdminsOfInvoiceGeneration(result.invoicesCreated, totalAmount)
    }

    return result
  } catch (error) {
    const errorMessage = `Invoice generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMessage, error)
    result.success = false
    result.errors.push(errorMessage)
    return result
  }
}

type TimesheetWithRelations = Awaited<ReturnType<typeof prisma.timesheet.findMany>>[0] & {
  entries: Array<{
    id: string
    units: Decimal
  }>
  insurance: {
    ratePerUnit: Decimal
  }
  provider: {
    id: string
  }
  client: {
    id: string
  }
}

/**
 * Generate a single invoice for a client's approved timesheets
 */
async function generateInvoiceForClient(
  clientId: string,
  timesheets: TimesheetWithRelations[]
) {
  if (timesheets.length === 0) {
    throw new Error('No timesheets provided')
  }

  // Find the date range covering all timesheets
  const dates = timesheets.flatMap(ts => [ts.startDate, ts.endDate])
  const startDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const endDate = new Date(Math.max(...dates.map(d => d.getTime())))

  // Check if an invoice already exists for this client and date range
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      clientId,
      deletedAt: null,
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    },
  })

  if (existingInvoice) {
    // Check if any of these timesheets are already in an invoice
    const timesheetIds = timesheets.map(ts => ts.id)
    const existingEntries = await prisma.invoiceEntry.findMany({
      where: {
        timesheetId: { in: timesheetIds },
      },
    })

    if (existingEntries.length > 0) {
      throw new Error(`Some timesheets are already included in invoice ${existingInvoice.invoiceNumber}`)
    }
  }

  // Get the first admin user to use as creator (system-generated invoices)
  const adminUser = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
      active: true,
      deletedAt: null,
    },
  })

  if (!adminUser) {
    throw new Error('No active admin user found to assign as invoice creator')
  }

  // Generate invoice number
  const invoiceCount = await prisma.invoice.count()
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
    invoiceCount + 1
  ).padStart(5, '0')}`

  // Calculate totals
  let totalAmount = new Decimal(0)
  const invoiceEntries: any[] = []

  for (const timesheet of timesheets) {
    const rate = parseFloat(timesheet.insurance.ratePerUnit.toString())

    for (const entry of timesheet.entries) {
      const amount = new Decimal(entry.units.toString()).times(rate)
      totalAmount = totalAmount.plus(amount)

      invoiceEntries.push({
        timesheetId: timesheet.id,
        providerId: timesheet.providerId,
        insuranceId: timesheet.insuranceId,
        units: entry.units,
        rate: rate,
        amount: amount,
      })
    }
  }

  // Create invoice and lock timesheets in a transaction
  const newInvoice = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        startDate,
        endDate,
        totalAmount,
        paidAmount: new Decimal(0),
        adjustments: new Decimal(0),
        outstanding: totalAmount,
        status: 'DRAFT',
        createdBy: adminUser.id,
        entries: {
          create: invoiceEntries,
        },
      },
    })

    // Lock all timesheets included in this invoice
    await tx.timesheet.updateMany({
      where: {
        id: { in: timesheets.map((t) => t.id) },
      },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
      },
    })

    console.log(`Generated invoice ${invoiceNumber} for client ${clientId} with ${timesheets.length} timesheets`)
    
    return invoice
  })

  return newInvoice
}

/**
 * Create notifications and send emails for all admin users when invoices are generated
 */
async function notifyAdminsOfInvoiceGeneration(invoiceCount: number, totalAmount: number) {
  try {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        active: true,
        deletedAt: null,
      },
    })

    const notifications = adminUsers.map(user => ({
      userId: user.id,
      title: 'Automatic Invoice Generation',
      message: `${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''} ${invoiceCount !== 1 ? 'were' : 'was'} automatically generated for approved timesheets.`,
    }))

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      })
      console.log(`Created notifications for ${adminUsers.length} admin user(s)`)
    }

    // Send emails to admins
    try {
      const { sendEmail, getInvoiceGeneratedEmailHtml } = await import('@/lib/email')
      const emailPromises = adminUsers.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `Automatic Invoice Generation - ${invoiceCount} Invoice${invoiceCount !== 1 ? 's' : ''} Created`,
          html: getInvoiceGeneratedEmailHtml(invoiceCount, totalAmount),
        })
      )

      await Promise.allSettled(emailPromises)
      console.log(`Sent invoice generation emails to ${adminUsers.length} admin user(s)`)
    } catch (error) {
      console.error('Failed to send invoice generation emails:', error)
      // Don't fail the entire job if emails fail
    }
  } catch (error) {
    console.error('Failed to create notifications:', error)
    // Don't fail the entire job if notifications fail
  }
}
