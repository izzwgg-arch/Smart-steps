'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Check, X, Mail, Loader2, RefreshCw } from 'lucide-react'
import { DashboardNav } from '@/components/DashboardNav'

interface QueuedItem {
  id: string
  type: 'REGULAR_TIMESHEET' | 'BCBA_TIMESHEET'
  entityId: string
  queuedAt: string
  status: 'QUEUED' | 'SENT' | 'FAILED'
  lastError: string | null
  batchId: string | null
  timesheet?: {
    id: string
    client: { name: string }
    provider: { name: string }
    bcba: { name: string }
    startDate: string
    endDate: string
    totalHours: number
    serviceType?: string
    sessionData?: string
  }
}

export default function EmailQueuePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    fetchQueuedItems()
  }, [])

  const fetchQueuedItems = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/email-queue')
      if (res.ok) {
        const data = await res.json()
        // API returns 'items' not 'queueItems'
        setQueuedItems(data.items || data.queueItems || [])
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to load email queue')
      }
    } catch (error) {
      console.error('Error fetching email queue:', error)
      toast.error('Failed to load email queue')
    } finally {
      setLoading(false)
    }
  }

  const handleSendBatch = async () => {
    if (queuedItems.filter(item => item.status === 'QUEUED').length === 0) {
      toast.error('No items to send')
      return
    }

    if (!confirm(`Send ${queuedItems.filter(item => item.status === 'QUEUED').length} queued timesheet(s)?`)) {
      return
    }

    try {
      setSending(true)
      const res = await fetch('/api/email-queue/send-batch', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        toast.success(`Batch email sent successfully! ${data.sentCount || 0} items sent.`)
        fetchQueuedItems()
      } else {
        toast.error(data.error || 'Failed to send batch email')
      }
    } catch (error) {
      toast.error('Failed to send batch email')
    } finally {
      setSending(false)
    }
  }

  const queuedCount = queuedItems.filter(item => item.status === 'QUEUED').length
  const sentCount = queuedItems.filter(item => item.status === 'SENT').length
  const failedCount = queuedItems.filter(item => item.status === 'FAILED').length

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav userRole={session.user.role} />
      <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Queue</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage queued timesheets ready to be emailed
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchQueuedItems}
            disabled={loading || sending}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {queuedCount > 0 && (
            <button
              onClick={handleSendBatch}
              disabled={sending || loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send All Queued ({queuedCount})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-700">Queued</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{queuedCount}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm font-medium text-green-700">Sent</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{sentCount}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm font-medium text-red-700">Failed</div>
          <div className="text-2xl font-bold text-red-900 mt-1">{failedCount}</div>
        </div>
      </div>

      {/* Queue Items Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hours
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Queued At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  <p className="mt-2">Loading queue...</p>
                </td>
              </tr>
            ) : queuedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No items in queue
                </td>
              </tr>
            ) : (
              queuedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.type === 'BCBA_TIMESHEET' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.type === 'BCBA_TIMESHEET' ? 'BCBA' : 'Regular'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.timesheet?.client?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.timesheet?.provider?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.timesheet ? (
                      <>
                        {new Date(item.timesheet.startDate).toLocaleDateString()} -{' '}
                        {new Date(item.timesheet.endDate).toLocaleDateString()}
                      </>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.timesheet?.totalHours?.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.queuedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        item.status === 'SENT'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.status === 'FAILED' && item.lastError && (
                      <div className="mt-1 text-xs text-red-600">{item.lastError}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
