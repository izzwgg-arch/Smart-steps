'use client'

import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { subMonths } from 'date-fns'
import toast from 'react-hot-toast'
import { FileText, Download } from 'lucide-react'

interface ReportsGeneratorProps {
  providers: Array<{ id: string; name: string }>
  clients: Array<{ id: string; name: string }>
  insurances: Array<{ id: string; name: string }>
}

export function ReportsGenerator({
  providers,
  clients,
  insurances,
}: ReportsGeneratorProps) {
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<
    'timesheets' | 'invoices' | 'insurance' | 'providers'
  >('timesheets')
  const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf')
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 1))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [providerId, setProviderId] = useState('')
  const [clientId, setClientId] = useState('')
  const [insuranceId, setInsuranceId] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('type', reportType)
      params.append('format', format)
      params.append('startDate', startDate.toISOString())
      params.append('endDate', endDate.toISOString())
      if (providerId) params.append('providerId', providerId)
      if (clientId) params.append('clientId', clientId)
      if (insuranceId) params.append('insuranceId', insuranceId)

      const res = await fetch(`/api/reports?${params.toString()}`)

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        // Get filename from Content-Disposition header
        const contentDisposition = res.headers.get('Content-Disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') ||
            `report.${format}`
          : `report.${format}`

        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success('Report generated successfully')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to generate report')
      }
    } catch (error) {
      toast.error('An error occurred while generating the report')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Generate Report
        </h2>

        <div className="space-y-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type <span className="text-red-500">*</span>
            </label>
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as 'timesheets' | 'invoices' | 'insurance' | 'providers'
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="timesheets">Timesheet Summary</option>
              <option value="invoices">Invoice Summary</option>
              <option value="insurance">Insurance Billing</option>
              <option value="providers">Provider Performance</option>
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format <span className="text-red-500">*</span>
            </label>
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as 'pdf' | 'csv' | 'xlsx')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => date && setStartDate(date)}
                dateFormat="MM/dd/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => date && setEndDate(date)}
                dateFormat="MM/dd/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Filters (Optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportType !== 'invoices' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provider
                  </label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Providers</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportType !== 'providers' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {reportType !== 'providers' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance
                  </label>
                  <select
                    value={insuranceId}
                    onChange={(e) => setInsuranceId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Insurance</option>
                    {insurances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? (
                'Generating...'
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
