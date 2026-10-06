'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ArrowLeft } from 'lucide-react'

export function EmployeeMonthlyReportSelector() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [endDate, setEndDate] = useState<Date | null>(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/payroll/employees')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data.employees || [])
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = () => {
    if (!selectedEmployeeId || !startDate || !endDate) {
      alert('Please select an employee and date range')
      return
    }

    if (endDate < startDate) {
      alert('End date must be after start date')
      return
    }

    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    router.push(`/payroll/reports/employee/${selectedEmployeeId}?startDate=${startStr}&endDate=${endStr}`)
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <Link
        href="/payroll/reports"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Reports
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Employee Report</h1>
      <p className="text-gray-600 mb-8">
        Select an employee and date range to generate a detailed payroll report. Use custom dates for any payroll period, including twice-monthly splits.
      </p>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled={loading}
            >
              <option value="">Select an employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date *
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="MMM d, yyyy"
                minDate={startDate || undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Link
              href="/payroll/reports"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleGenerate}
              disabled={!selectedEmployeeId || !startDate || !endDate || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
