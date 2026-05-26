'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { EmployeeMonthlyReportPayload } from '@/lib/payroll/employeeMonthlyReportBuilder'

interface EmployeeMonthlyReportProps {
  employeeId: string
  month?: string
}

export function EmployeeMonthlyReport({ employeeId, month }: EmployeeMonthlyReportProps) {
  const [data, setData] = useState<EmployeeMonthlyReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (employeeId && month) {
      fetchReportData()
    }
  }, [employeeId, month])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/payroll/reports/employee/${employeeId}?month=${month}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load report data')
      }

      const report = await response.json()
      setData(report)

      if (report.validation?.warnings?.length) {
        console.warn('[EmployeeMonthlyReport] validation warnings:', report.validation.warnings)
      }
    } catch (error: any) {
      console.error('Failed to fetch report data:', error)
      toast.error(error.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    if (!employeeId || !month) {
      toast.error('Missing required parameters')
      return
    }

    setExporting(true)
    try {
      const response = await fetch(`/api/payroll/reports/employee/${employeeId}/pdf?month=${month}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `employee-monthly-${data?.employee.fullName.replace(/\s+/g, '-')}-${month}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('PDF exported successfully')
    } catch (error: any) {
      console.error('Failed to export PDF:', error)
      toast.error(error.message || 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (value: string) => format(new Date(value), 'MMM d, yyyy')

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div class="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-gray-600">Unable to load report data. Please check the employee ID and month.</p>
      </div>
    )
  }

  const detailHours = data.timeEntries.reduce((sum, entry) => sum + entry.hours, 0)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/payroll/reports/employee"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employee Reports
        </Link>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </>
          )}
        </button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Monthly Report</h1>
      <p className="text-gray-600 mb-8">
        {data.employee.fullName} - {data.period.monthName} {data.period.year}
      </p>

      {data.validation.warnings.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-2">Report validation warnings</p>
          <ul className="list-disc pl-5 space-y-1">
            {data.validation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Employee Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">Name:</span>
            <span className="ml-2 text-sm text-gray-900">{data.employee.fullName}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Period:</span>
            <span className="ml-2 text-sm text-gray-900">{data.period.monthName} {data.period.year}</span>
          </div>
          {data.employee.email && (
            <div>
              <span className="text-sm font-medium text-gray-700">Email:</span>
              <span className="ml-2 text-sm text-gray-900">{data.employee.email}</span>
            </div>
          )}
          {data.employee.phone && (
            <div>
              <span className="text-sm font-medium text-gray-700">Phone:</span>
              <span className="ml-2 text-sm text-gray-900">{data.employee.phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total Hours</div>
            <div className="text-xl font-bold text-gray-900">{data.summary.totalHours.toFixed(2)}</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Hourly Rate</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(data.summary.hourlyRate)}</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Gross Pay</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(data.summary.grossPay)}</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total Paid</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(data.summary.totalPaid)}</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Amount Owed</div>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(data.summary.amountOwed)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Time Entries</h2>
        {data.timeEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Out Time</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Import</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.timeEntries.map((entry, index) => (
                  <tr key={`${entry.date}-${entry.inTime ?? 'na'}-${index}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.inTimeDisplay}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.outTimeDisplay}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{entry.hours.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.sourceImport || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-900">Total Hours</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{detailHours.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No time entries available for this period.</p>
        )}
      </div>

      {data.payments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.payments.map((payment, index) => (
                  <tr key={`${payment.date}-${index}`}>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.method}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
