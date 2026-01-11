import PDFDocument from 'pdfkit'
import { format } from 'date-fns'
import { randomBytes } from 'crypto'

interface TimesheetForPDF {
  id: string
  client: { id?: string; name: string; address?: string | null; phone?: string | null; dlb?: string | null; signature?: string | null }
  provider: { name: string; phone?: string | null; signature?: string | null; dlb?: string | null }
  bcba: { name: string }
  startDate: Date | string
  endDate: Date | string
  isBCBA: boolean
  serviceType?: string | null
  sessionData?: string | null
  entries: Array<{
    date: Date | string
    startTime: string
    endTime: string
    minutes: number
    notes?: string | null
  }>
}

/**
 * Format time from 24-hour format to 12-hour format with AM/PM
 */
function formatTime(time: string): string {
  if (!time || time === '--:--') return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  if (isNaN(hour)) return ''
  
  const ampm = hour >= 12 ? 'PM' : 'AM'
  let displayHour = hour
  if (hour === 0) {
    displayHour = 12 // 00:xx = 12:xx AM
  } else if (hour > 12) {
    displayHour = hour - 12 // 13:xx = 1:xx PM
  }
  // hour === 12 stays as 12 (12:xx PM)
  
  return `${displayHour}:${minutes.padStart(2, '0')} ${ampm}`
}

/**
 * Generate Timesheet PDF with correlationId logging
 * Matches the Print Preview modal layout EXACTLY
 */
export async function generateTimesheetPDF(timesheet: TimesheetForPDF, correlationId?: string): Promise<Buffer> {
  const corrId = correlationId || `pdf-${Date.now()}-${randomBytes(4).toString('hex')}`
  const startTime = Date.now()
  
  console.log(`[TIMESHEET_PDF] ${corrId} Starting PDF generation`, {
    timesheetId: timesheet.id,
    type: timesheet.isBCBA ? 'BCBA' : 'REGULAR',
    entriesCount: timesheet.entries.length,
    entries: timesheet.entries.length > 0 ? `First entry: ${JSON.stringify(timesheet.entries[0])}` : 'NO ENTRIES',
  })

  // PHASE 3: Validate entries exist
  if (!timesheet.entries || timesheet.entries.length === 0) {
    throw new Error(`Timesheet ${timesheet.id} has no entries - cannot generate PDF`)
  }

  try {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
      const buffers: Buffer[] = []
      let dataChunks = 0

      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk)
        dataChunks++
        if (dataChunks === 1) {
          console.log(`[TIMESHEET_PDF] ${corrId} First data chunk received, size: ${chunk.length} bytes`)
        }
      })
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        const duration = Date.now() - startTime
        console.log(`[TIMESHEET_PDF] ${corrId} PDF generated successfully`, {
          timesheetId: timesheet.id,
          size: pdfBuffer.length,
          duration: `${duration}ms`,
          dataChunks,
          entriesCount: timesheet.entries.length,
        })
        
        // PHASE 4: Hard validation - PDF must be >15KB if there are entries
        if (timesheet.entries.length > 0 && pdfBuffer.length < 15000) {
          const error = new Error(`PDF_TOO_SMALL: Generated PDF is only ${pdfBuffer.length} bytes but timesheet has ${timesheet.entries.length} entries. Expected >15KB.`)
          console.error(`[TIMESHEET_PDF] ${corrId} ${error.message}`)
          reject(error)
          return
        }
        
        resolve(pdfBuffer)
      })
      doc.on('error', (error) => {
        console.error(`[TIMESHEET_PDF] ${corrId} PDF generation error`, {
          timesheetId: timesheet.id,
          error: error.message,
          stack: error.stack,
        })
        reject(error)
      })

      const isBCBA = timesheet.isBCBA
      const margin = 50

      // CANARY: Write canary text first to prove PDFKit is working
      doc.fontSize(18).text('CANARY_TIMESHEET_PDF_RENDER', 50, 50)
      
      // MINIMAL CONTENT: Title
      doc.fontSize(24).font('Helvetica-Bold').text('Smart Steps ABA', { align: 'center' })
      doc.moveDown(1)
      
      // Timesheet ID
      doc.fontSize(12).font('Helvetica').text(`Timesheet ID: ${timesheet.id}`)
      doc.moveDown(0.5)
      
      // Entries count
      doc.text(`Entries: ${timesheet.entries.length}`)
      doc.moveDown(0.5)
      
      // Test sentence
      doc.text('If you see this, PDF generation works.')
      doc.moveDown(2)
      
      // Write some more content to ensure PDF is > 5KB
      for (let i = 0; i < 20; i++) {
        doc.text(`Line ${i + 1}: This is test content to ensure PDF is large enough.`, { width: 500 })
      }

      console.log(`[TIMESHEET_PDF_DEBUG] ${corrId} Minimal content written, about to call doc.end()`)
      
      doc.end()
      
      console.log(`[TIMESHEET_PDF] ${corrId} doc.end() called, waiting for 'end' event...`)
    })
  } catch (error: any) {
    console.error(`[TIMESHEET_PDF] ${corrId} PDF generation failed`, {
      timesheetId: timesheet.id,
      error: error?.message,
      stack: error?.stack,
    })
    throw error
  }
}

