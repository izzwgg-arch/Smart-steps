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
      const pageWidth = doc.page.width
      const margin = 50

      // HEADER: "Smart Steps ABA" - Centered
      doc.fontSize(24).font('Helvetica-Bold').text('Smart Steps ABA', { align: 'center' })
      doc.moveDown(0.5)

      // SUBTITLE: "TIMESHEETS" - Only for regular timesheets
      if (!isBCBA) {
        doc.fontSize(18).font('Helvetica-Bold').text('TIMESHEETS', { align: 'center' })
        doc.moveDown(1)
      } else {
        doc.moveDown(1)
      }

      // INFO SECTION: 2-column layout
      const leftColX = margin
      const rightColX = pageWidth / 2 + 20
      const infoStartY = doc.y

      // Left Column: Client/Child Info
      let leftY = infoStartY
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text(isBCBA ? 'Client:' : 'Child:', leftColX, leftY)
      doc.font('Helvetica').text(timesheet.client.name || '', leftColX + 60, leftY)
      leftY += 15

      if (isBCBA && timesheet.client.address) {
        doc.font('Helvetica-Bold').text('Address:', leftColX, leftY)
        doc.font('Helvetica').text(timesheet.client.address, leftColX + 60, leftY)
        leftY += 15
      }

      doc.font('Helvetica-Bold').text('Phone:', leftColX, leftY)
      doc.font('Helvetica').text(timesheet.client.phone || '', leftColX + 60, leftY)
      leftY += 15

      if (isBCBA && (timesheet.client.dlb || timesheet.provider.dlb)) {
        doc.font('Helvetica-Bold').text('DLB:', leftColX, leftY)
        doc.font('Helvetica').text(timesheet.client.dlb || timesheet.provider.dlb || 'N/A', leftColX + 60, leftY)
        leftY += 15
      }

      // Right Column: Provider Info (start at same Y as left column)
      let rightY = infoStartY
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text('Provider:', rightColX, rightY)
      doc.font('Helvetica').text(timesheet.provider.name, rightColX + 60, rightY)
      rightY += 15

      doc.font('Helvetica-Bold').text('Phone:', rightColX, rightY)
      doc.font('Helvetica').text(timesheet.provider.phone || '', rightColX + 60, rightY)
      rightY += 15

      doc.font('Helvetica-Bold').text('BCBA:', rightColX, rightY)
      doc.font('Helvetica').text(timesheet.bcba.name, rightColX + 60, rightY)
      rightY += 15

      if (isBCBA && timesheet.serviceType) {
        doc.font('Helvetica-Bold').text('Service Type:', rightColX, rightY)
        doc.font('Helvetica').fillColor('#0d9488').text(timesheet.serviceType, rightColX + 80, rightY)
        doc.fillColor('black')
        rightY += 15
      }

      if (isBCBA && timesheet.sessionData) {
        doc.font('Helvetica-Bold').text('Session Data / Analysis:', rightColX, rightY)
        doc.font('Helvetica').text(timesheet.sessionData, rightColX + 120, rightY)
        rightY += 15
      }

      // Move to below the info section (use the maximum Y from both columns)
      doc.y = Math.max(leftY, rightY) + 10

      // PERIOD
      const startDate = typeof timesheet.startDate === 'string' ? new Date(timesheet.startDate) : timesheet.startDate
      const endDate = typeof timesheet.endDate === 'string' ? new Date(timesheet.endDate) : timesheet.endDate
      doc.fontSize(12).font('Helvetica-Bold').text('Period:', { continued: true })
      doc.font('Helvetica').text(` ${format(startDate, 'EEE M/d/yyyy').toLowerCase()} - ${format(endDate, 'EEE M/d/yyyy').toLowerCase()}`)
      doc.moveDown(1)

      // TABLE
      const tableTop = doc.y
      const rowHeight = 20
      const tableLeft = margin
      const tableRight = pageWidth - margin
      const tableWidth = tableRight - tableLeft

      // Table Headers
      doc.fontSize(10).font('Helvetica-Bold')
      const colWidths = isBCBA 
        ? [80, 70, 70, 60, 200] // Date, In, Out, Hours, Notes
        : [80, 70, 70, 60, 60, 60] // Date, In, Out, Hours, Type, Location
      
      let xPos = tableLeft
      const headers = isBCBA
        ? ['DATE', 'IN', 'OUT', 'HOURS', 'NOTES']
        : ['DATE', 'IN', 'OUT', 'HOURS', 'TYPE', 'LOCATION']
      
      console.log(`[TIMESHEET_PDF] ${corrId} Drawing table headers at Y=${tableTop}`)
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop)
        xPos += colWidths[i]
      })

      // Draw header line
      doc.moveTo(tableLeft, tableTop + 15).lineTo(tableRight, tableTop + 15).stroke()
      console.log(`[TIMESHEET_PDF] ${corrId} Table header drawn, doc.y=${doc.y}, tableTop=${tableTop}`)

      // Table Rows
      doc.font('Helvetica').fontSize(9)
      const sortedEntries = [...timesheet.entries].sort((a, b) => {
        const dateA = typeof a.date === 'string' ? new Date(a.date).getTime() : a.date.getTime()
        const dateB = typeof b.date === 'string' ? new Date(b.date).getTime() : b.date.getTime()
        if (dateA !== dateB) return dateA - dateB
        return a.startTime.localeCompare(b.startTime)
      })

      console.log(`[TIMESHEET_PDF] ${corrId} Rendering ${sortedEntries.length} table entries`)
      
      // MATCH INVOICE APPROACH EXACTLY: Use calculated rowY like invoices use dataRowY
      let rowY = tableTop + 20 // Start below header line
      
      console.log(`[TIMESHEET_PDF] ${corrId} Starting table rows, rowY=${rowY}, tableTop=${tableTop}`)
      
      doc.font('Helvetica').fontSize(9)
      
      sortedEntries.forEach((entry, index) => {
        const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date
        xPos = tableLeft

        if (index < 3) {
          console.log(`[TIMESHEET_PDF] ${corrId} Rendering entry ${index + 1} at rowY=${rowY}`)
        }

        // Write all columns at the SAME rowY (like invoices: dataRowY + 8)
        // Date
        const dateStr = format(entryDate, 'EEE M/d/yyyy').toLowerCase()
        doc.text(dateStr, xPos, rowY)
        xPos += colWidths[0]

        // In (formatted time)
        const inTime = formatTime(entry.startTime)
        doc.text(inTime || entry.startTime, xPos, rowY)
        xPos += colWidths[1]

        // Out (formatted time)
        const outTime = formatTime(entry.endTime)
        doc.text(outTime || entry.endTime, xPos, rowY)
        xPos += colWidths[2]

        // Hours
        const hours = (entry.minutes / 60).toFixed(1)
        doc.text(hours, xPos, rowY)
        xPos += colWidths[3]

        if (!isBCBA) {
          // Type (DR/SV or notes)
          doc.text(entry.notes || '-', xPos, rowY)
          xPos += colWidths[4]

          // Location
          doc.text('Home', xPos, rowY)
        } else {
          // Notes for BCBA
          doc.text(entry.notes || '', xPos, rowY)
        }

        // Increment rowY for next row (like invoices: dataRowY += rowHeight)
        rowY += rowHeight
        
        if ((index + 1) % 10 === 0 || index === sortedEntries.length - 1) {
          console.log(`[TIMESHEET_PDF] ${corrId} Rendered ${index + 1}/${sortedEntries.length} entries, next rowY=${rowY}`)
        }
      })
      
      // Update doc.y to rowY for subsequent content
      doc.y = rowY + 10
      console.log(`[TIMESHEET_PDF] ${corrId} All table rows written, updated doc.y=${doc.y}`)
      
      console.log(`[TIMESHEET_PDF] ${corrId} Finished rendering all ${sortedEntries.length} entries`)

      // Draw bottom line at end of table (use the rowY position, not doc.y which was moved forward)
      const tableBottomY = doc.y - 10 // Back up to where table actually ended
      doc.moveTo(tableLeft, tableBottomY).lineTo(tableRight, tableBottomY).stroke()
      doc.y = tableBottomY + 10 // Continue from below the line

      // TOTALS
      const drEntries = timesheet.entries.filter(e => e.notes === 'DR')
      const svEntries = timesheet.entries.filter(e => e.notes === 'SV')
      const totalDR = drEntries.reduce((sum, e) => sum + e.minutes, 0) / 60
      const totalSV = svEntries.reduce((sum, e) => sum + e.minutes, 0) / 60
      const totalHours = timesheet.entries.reduce((sum, e) => sum + e.minutes, 0) / 60

      doc.fontSize(12).font('Helvetica-Bold')
      const totalsX = tableRight - 200 // Right-aligned
      let totalsY = doc.y

      if (!isBCBA) {
        doc.text(`Total DR: ${totalDR.toFixed(1)}`, totalsX, totalsY)
        totalsY += 15
        doc.text(`Total SV: ${totalSV.toFixed(1)}`, totalsX, totalsY)
        totalsY += 15
      }
      doc.text(`Total: ${totalHours.toFixed(1)}`, totalsX, totalsY)
      doc.moveDown(1.5)

      // SIGNATURES
      const sigY = doc.y
      const sigLeftX = tableLeft
      const sigRightX = pageWidth / 2 + 20

      // Client Signature (Left)
      doc.fontSize(10).font('Helvetica-Bold').text('Client Signature:', sigLeftX, sigY)
      doc.moveDown(0.3)
      if (timesheet.client.signature) {
        // Note: PDFKit doesn't support image URLs directly, would need to fetch and embed
        // For now, just show text placeholder
        doc.font('Helvetica').text('[Signature Image]', sigLeftX, doc.y)
      } else {
        doc.moveTo(sigLeftX, doc.y).lineTo(sigLeftX + 200, doc.y).stroke()
        doc.moveDown(0.2)
        doc.fontSize(8).font('Helvetica').fillColor('#999999').text('(No signature on file)', sigLeftX, doc.y)
        doc.fillColor('black')
      }
      doc.moveDown(0.5)

      // Provider Signature (Right)
      doc.fontSize(10).font('Helvetica-Bold').text('Provider Signature:', sigRightX, sigY)
      doc.moveDown(0.3)
      if (timesheet.provider.signature) {
        doc.font('Helvetica').text('[Signature Image]', sigRightX, doc.y)
      } else {
        doc.moveTo(sigRightX, doc.y).lineTo(sigRightX + 200, doc.y).stroke()
        doc.moveDown(0.2)
        doc.fontSize(8).font('Helvetica').fillColor('#999999').text('(No signature on file)', sigRightX, doc.y)
        doc.fillColor('black')
      }
      doc.moveDown(1)

      // LEGEND - Only for regular timesheets
      if (!isBCBA) {
        doc.fontSize(10).font('Helvetica')
        doc.text('DR = Direct Service', tableLeft, doc.y)
        doc.moveDown(0.3)
        doc.text('SV = Super Vision', tableLeft, doc.y)
      }

      console.log(`[TIMESHEET_PDF] ${corrId} About to call doc.end(), final Y position: ${doc.y}`)
      console.log(`[TIMESHEET_PDF] ${corrId} Total entries rendered: ${timesheet.entries.length}`)
      
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
