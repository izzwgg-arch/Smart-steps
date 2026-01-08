'use client'

import { X, Printer } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'

interface Timesheet {
  id: string
  startDate: string
  endDate: string
  client: {
    name: string
    phone?: string | null
    id?: string
    idNumber?: string | null
    clientId?: string | null
    medicaidId?: string | null
    externalId?: string | null
    signature?: string | null
  }
  provider: {
    name: string
    phone?: string | null
    signature?: string | null
  }
  bcba: {
    name: string
  }
  entries: Array<{
    date: string
    startTime: string
    endTime: string
    minutes: number
    notes: string | null
  }>
}

interface TimesheetPrintPreviewProps {
  timesheet: Timesheet
  onClose: () => void
}

export function TimesheetPrintPreview({ timesheet, onClose }: TimesheetPrintPreviewProps) {
  // Calculate totals
  const drEntries = timesheet.entries.filter((e) => e.notes === 'DR')
  const svEntries = timesheet.entries.filter((e) => e.notes === 'SV')
  
  const totalDR = drEntries.reduce((sum, e) => sum + e.minutes / 60, 0)
  const totalSV = svEntries.reduce((sum, e) => sum + e.minutes / 60, 0)
  const total = totalDR + totalSV

  const formatTime = (time: string): string => {
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

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 no-print" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b no-print">
            <h2 className="text-xl font-bold">Timesheet Print Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 print-preview-content">
            {/* Header Text */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold uppercase tracking-wide">TIMESHEETS</h1>
            </div>

            {/* Client and Provider Info */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <div className="mb-2">
                  <span className="font-semibold">Child:</span> {timesheet.client.name || ''}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Phone:</span> {timesheet.client.phone || ''}
                </div>
                <div>
                  <span className="font-semibold">ID Number:</span>{' '}
                  {timesheet.client.idNumber || 
                   timesheet.client.clientId || 
                   timesheet.client.medicaidId || 
                   timesheet.client.externalId || 
                   ''}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <span className="font-semibold">Provider:</span> {timesheet.provider.name}
                </div>
                <div className="mb-2">
                  <span className="font-semibold">Phone:</span> {timesheet.provider.phone || ''}
                </div>
                <div>
                  <span className="font-semibold">BCBA:</span> {timesheet.bcba.name}
                </div>
              </div>
            </div>

            {/* Period */}
            <div className="mb-4">
              <span className="font-semibold">Period:</span>{' '}
              {format(new Date(timesheet.startDate), 'EEE M/d/yyyy').toLowerCase()} -{' '}
              {format(new Date(timesheet.endDate), 'EEE M/d/yyyy').toLowerCase()}
            </div>

            {/* Table */}
            <div className="mb-6 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-800">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">DATE</th>
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">IN</th>
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">OUT</th>
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">HOURS</th>
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">TYPE</th>
                    <th className="border border-gray-800 px-4 py-2 text-left font-semibold">LOCATION</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheet.entries
                    .sort((a, b) => {
                      const dateA = new Date(a.date).getTime()
                      const dateB = new Date(b.date).getTime()
                      if (dateA !== dateB) return dateA - dateB
                      const timeA = a.startTime
                      const timeB = b.startTime
                      return timeA.localeCompare(timeB)
                    })
                    .map((entry, index) => {
                      const entryDate = new Date(entry.date)

                      return (
                        <tr key={index}>
                          <td className="border border-gray-800 px-4 py-2">
                            {format(entryDate, 'EEE M/d/yyyy').toLowerCase()}
                          </td>
                          <td className="border border-gray-800 px-4 py-2">
                            {formatTime(entry.startTime)}
                          </td>
                          <td className="border border-gray-800 px-4 py-2">
                            {formatTime(entry.endTime)}
                          </td>
                          <td className="border border-gray-800 px-4 py-2">
                            {(entry.minutes / 60).toFixed(1)}
                          </td>
                          <td className="border border-gray-800 px-4 py-2">
                            {entry.notes || '-'}
                          </td>
                          <td className="border border-gray-800 px-4 py-2">Home</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mb-6">
              <div className="flex justify-end space-x-8 text-base font-semibold">
                <div>
                  Total DR: <span className="ml-2">{totalDR.toFixed(1)}</span>
                </div>
                <div>
                  Total SV: <span className="ml-2">{totalSV.toFixed(1)}</span>
                </div>
                <div>
                  Total: <span className="ml-2">{total.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <div className="mb-2">
                  <span className="font-semibold">Client Signature:</span>
                </div>
                {timesheet.client.signature ? (
                  <div className="mb-2">
                    <img
                      src={timesheet.client.signature}
                      alt="Client Signature"
                      className="max-h-20 max-w-full object-contain border border-gray-300 print:max-h-16"
                      style={{ maxHeight: '80px' }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="h-12 border-b border-gray-400 mb-1"></div>
                    <div className="text-xs text-gray-400 italic">(No signature on file)</div>
                  </>
                )}
              </div>
              <div>
                <div className="mb-2">
                  <span className="font-semibold">Provider Signature:</span>
                </div>
                {timesheet.provider.signature ? (
                  <div className="mb-2">
                    <img
                      src={timesheet.provider.signature}
                      alt="Provider Signature"
                      className="max-h-20 max-w-full object-contain border border-gray-300 print:max-h-16"
                      style={{ maxHeight: '80px' }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="h-12 border-b border-gray-400 mb-1"></div>
                    <div className="text-xs text-gray-400 italic">(No signature on file)</div>
                  </>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="text-sm text-gray-700 mt-6">
              <div className="mb-1">DR = Direct Service</div>
              <div>SV = Super Vision</div>
            </div>

            {/* Action Buttons - Hidden when printing */}
            <div className="mt-8 flex justify-end space-x-3 no-print">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