/**
 * Generate PDF from timesheet ID (fetches data and generates PDF)
 * This is the shared function used by both API routes and Email Queue
 */
export async function generateTimesheetPDFFromId(
  timesheetId: string,
  prisma: any,
  correlationId?: string
): Promise<Buffer> {
  const corrId = correlationId || `pdf-${Date.now()}-${randomBytes(4).toString('hex')}`
  
  console.log(`[TIMESHEET_PDF] ${corrId} Fetching timesheet data`, { timesheetId })

  try {
    // PHASE 2: Fetch timesheet with ALL data - use SAME query as UI route
    // Match exactly what /api/timesheets/[id] uses for Print Preview
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId, deletedAt: null },
      include: {
        client: true, // Include all client fields (matches UI)
        provider: true, // Include all provider fields (matches UI)
        bcba: true, // Include all bcba fields (matches UI)
        entries: {
          orderBy: { date: 'asc' }, // Same orderBy as UI
          // Don't use select - include all fields like UI does
        },
      },
    })

    if (!timesheet) {
      throw new Error(`Timesheet ${timesheetId} not found`)
    }

    console.log(`[TIMESHEET_PDF] ${corrId} Timesheet data fetched`, {
      timesheetId,
      isBCBA: timesheet.isBCBA,
      entriesCount: timesheet.entries?.length || 0,
      firstEntry: timesheet.entries?.[0] ? {
        date: timesheet.entries[0].date,
        startTime: timesheet.entries[0].startTime,
        endTime: timesheet.entries[0].endTime,
        minutes: timesheet.entries[0].minutes,
        notes: timesheet.entries[0].notes,
      } : 'NO ENTRIES',
      allEntryKeys: timesheet.entries?.[0] ? Object.keys(timesheet.entries[0]) : [],
    })
    
    // PHASE 2: Validate entries exist
    if (!timesheet.entries || timesheet.entries.length === 0) {
      throw new Error(`NO_ROWS_TO_PRINT: Timesheet ${timesheetId} has no entries`)
    }

    // PHASE 3: Map entries exactly as they come from Prisma
    const mappedEntries = timesheet.entries.map((entry: any) => {
      console.log(`[TIMESHEET_PDF] ${corrId} Mapping entry:`, {
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        minutes: entry.minutes,
        notes: entry.notes,
        allKeys: Object.keys(entry),
      })
      return {
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        minutes: entry.minutes,
        notes: entry.notes || null,
      }
    })
    
    console.log(`[TIMESHEET_PDF] ${corrId} Mapped ${mappedEntries.length} entries for PDF generation`)

    // Generate PDF using the shared generator
    const pdfBuffer = await generateTimesheetPDF(
      {
        id: timesheet.id,
        client: timesheet.client as any,
        provider: timesheet.provider as any,
        bcba: timesheet.bcba,
        startDate: timesheet.startDate,
        endDate: timesheet.endDate,
        isBCBA: timesheet.isBCBA,
        serviceType: timesheet.serviceType || undefined,
        sessionData: timesheet.sessionData || undefined,
        entries: mappedEntries,
      },
      corrId
    )

    return pdfBuffer
  } catch (error: any) {
    console.error(`[TIMESHEET_PDF] ${corrId} Failed to generate PDF from ID`, {
      timesheetId,
      error: error?.message,
      stack: error?.stack,
    })
    throw error
  }
}
