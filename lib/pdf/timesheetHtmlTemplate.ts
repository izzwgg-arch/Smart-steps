/**
 * HTML Template for Timesheet PDF Generation
 * 
 * This template generates a self-contained HTML document that matches
 * the TimesheetPrintPreview modal layout exactly.
 * 
 * Used by Playwright to render PDFs with consistent styling.
 */

import { format } from 'date-fns'

interface TimesheetForHTML {
  id: string
  client: {
    name: string
    phone?: string | null
    address?: string | null
    dlb?: string | null
    signature?: string | null
  }
  provider: {
    name: string
    phone?: string | null
    signature?: string | null
    dlb?: string | null
  }
  bcba: {
    name: string
  }
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
 * Generate HTML string for timesheet PDF
 */
export function generateTimesheetHTML(timesheet: TimesheetForHTML): string {
  const isBCBA = timesheet.isBCBA
  
  // Calculate totals
  const drEntries = timesheet.entries.filter((e) => e.notes === 'DR')
  const svEntries = timesheet.entries.filter((e) => e.notes === 'SV')
  const bcbaEntries = timesheet.entries.filter((e) => !e.notes || e.notes === '')
  
  const totalDR = drEntries.reduce((sum, e) => sum + e.minutes / 60, 0)
  const totalSV = svEntries.reduce((sum, e) => sum + e.minutes / 60, 0)
  const totalBCBA = bcbaEntries.reduce((sum, e) => sum + e.minutes / 60, 0)
  const total = isBCBA ? totalBCBA : totalDR + totalSV
  
  // Sort entries by date and time
  const sortedEntries = [...timesheet.entries].sort((a, b) => {
    const dateA = typeof a.date === 'string' ? new Date(a.date).getTime() : a.date.getTime()
    const dateB = typeof b.date === 'string' ? new Date(b.date).getTime() : b.date.getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.startTime.localeCompare(b.startTime)
  })
  
  const startDate = typeof timesheet.startDate === 'string' ? new Date(timesheet.startDate) : timesheet.startDate
  const endDate = typeof timesheet.endDate === 'string' ? new Date(timesheet.endDate) : timesheet.endDate
  
  // Client signature as data URL if available
  const clientSigImg = timesheet.client.signature
    ? `<img src="${timesheet.client.signature}" alt="Client Signature" style="max-height: 80px; max-width: 100%; object-fit: contain; border: 1px solid #ccc;" />`
    : '<div style="height: 48px; border-bottom: 1px solid #666; margin-bottom: 4px;"></div><div style="font-size: 10px; color: #999; font-style: italic;">(No signature on file)</div>'
  
  const providerSigImg = timesheet.provider.signature
    ? `<img src="${timesheet.provider.signature}" alt="Provider Signature" style="max-height: 80px; max-width: 100%; object-fit: contain; border: 1px solid #ccc;" />`
    : '<div style="height: 48px; border-bottom: 1px solid #666; margin-bottom: 4px;"></div><div style="font-size: 10px; color: #999; font-style: italic;">(No signature on file)</div>'
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Timesheet - ${timesheet.id}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      padding: 0.5in;
      line-height: 1.4;
    }
    
    .header {
      text-align: center;
      margin-bottom: 16px;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 24px;
    }
    
    .info-item {
      margin-bottom: 8px;
    }
    
    .info-label {
      font-weight: bold;
    }
    
    .service-type {
      color: rgb(13, 148, 136);
    }
    
    .period {
      margin-bottom: 16px;
    }
    
    .period-label {
      font-weight: bold;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 24px;
    }
    
    th {
      background-color: #f0f0f0;
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
      font-weight: bold;
    }
    
    td {
      border: 1px solid #000;
      padding: 8px;
    }
    
    .totals {
      display: flex;
      justify-content: flex-end;
      gap: 32px;
      margin-bottom: 24px;
      font-weight: bold;
      font-size: 14px;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 24px;
    }
    
    .signature-label {
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .legend {
      font-size: 12px;
      color: #333;
      margin-top: 24px;
    }
    
    .legend-item {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Smart Steps ABA</h1>
    ${!isBCBA ? '<div class="subtitle">TIMESHEETS</div>' : ''}
  </div>
  
  <div class="info-grid">
    <div>
      <div class="info-item">
        <span class="info-label">${isBCBA ? 'Client:' : 'Child:'}</span> ${timesheet.client.name || ''}
      </div>
      ${isBCBA && timesheet.client.address ? `
      <div class="info-item">
        <span class="info-label">Address:</span> ${timesheet.client.address}
      </div>
      ` : ''}
      <div class="info-item">
        <span class="info-label">Phone:</span> ${timesheet.client.phone || ''}
      </div>
      ${isBCBA && (timesheet.client.dlb || timesheet.provider.dlb) ? `
      <div class="info-item">
        <span class="info-label">DLB:</span> ${timesheet.client.dlb || timesheet.provider.dlb || ''}
      </div>
      ` : ''}
    </div>
    <div>
      <div class="info-item">
        <span class="info-label">Provider:</span> ${timesheet.provider.name}
      </div>
      <div class="info-item">
        <span class="info-label">Phone:</span> ${timesheet.provider.phone || ''}
      </div>
      <div class="info-item">
        <span class="info-label">BCBA:</span> ${timesheet.bcba.name}
      </div>
      ${isBCBA && timesheet.serviceType ? `
      <div class="info-item">
        <span class="info-label">Service Type:</span>
        <span class="service-type">${timesheet.serviceType}</span>
      </div>
      ` : ''}
      ${isBCBA && timesheet.sessionData ? `
      <div class="info-item">
        <span class="info-label">Session Data / Analysis:</span> ${timesheet.sessionData}
      </div>
      ` : ''}
    </div>
  </div>
  
  <div class="period">
    <span class="period-label">Period:</span> ${format(startDate, 'EEE M/d/yyyy').toLowerCase()} - ${format(endDate, 'EEE M/d/yyyy').toLowerCase()}
  </div>
  
  <table>
    <thead>
      <tr>
        <th>DATE</th>
        <th>IN</th>
        <th>OUT</th>
        <th>HOURS</th>
        ${!isBCBA ? '<th>TYPE</th><th>LOCATION</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${sortedEntries.map((entry) => {
        const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date
        return `
        <tr>
          <td>${format(entryDate, 'EEE M/d/yyyy').toLowerCase()}</td>
          <td>${formatTime(entry.startTime)}</td>
          <td>${formatTime(entry.endTime)}</td>
          <td>${(entry.minutes / 60).toFixed(1)}</td>
          ${!isBCBA ? `
          <td>${entry.notes || '-'}</td>
          <td>Home</td>
          ` : ''}
        </tr>
        `
      }).join('')}
    </tbody>
  </table>
  
  <div class="totals">
    ${!isBCBA ? `
    <div>Total DR: <span>${totalDR.toFixed(1)}</span></div>
    <div>Total SV: <span>${totalSV.toFixed(1)}</span></div>
    ` : ''}
    <div>Total: <span>${total.toFixed(1)}</span></div>
  </div>
  
  <div class="signatures">
    <div>
      <div class="signature-label">Client Signature:</div>
      ${clientSigImg}
    </div>
    <div>
      <div class="signature-label">Provider Signature:</div>
      ${providerSigImg}
    </div>
  </div>
  
  ${!isBCBA ? `
  <div class="legend">
    <div class="legend-item">DR = Direct Service</div>
    <div class="legend-item">SV = Super Vision</div>
  </div>
  ` : ''}
</body>
</html>`
}
