'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, DollarSign, Edit, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { format } from 'date-fns'
import { to12Hour } from '@/lib/dateUtils'

interface InvoiceDetailProps {
  invoiceId: string
  userRole: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  status: string
  startDate: string
  endDate: string
  totalAmount: number | string
  paidAmount: number | string
  adjustments: number | string
  outstanding: number | string
  checkNumber: string | null
  notes: string | null
  client: {
    name: string
    insurance: {
      name: string
    }
  }
  entries: Array<{
    id: string
    units: number | string
    rate: number | string
    amount: number | string
    provider: {
      name: string
    }
    timesheet: {
      startDate: string
      endDate: string
      bcba: {
        name: string
      }
      entries: Array<{
        id: string
        date: string
        startTime: string
        endTime: string
        minutes: number
        units: number | string
        notes: string | null
      }>
    }
  }>
  payments: Array<{
    id: string
    amount: number | string
    paymentDate: string
    referenceNumber: string | null
    notes: string | null
  }>
  adjustmentsList: Array<{
    id: string
    amount: number | string
    reason: string
    createdAt: string
  }>
}

export function InvoiceDetail({ invoiceId, userRole }: InvoiceDetailProps) {
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [debugData, setDebugData] = useState<any>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`)
      if (res.ok) {
        const data = await res.json()
        setInvoice(data)
      } else {
        toast.error('Failed to load invoice')
      }
    } catch (error) {
      toast.error('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  const refreshInvoice = () => {
    fetchInvoice()
  }

  const fetchDebugData = async () => {
    if (!showDebugPanel) {
      setShowDebugPanel(true)
      setLoadingDebug(true)
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/debug`)
        if (res.ok) {
          const data = await res.json()
          setDebugData(data)
        } else {
          toast.error('Failed to load debug data')
        }
      } catch (error) {
        toast.error('Failed to load debug data')
      } finally {
        setLoadingDebug(false)
      }
    } else {
      setShowDebugPanel(false)
      setDebugData(null)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading invoice...</div>
  }

  if (!invoice) {
    return <div className="text-center py-12">Invoice not found</div>
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'READY':
        return 'bg-blue-100 text-blue-800'
      case 'SENT':
        return 'bg-purple-100 text-purple-800'
      case 'PARTIALLY_PAID':
        return 'bg-yellow-100 text-yellow-800'
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'VOID':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center text-white hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#ffffff' }}>
              Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-gray-600 mt-1">
              {format(new Date(invoice.startDate), 'MMM d')} -{' '}
              {format(new Date(invoice.endDate), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex space-x-3">
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(
                invoice.status
              )}`}
            >
              {invoice.status.replace('_', ' ')}
            </span>
            {userRole === 'ADMIN' && (
              <div className="flex space-x-2">
                {(['DRAFT', 'READY'].includes(invoice.status)) && (
                  <Link
                    href={`/invoices/${invoice.id}/edit`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-2"
                    style={{ color: '#000000' }}
                  >
                    <Edit className="w-4 h-4" style={{ color: '#000000' }} />
                    <span style={{ color: '#000000' }}>Edit</span>
                  </Link>
                )}
                <button 
                  onClick={async () => {
                    try {
                      const url = `/api/invoices/${invoiceId}/pdf`
                      const response = await fetch(url)
                      if (!response.ok) {
                        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }))
                        toast.error(error.error || 'Failed to generate PDF')
                        return
                      }
                      const blob = await response.blob()
                      const pdfUrl = URL.createObjectURL(blob)
                      window.open(pdfUrl, '_blank')
                      // Clean up the URL after a delay
                      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000)
                    } catch (error) {
                      console.error('Error generating PDF:', error)
                      toast.error('Failed to generate PDF')
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center space-x-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Client</label>
                <p className="font-medium">{invoice.client.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Insurance</label>
                <p className="font-medium">{invoice.client.insurance.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Period</label>
                <p className="font-medium">
                  {format(new Date(invoice.startDate), 'MMM d, yyyy')} -{' '}
                  {format(new Date(invoice.endDate), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Provider(s)</label>
                <p className="font-medium">
                  {Array.from(
                    new Set(invoice.entries.map((e) => e.provider.name))
                  ).join(', ')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">BCBA(s)</label>
                <p className="font-medium">
                  {Array.from(
                    new Set(
                      invoice.entries.map((e) => e.timesheet.bcba?.name || 'N/A')
                    )
                  ).join(', ')}
                </p>
              </div>
              {invoice.checkNumber && (
                <div>
                  <label className="text-sm text-gray-500">Check Number</label>
                  <p className="font-medium">{invoice.checkNumber}</p>
                </div>
              )}
            </div>
            {invoice.notes && (
              <div className="mt-4">
                <label className="text-sm text-gray-500">Notes</label>
                <p className="mt-1">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Entries - Detailed Line Items */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Line Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Day
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Provider
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      DR From/To
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      SV From/To
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Minutes
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Units
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    // Flatten all timesheet entries and group by date
                    const allEntries: Array<{
                      date: Date
                      dayName: string
                      provider: string
                      drFrom: string | null
                      drTo: string | null
                      svFrom: string | null
                      svTo: string | null
                      drMinutes: number
                      svMinutes: number
                      drUnits: number
                      svUnits: number
                    }> = []

                    // CRITICAL: Use InvoiceEntry units (stored in database after fix)
                    // Each InvoiceEntry represents one TimesheetEntry
                    // Match InvoiceEntry to TimesheetEntry and use InvoiceEntry.units
                    const invoiceEntryMap = new Map<string, { units: number; amount: number }>()
                    
                    // First, try to match InvoiceEntry to TimesheetEntry by amount
                    invoice.entries.forEach((invoiceEntry) => {
                      const invoiceEntryUnits = parseFloat(invoiceEntry.units.toString())
                      const invoiceEntryAmount = parseFloat(invoiceEntry.amount.toString())
                      const rate = parseFloat(invoiceEntry.rate.toString())
                      
                      if (invoiceEntry.timesheet?.entries) {
                        // Try to find matching timesheet entry
                        let matched = false
                        for (const tsEntry of invoiceEntry.timesheet.entries) {
                          const calculatedUnits = Math.ceil(tsEntry.minutes / 15)
                          const calculatedAmount = calculatedUnits * rate
                          
                          // Match by amount (most reliable)
                          if (Math.abs(calculatedAmount - invoiceEntryAmount) < 0.01) {
                            invoiceEntryMap.set(tsEntry.id, { units: invoiceEntryUnits, amount: invoiceEntryAmount })
                            matched = true
                            break
                          }
                        }
                        
                        // If no match, assign to first unmatched entry
                        if (!matched && invoiceEntry.timesheet.entries.length > 0) {
                          const firstEntry = invoiceEntry.timesheet.entries[0]
                          if (!invoiceEntryMap.has(firstEntry.id)) {
                            invoiceEntryMap.set(firstEntry.id, { units: invoiceEntryUnits, amount: invoiceEntryAmount })
                          }
                        }
                      }
                    })

                    invoice.entries.forEach((invoiceEntry) => {
                      invoiceEntry.timesheet.entries.forEach((tsEntry) => {
                        const entryDate = new Date(tsEntry.date)
                        const dayName = format(entryDate, 'EEE').toLowerCase()
                        
                        // Find or create entry for this date
                        let dateEntry = allEntries.find(
                          (e) => format(e.date, 'yyyy-MM-dd') === format(entryDate, 'yyyy-MM-dd')
                        )

                        if (!dateEntry) {
                          dateEntry = {
                            date: entryDate,
                            dayName,
                            provider: invoiceEntry.provider.name,
                            drFrom: null,
                            drTo: null,
                            svFrom: null,
                            svTo: null,
                            drMinutes: 0,
                            svMinutes: 0,
                            drUnits: 0,
                            svUnits: 0,
                          }
                          allEntries.push(dateEntry)
                        }

                        // Calculate correct units from minutes (always use this as source of truth)
                        const calculatedUnits = Math.ceil(tsEntry.minutes / 15)
                        const matchedEntry = invoiceEntryMap.get(tsEntry.id)
                        
                        // Use matched InvoiceEntry units ONLY if they match the calculated units
                        // This prevents displaying incorrect stored values (e.g., 30 units for 90 minutes)
                        const unitsToUse = (matchedEntry && Math.abs(matchedEntry.units - calculatedUnits) < 0.1) 
                          ? matchedEntry.units 
                          : calculatedUnits

                        // Add DR or SV entry
                        if (tsEntry.notes === 'DR') {
                          dateEntry.drFrom = to12Hour(tsEntry.startTime)
                          dateEntry.drTo = to12Hour(tsEntry.endTime)
                          dateEntry.drMinutes = tsEntry.minutes
                          dateEntry.drUnits = unitsToUse
                        } else if (tsEntry.notes === 'SV') {
                          dateEntry.svFrom = to12Hour(tsEntry.startTime)
                          dateEntry.svTo = to12Hour(tsEntry.endTime)
                          dateEntry.svMinutes = tsEntry.minutes
                          dateEntry.svUnits = unitsToUse
                        }
                      })
                    })

                    // Sort by date
                    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime())

                    // Calculate totals from line items (not from invoice.entries)
                    const totalMinutesFromLineItems = allEntries.reduce((sum, e) => sum + e.drMinutes + e.svMinutes, 0)
                    const totalUnitsFromLineItems = allEntries.reduce((sum, e) => sum + e.drUnits + e.svUnits, 0)

                    // Store totals for use in footer
                    const invoiceTotals = {
                      totalMinutes: totalMinutesFromLineItems,
                      totalUnits: totalUnitsFromLineItems,
                    }

                    return allEntries.map((entry, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">
                          {format(entry.date, 'M/d/yyyy')}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 capitalize">
                          {entry.dayName}
                        </td>
                        <td className="px-4 py-2 text-sm">{entry.provider}</td>
                        <td className="px-4 py-2 text-sm text-center">
                          {entry.drFrom && entry.drTo ? (
                            <span>
                              {entry.drFrom} - {entry.drTo}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-center">
                          {entry.svFrom && entry.svTo ? (
                            <span>
                              {entry.svFrom} - {entry.svTo}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {entry.drMinutes + entry.svMinutes}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {(entry.drUnits + entry.svUnits).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  })()}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-right">
                      Totals:
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-right">
                      {(() => {
                        // Calculate totals from the line items displayed above
                        // This matches what's shown in the table rows
                        let totalMinutes = 0
                        invoice.entries.forEach((invoiceEntry) => {
                          if (invoiceEntry.timesheet?.entries) {
                            invoiceEntry.timesheet.entries.forEach((tsEntry) => {
                              totalMinutes += tsEntry.minutes || 0
                            })
                          }
                        })
                        return totalMinutes
                      })()}
                    </td>
                    <td className="px-4 py-2 text-sm font-semibold text-right">
                      {(() => {
                        // Calculate totals from invoice entries (what was actually billed)
                        // This should match invoice.totalAmount
                        let totalUnits = 0
                        invoice.entries.forEach((entry) => {
                          totalUnits += parseFloat(entry.units.toString())
                        })
                        return totalUnits.toFixed(2)
                      })()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-right">
                      Rate per Unit:
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-right">
                      {formatCurrency(invoice.entries[0]?.rate || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-right">
                      Total Amount Due:
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-sm font-bold text-right text-primary-600">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Payments</h2>
              {userRole === 'ADMIN' && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Payment</span>
                </button>
              )}
            </div>
            {invoice.payments.length > 0 ? (
              <div className="space-y-3">
                {invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-3 border border-gray-200 rounded"
                  >
                    <div>
                      <div className="font-medium">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                        {payment.referenceNumber && ` • ${payment.referenceNumber}`}
                      </div>
                      {payment.notes && (
                        <div className="text-sm text-gray-500 mt-1">
                          {payment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No payments recorded</p>
            )}
          </div>

          {/* Adjustments */}
          {userRole === 'ADMIN' && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Adjustments</h2>
                <button
                  onClick={() => setShowAdjustmentModal(true)}
                  className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Adjustment</span>
                </button>
              </div>
              {invoice.adjustmentsList.length > 0 ? (
                <div className="space-y-3">
                  {invoice.adjustmentsList.map((adjustment) => (
                    <div
                      key={adjustment.id}
                      className="flex justify-between items-start p-3 border border-gray-200 rounded"
                    >
                      <div>
                        <div
                          className={`font-medium ${
                            parseFloat(adjustment.amount.toString()) < 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(adjustment.amount)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {adjustment.reason}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {format(new Date(adjustment.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No adjustments</p>
              )}
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {userRole === 'ADMIN' && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Debug Calculation</h2>
                <button
                  onClick={fetchDebugData}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                >
                  {showDebugPanel ? 'Hide' : 'Show'}
                </button>
              </div>
              {showDebugPanel && (
                <div className="mt-4">
                  {loadingDebug ? (
                    <p className="text-sm text-gray-500">Loading debug data...</p>
                  ) : debugData ? (
                    <div className="space-y-4 text-sm">
                      <div className="border-b pb-2">
                        <p className="font-semibold">Calculation Summary</p>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Minutes:</span>
                            <span className="font-mono">{debugData.calculation.totalMinutes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Units Raw:</span>
                            <span className="font-mono">{debugData.calculation.totalUnitsRaw.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Units Billed (ceil):</span>
                            <span className="font-mono font-semibold">{debugData.calculation.totalUnitsBilled}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Rate per Unit:</span>
                            <span className="font-mono">${debugData.insurance.ratePerUnit.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calculated Amount:</span>
                            <span className="font-mono">${debugData.calculation.totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Invoice Amount:</span>
                            <span className="font-mono">${debugData.calculation.invoiceTotalAmount.toFixed(2)}</span>
                          </div>
                          {Math.abs(debugData.calculation.difference) > 0.01 && (
                            <div className="flex justify-between text-red-600">
                              <span>Difference:</span>
                              <span className="font-mono">${debugData.calculation.difference.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="border-b pb-2">
                        <p className="font-semibold">Insurance</p>
                        <div className="mt-2 text-xs">
                          <p><span className="text-gray-600">Name:</span> {debugData.insurance.name}</p>
                          <p><span className="text-gray-600">Unit Minutes:</span> {debugData.insurance.unitMinutes}</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold mb-2">Entry Breakdown ({debugData.entries.length} entries)</p>
                        <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
                          {debugData.entries.slice(0, 10).map((entry: any, idx: number) => (
                            <div key={idx} className="border-l-2 border-gray-200 pl-2 py-1">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{entry.date}</span>
                                <span className="font-mono">{entry.minutes} min</span>
                              </div>
                              <div className="flex justify-between text-gray-500">
                                <span>{entry.startTime} - {entry.endTime}</span>
                                <span className="font-mono">{entry.unitsBilled} units × ${entry.ratePerUnit} = ${entry.amount.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                          {debugData.entries.length > 10 && (
                            <p className="text-gray-500 italic">... and {debugData.entries.length - 10} more entries</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No debug data available</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              {parseFloat(invoice.adjustments.toString()) !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Adjustments</span>
                  <span
                    className={`font-medium ${
                      parseFloat(invoice.adjustments.toString()) < 0
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {formatCurrency(invoice.adjustments)}
                  </span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total Due</span>
                <span className="font-bold text-lg">
                  {formatCurrency(
                    parseFloat(invoice.totalAmount.toString()) +
                      parseFloat(invoice.adjustments.toString())
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Outstanding</span>
                <span className="font-bold text-lg text-primary-600">
                  {formatCurrency(invoice.outstanding)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && userRole === 'ADMIN' && (
        <PaymentModal
          invoiceId={invoiceId}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false)
            refreshInvoice()
          }}
        />
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && userRole === 'ADMIN' && (
        <AdjustmentModal
          invoiceId={invoiceId}
          onClose={() => setShowAdjustmentModal(false)}
          onSuccess={() => {
            setShowAdjustmentModal(false)
            refreshInvoice()
          }}
        />
      )}
    </div>
  )
}

// Payment Modal Component
function PaymentModal({
  invoiceId,
  onClose,
  onSuccess,
}: {
  invoiceId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date())
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentDate: paymentDate.toISOString(),
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        }),
      })

      if (res.ok) {
        toast.success('Payment recorded successfully')
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to record payment')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Record Payment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={format(paymentDate, 'yyyy-MM-dd')}
              onChange={(e) => setPaymentDate(new Date(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Adjustment Modal Component
function AdjustmentModal({
  invoiceId,
  onClose,
  onSuccess,
}: {
  invoiceId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || parseFloat(amount) === 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (!reason.trim()) {
      toast.error('Please enter a reason for the adjustment')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          reason: reason.trim(),
        }),
      })

      if (res.ok) {
        toast.success('Adjustment recorded successfully')
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create adjustment')
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Add Adjustment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Use negative value for deductions, positive for credits
            </p>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Explain the reason for this adjustment"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
