import PDFDocument from 'pdfkit'
import { format } from 'date-fns'

interface TimesheetForPDF {
  id: string
  client: { name: string; address?: string | null; idNumber?: string | null; dlb?: string | null }
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

export async function generateTimesheetPDF(timesheet: TimesheetForPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
    const buffers: Buffer[] = []

    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    const isBCBA = timesheet.isBCBA

    // Header
    doc.fontSize(24).text('Smart Steps ABA', { align: 'center' })
    doc.moveDown()

    // Client Information
    doc.fontSize(12).font('Helvetica-Bold').text('Client:', { continued: true })
    doc.font('Helvetica').text(` ${timesheet.client.name}`)
    
    if (isBCBA && timesheet.client.address) {
      doc.text(`Address: ${timesheet.client.address}`)
    }
    
    doc.text(`ID Number: ${timesheet.client.idNumber || timesheet.client.id || 'N/A'}`)
    
    if (isBCBA && (timesheet.client.dlb || timesheet.provider.dlb)) {
      doc.text(`DLB: ${timesheet.client.dlb || timesheet.provider.dlb || 'N/A'}`)
    }

    doc.moveDown()

    // Provider Information
    doc.font('Helvetica-Bold').text('Provider:', { continued: true })
    doc.font('Helvetica').text(` ${timesheet.provider.name}`)
    if (timesheet.provider.phone) {
      doc.text(`Phone: ${timesheet.provider.phone}`)
    }

    doc.moveDown()

    // BCBA Information
    doc.font('Helvetica-Bold').text('BCBA:', { continued: true })
    doc.font('Helvetica').text(` ${timesheet.bcba.name}`)
    doc.moveDown()

    // Period
    const startDate = typeof timesheet.startDate === 'string' ? new Date(timesheet.startDate) : timesheet.startDate
    const endDate = typeof timesheet.endDate === 'string' ? new Date(timesheet.endDate) : timesheet.endDate
    doc.font('Helvetica-Bold').text('Period:', { continued: true })
    doc.font('Helvetica').text(` ${format(startDate, 'MM/dd/yyyy')} - ${format(endDate, 'MM/dd/yyyy')}`)
    doc.moveDown()

    // BCBA-specific fields
    if (isBCBA) {
      if (timesheet.serviceType) {
        doc.font('Helvetica-Bold').text('Service Type:', { continued: true })
        doc.font('Helvetica').text(` ${timesheet.serviceType}`)
      }
      if (timesheet.sessionData) {
        doc.font('Helvetica-Bold').text('Session Data / Analysis:', { continued: true })
        doc.font('Helvetica').text(` ${timesheet.sessionData}`)
      }
      doc.moveDown()
    }

    // Table Header
    doc.fontSize(10).font('Helvetica-Bold')
    const tableTop = doc.y
    const colWidths = isBCBA ? [80, 80, 80, 80, 80] : [70, 80, 80, 60, 60, 60, 60]
    const headers = isBCBA 
      ? ['Date', 'Start', 'End', 'Hours', 'Notes']
      : ['Date', 'Start', 'End', 'DR', 'SV', 'Total', 'Notes']
    
    let xPos = 50
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop)
      xPos += colWidths[i]
    })
    
    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.3)

    // Table Rows
    doc.font('Helvetica').fontSize(9)
    timesheet.entries.forEach((entry) => {
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date
      const hours = (entry.minutes / 60).toFixed(2)
      
      const rowY = doc.y
      xPos = 50
      
      doc.text(format(entryDate, 'MM/dd/yyyy'), xPos, rowY)
      xPos += colWidths[0]
      
      doc.text(entry.startTime, xPos, rowY)
      xPos += colWidths[1]
      
      doc.text(entry.endTime, xPos, rowY)
      xPos += colWidths[2]
      
      if (!isBCBA) {
        const isDR = entry.notes === 'DR'
        const isSV = entry.notes === 'SV'
        doc.text(isDR ? hours : '', xPos, rowY)
        xPos += colWidths[3]
        doc.text(isSV ? hours : '', xPos, rowY)
        xPos += colWidths[4]
        doc.text(hours, xPos, rowY)
        xPos += colWidths[5]
      } else {
        doc.text(hours, xPos, rowY)
        xPos += colWidths[3]
      }
      
      doc.text(entry.notes || '', xPos, rowY)
      doc.moveDown(0.4)
    })

    // Total
    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.3)
    
    const totalHours = timesheet.entries.reduce((sum, e) => sum + e.minutes, 0) / 60
    
    if (!isBCBA) {
      const drEntries = timesheet.entries.filter(e => e.notes === 'DR')
      const svEntries = timesheet.entries.filter(e => e.notes === 'SV')
      const totalDR = drEntries.reduce((sum, e) => sum + e.minutes, 0) / 60
      const totalSV = svEntries.reduce((sum, e) => sum + e.minutes, 0) / 60
      
      doc.font('Helvetica-Bold')
      xPos = 50 + colWidths[0] + colWidths[1] + colWidths[2]
      doc.text(`Total DR: ${totalDR.toFixed(2)}`, xPos, doc.y)
      xPos += colWidths[3] + colWidths[4]
      doc.text(`Total SV: ${totalSV.toFixed(2)}`, xPos, doc.y)
      xPos += colWidths[5]
      doc.text(`Grand Total: ${totalHours.toFixed(2)}`, xPos, doc.y)
    } else {
      doc.font('Helvetica-Bold')
      doc.text(`Total Hours: ${totalHours.toFixed(2)}`, 50, doc.y)
    }

    doc.moveDown(1)

    // Signatures
    if (timesheet.provider.signature) {
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold').text('Provider Signature:', 50, doc.y)
      doc.moveDown(0.3)
      doc.font('Helvetica').text(timesheet.provider.signature, 50, doc.y)
    }

    if (isBCBA && timesheet.client.signature) {
      doc.moveDown(1)
      doc.fontSize(10).font('Helvetica-Bold').text('Client Signature:', 50, doc.y)
      doc.moveDown(0.3)
      doc.font('Helvetica').text(timesheet.client.signature, 50, doc.y)
    }

    doc.end()
  })
}
