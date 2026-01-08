'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Download, Search, Printer, Edit, Trash2, Send, Check, X, FileText, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { TimesheetPrintPreview } from './TimesheetPrintPreview'
import { exportToCSV, exportToExcel, formatTimesheetsForExport, formatTimesheetForDetailedExport } from '@/lib/exportUtils'
import { RowActionsMenu } from '@/components/shared/RowActionsMenu'

interface Timesheet {
  id: string
  status: string
  startDate: string
  endDate: string
  client: { name: string; phone?: string | null; id?: string }
  provider: { name: string; phone?: string | null; signature?: string | null }
  bcba: { name: string }
  entries: Array<{ 
    date: string
    startTime: string
    endTime: string
    minutes: number
    notes: string | null
  }>
}

export function TimesheetsList() {
  const router = useRouter()
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [printTimesheet, setPrintTimesheet] = useState<Timesheet | null>(null)
  const [userRole, setUserRole] = useState<string>('USER')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchTimesheets()
    // Get user role from session
    fetch('/api/auth/session').then(res => res.json()).then(data => {
      if (data?.user?.role) {
        setUserRole(data.user.role)
      }
    })
  }, [page])

  const fetchTimesheets = async () => {
    try {
      const res = await fetch(`/api/timesheets?page=${page}&limit=25&search=${searchTerm}`)
      if (res.ok) {
        const data = await res.json()
        setTimesheets(data.timesheets)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      toast.error('Failed to load timesheets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (page === 1) {
        fetchTimesheets()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(delayDebounce)
  }, [searchTerm])

  const handleSubmit = async (id: string) => {
    try {
      const res = await fetch(`/api/timesheets/${id}/submit`, { method: 'POST' })
      if (res.ok) {
        toast.success('Timesheet submitted')
        fetchTimesheets()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit timesheet')
      }
    } catch (error) {
      toast.error('Failed to submit timesheet')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/timesheets/${id}/approve`, { method: 'POST' })
      if (res.ok) {
        toast.success('Timesheet approved')
        fetchTimesheets()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to approve timesheet')
      }
    } catch (error) {
      toast.error('Failed to approve timesheet')
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason || !reason.trim()) return

    try {
      const res = await fetch(`/api/timesheets/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (res.ok) {
        toast.success('Timesheet rejected')
        fetchTimesheets()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to reject timesheet')
      }
    } catch (error) {
      toast.error('Failed to reject timesheet')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timesheet?')) return

    try {
      const res = await fetch(`/api/timesheets/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Timesheet deleted')
        fetchTimesheets()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete timesheet')
      }
    } catch (error) {
      toast.error('Failed to delete timesheet')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'LOCKED':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateTotalHours = (timesheet: Timesheet) => {
    const totalMinutes = timesheet.entries.reduce((sum, entry) => sum + entry.minutes, 0)
    return (totalMinutes / 60).toFixed(1)
  }

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExportCSV = () => {
    const data = formatTimesheetsForExport(timesheets)
    exportToCSV(data, `timesheets-${new Date().toISOString().split('T')[0]}`)
    setShowExportMenu(false)
    toast.success('Timesheets exported to CSV')
  }

  const handleExportExcel = () => {
    const data = formatTimesheetsForExport(timesheets)
    exportToExcel(data, `timesheets-${new Date().toISOString().split('T')[0]}`, 'Timesheets')
    setShowExportMenu(false)
    toast.success('Timesheets exported to Excel')
  }

  if (loading) {
    return <div className="text-center py-12">Loading timesheets...</div>
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timesheets</h1>
        </div>
        <div className="flex space-x-3">
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </button>
                </div>
              </div>
            )}
          </div>
          <Link
            href="/timesheets/new"
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Timesheet</span>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by client or provider..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="px-3 py-2 border border-gray-300 rounded-md">
          <option>25 per page</option>
          <option>50 per page</option>
          <option>100 per page</option>
        </select>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CLIENT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PROVIDER
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                BCBA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                START
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                END
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                HOURS
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                STATUS
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timesheets.map((timesheet) => (
              <tr key={timesheet.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {timesheet.client.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {timesheet.provider.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {timesheet.bcba.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(timesheet.startDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(timesheet.endDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {calculateTotalHours(timesheet)}H
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      timesheet.status
                    )}`}
                  >
                    {timesheet.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <RowActionsMenu>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/timesheets/${timesheet.id}`)
                          if (res.ok) {
                            const data = await res.json()
                            setPrintTimesheet(data)
                          }
                        } catch (error) {
                          toast.error('Failed to load timesheet')
                        }
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/timesheets/${timesheet.id}`)
                          if (res.ok) {
                            const data = await res.json()
                            const exportData = formatTimesheetForDetailedExport(data)
                            exportToCSV(exportData, `timesheet-${new Date().toISOString().split('T')[0]}`)
                            toast.success('Timesheet exported to CSV')
                          }
                        } catch (error) {
                          toast.error('Failed to export timesheet')
                        }
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Export CSV
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/timesheets/${timesheet.id}`)
                          if (res.ok) {
                            const data = await res.json()
                            const exportData = formatTimesheetForDetailedExport(data)
                            exportToExcel(exportData, `timesheet-${new Date().toISOString().split('T')[0]}`, 'Timesheet')
                            toast.success('Timesheet exported to Excel')
                          }
                        } catch (error) {
                          toast.error('Failed to export timesheet')
                        }
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Excel
                    </button>
                    {timesheet.status === 'DRAFT' && (
                      <Link
                        href={`/timesheets/${timesheet.id}/edit`}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Link>
                    )}
                    {timesheet.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSubmit(timesheet.id)}
                        className="flex items-center w-full px-4 py-2 text-sm text-blue-700 hover:bg-gray-100"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Submit
                      </button>
                    )}
                    {userRole === 'ADMIN' && timesheet.status === 'SUBMITTED' && (
                      <>
                        <button
                          onClick={() => handleApprove(timesheet.id)}
                          className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-gray-100"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(timesheet.id)}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </button>
                      </>
                    )}
                    {timesheet.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(timesheet.id)}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </RowActionsMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {timesheets.length === 0 && (
          <div className="text-center py-12 text-gray-500">No timesheets found</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {printTimesheet && (
        <TimesheetPrintPreview
          timesheet={printTimesheet}
          onClose={() => setPrintTimesheet(null)}
        />
      )}
    </div>
  )
}
