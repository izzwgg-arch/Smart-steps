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
    signature?: string | null
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
  // For BCBA timesheets, include ALL entries (they may have service type in notes)
  const bcbaEntries = isBCBA ? timesheet.entries : timesheet.entries.filter((e) => !e.notes || e.notes === '')
  
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
    ? `<div class="signature-container"><img src="${timesheet.client.signature}" alt="Client Signature" /></div>`
    : '<div style="height: 48px; border-bottom: 1px solid #666; margin-bottom: 4px;"></div><div style="font-size: 10px; color: #999; font-style: italic;">(No signature on file)</div>'
  
  const providerSigImg = timesheet.provider.signature
    ? `<div class="signature-container"><img src="${timesheet.provider.signature}" alt="Provider Signature" /></div>`
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
    
    /* Modern Header with Gradient */
    .modern-header {
      margin-bottom: 24px;
    }
    
    .header-gradient {
      background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
      padding: 16px 24px;
      border-radius: 10px;
      box-shadow: 0 3px 8px rgba(0, 102, 204, 0.3);
      position: relative;
      overflow: hidden;
    }
    
    .header-gradient::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #00aaff 0%, #0066cc 50%, #004499 100%);
    }
    
    .header-gradient h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      text-align: center;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .header-accent-line {
      height: 2px;
      background: rgba(255, 255, 255, 0.3);
      margin-top: 8px;
      border-radius: 2px;
    }
    
    /* Modern Info Cards */
    .info-card {
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
    }
    
    .info-item {
      margin-bottom: 8px;
    }
    
    .info-label {
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      font-weight: 600;
      color: #1e293b;
      font-size: 14px;
      margin-top: 4px;
    }
    
    .service-type {
      color: rgb(13, 148, 136);
      font-weight: 600;
    }
    
    .period {
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    
    .period-label {
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    
    /* Modern Table Design */
    .modern-table-container {
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      margin-bottom: 24px;
    }
    
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    
    th {
      background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 12px 14px;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: none;
    }
    
    th:first-child {
      border-top-left-radius: 12px;
    }
    
    th:last-child {
      border-top-right-radius: 12px;
    }
    
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 14px;
      font-size: 10px;
    }
    
    tbody tr:nth-child(even) {
      background: #ffffff;
    }
    
    tbody tr:nth-child(odd) {
      background: #f8fafc;
    }
    
    .date-badge {
      display: inline-block;
      background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
      color: #0369a1;
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 10px;
      border: 1px solid #7dd3fc;
      box-shadow: 0 2px 4px rgba(3, 105, 161, 0.1);
    }
    
    .totals {
      display: flex;
      justify-content: flex-end;
      gap: 32px;
      margin-bottom: 24px;
      font-weight: bold;
      font-size: 14px;
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: ${isBCBA ? '1fr' : '1fr 1fr'};
      gap: 32px;
      margin-bottom: 24px;
    }
    
    .signature-label {
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .signature-container {
      display: inline-block;
      padding: 8px;
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .signature-container img {
      max-height: 50px;
      max-width: 180px;
      object-fit: contain;
      display: block;
    }
    
    .legend {
      font-size: 12px;
      color: #333;
      margin-top: 24px;
      background: #f8fafc;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
    }
    
    .legend-item {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="modern-header">
    <div class="header-gradient">
      <h1>${isBCBA ? 'BCBA TIMESHEET' : 'TIMESHEET'} SMART STEPS ABA</h1>
      <div class="header-accent-line"></div>
    </div>
  </div>
  
  <div class="info-card">
    ${isBCBA ? `
    <div>
      <div class="info-item">
        <span class="info-label">BCBA</span>
        <div class="info-value">${timesheet.bcba.name}</div>
      </div>
      <div class="info-item">
        <span class="info-label">Client</span>
        <div class="info-value">${timesheet.client.name || 'N/A'}</div>
      </div>
      ${timesheet.client.address ? `
      <div class="info-item">
        <span class="info-label">Address</span>
        <div class="info-value">${timesheet.client.address}</div>
      </div>
      ` : ''}
      <div class="info-item">
        <span class="info-label">Phone</span>
        <div class="info-value">${timesheet.client.phone || 'N/A'}</div>
      </div>
      ${timesheet.sessionData ? `
      <div class="info-item">
        <span class="info-label">Session Data / Analysis</span>
        <div class="info-value">${timesheet.sessionData}</div>
      </div>
      ` : ''}
      ${timesheet.client.dlb ? `
      <div class="info-item">
        <span class="info-label">DLB</span>
        <div class="info-value">${timesheet.client.dlb}</div>
      </div>
      ` : ''}
    </div>
    ` : `
    <div>
      <div class="info-item">
        <span class="info-label">Provider</span>
        <div class="info-value">${timesheet.provider.name}</div>
      </div>
      <div class="info-item">
        <span class="info-label">BCBA</span>
        <div class="info-value">${timesheet.bcba.name}</div>
      </div>
      <div class="info-item">
        <span class="info-label">Child</span>
        <div class="info-value">${timesheet.client.name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <span class="info-label">Phone</span>
        <div class="info-value">${timesheet.client.phone || 'N/A'}</div>
      </div>
    </div>
    `}
  </div>
  
  <div class="period">
    <span class="period-label">Period</span>
    <div class="info-value">${format(startDate, 'EEE M/d/yyyy').toLowerCase()} - ${format(endDate, 'EEE M/d/yyyy').toLowerCase()}</div>
  </div>
  
  <div class="modern-table-container">
  <table>
    <thead>
      <tr>
        <th>DATE</th>
        ${isBCBA ? '<th>TYPE</th>' : ''}
        <th>IN</th>
        <th>OUT</th>
        <th>HOURS</th>
        ${!isBCBA ? '<th>TYPE</th><th>LOCATION</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${sortedEntries.map((entry) => {
        const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date
        // Helper function to convert service type to initials
        const getServiceTypeInitials = (serviceType: string | null | undefined): string => {
          if (!serviceType) return '-'
          switch (serviceType) {
            case 'Assessment': return 'A'
            case 'Direct Care': return 'DC'
            case 'Supervision': return 'S'
            case 'Treatment Planning': return 'TP'
            case 'Parent Training': return 'PT'
            default: return '-'
          }
        }
        // For BCBA timesheets, check if notes contains a valid service type
        let entryServiceType = null
        if (isBCBA) {
          const serviceTypes = ['Assessment', 'Direct Care', 'Supervision', 'Treatment Planning', 'Parent Training']
          if (entry.notes && serviceTypes.includes(entry.notes)) {
            entryServiceType = entry.notes
          } else if (timesheet.serviceType) {
            entryServiceType = timesheet.serviceType
          }
        }
        const serviceTypeInitials = isBCBA ? getServiceTypeInitials(entryServiceType) : ''
        return `
        <tr>
          <td><span class="date-badge">${format(entryDate, 'EEE M/d/yyyy').toLowerCase()}</span></td>
          ${isBCBA ? `<td>${serviceTypeInitials}</td>` : ''}
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
  </div>
  
  <div class="totals">
    ${!isBCBA ? `
    <div>Total DR: <span>${totalDR.toFixed(1)}</span></div>
    <div>Total SV: <span>${totalSV.toFixed(1)}</span></div>
    ` : ''}
    <div>Total: <span>${total.toFixed(1)}</span></div>
  </div>
  
  <div class="signatures">
    ${isBCBA ? `
    <div>
      <div class="signature-label">BCBA Signature</div>
      ${timesheet.bcba.signature
        ? `<div class="signature-container"><img src="${timesheet.bcba.signature}" alt="BCBA Signature" /></div>`
        : '<div style="height: 48px; border-bottom: 1px solid #666; margin-bottom: 4px;"></div><div style="font-size: 10px; color: #999; font-style: italic;">(No signature on file)</div>'}
    </div>
    ` : `
    <div>
      <div class="signature-label">Client Signature:</div>
      ${clientSigImg}
    </div>
    <div>
      <div class="signature-label">Provider Signature:</div>
      ${providerSigImg}
    </div>
    `}
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
