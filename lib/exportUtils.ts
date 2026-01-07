import * as XLSX from 'xlsx'
import { formatDate } from './utils'

/**
 * Export data to CSV
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    return
  }

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV rows
  const rows = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null || value === undefined) return '""'
          const stringValue = String(value).replace(/"/g, '""')
          return `"${stringValue}"`
        })
        .join(',')
    ),
  ]

  const csvContent = rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
}

/**
 * Export data to Excel
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  if (data.length === 0) {
    return
  }

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Format providers for export
 */
export function formatProvidersForExport(providers: any[]) {
  return providers.map((p) => ({
    Name: p.name,
    Email: p.email || '',
    Phone: p.phone || '',
    Status: p.active ? 'Active' : 'Inactive',
    'Created Date': formatDate(p.createdAt),
  }))
}

/**
 * Format clients for export
 */
export function formatClientsForExport(clients: any[]) {
  return clients.map((c) => ({
    Name: c.name,
    Email: c.email || '',
    Phone: c.phone || '',
    Insurance: c.insurance?.name || '',
    Status: c.active ? 'Active' : 'Inactive',
    'Created Date': formatDate(c.createdAt),
  }))
}

/**
 * Format timesheets for export
 */
export function formatTimesheetsForExport(timesheets: any[]) {
  return timesheets.map((ts) => {
    const totalMinutes = ts.entries?.reduce((sum: number, e: any) => sum + e.minutes, 0) || 0
    const totalUnits = ts.entries?.reduce((sum: number, e: any) => sum + Number(e.units), 0) || 0
    
    return {
      ID: ts.id,
      Client: ts.client?.name || '',
      Provider: ts.provider?.name || '',
      BCBA: ts.bcba?.name || '',
      'Start Date': formatDate(ts.startDate),
      'End Date': formatDate(ts.endDate),
      Status: ts.status,
      'Total Hours': (totalMinutes / 60).toFixed(2),
      'Total Units': totalUnits.toFixed(2),
      'Created Date': formatDate(ts.createdAt),
    }
  })
}

/**
 * Format invoices for export
 */
export function formatInvoicesForExport(invoices: any[]) {
  return invoices.map((inv) => ({
    'Invoice Number': inv.invoiceNumber,
    Client: inv.client?.name || '',
    'Start Date': formatDate(inv.startDate),
    'End Date': formatDate(inv.endDate),
    Status: inv.status,
    'Total Amount': parseFloat(inv.totalAmount?.toString() || '0').toFixed(2),
    'Paid Amount': parseFloat(inv.paidAmount?.toString() || '0').toFixed(2),
    Outstanding: parseFloat(inv.outstanding?.toString() || '0').toFixed(2),
    'Check Number': inv.checkNumber || '',
    'Created Date': formatDate(inv.createdAt),
  }))
}
