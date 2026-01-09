'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Check, X, Mail, Loader2, RefreshCw } from 'lucide-react'
import { DashboardNav } from '@/components/DashboardNav'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'

interface QueuedItem {
  id: string
  entityType: 'REGULAR' | 'BCBA'
  entityId: string
  queuedAt: string
  sentAt: string | null
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED'
  errorMessage: string | null
  batchId: string | null
  queuedBy: {
    id: string
    username: string
    email: string
  }
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
  } | null
}

export default function EmailQueuePage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [queueItems, setQueueItems] = useState<QueuedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [canViewQueue, setCanViewQueue] = useState(false)
  const [canSendBatch, setCanSendBatch] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'loading') return

    if (sessionStatus === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (session) {
      fetchPermissions()
      fetchQueueItems()
    }
  }, [sessionStatus, session, router])

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/user/permissions')
      const data = await res.json()
      if (data?.permissions) {
        setCanViewQueue(
          data.permissions['emailQueue.view']?.canView === true ||
            session?.user?.role === 'SUPER_ADMIN' ||
            session?.user?.role === 'ADMIN'
        )
        setCanSendBatch(
          data.permissions['emailQueue.sendBatch']?.canCreate === true ||
            session?.user?.role === 'SUPER_ADMIN' ||
            session?.user?.role === 'ADMIN'
        )
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
      toast.error('Failed to load permissions')
    }
  }

  const fetchQueueItems = async () => {
    setLoading(true)
    try {
      const url = '/api/email-queue'
      console.log('[EMAIL QUEUE] Request:', { url, method: 'GET' })
      
      const res = await fetch(url)
      const data = await res.json()
      
      console.log('[EMAIL QUEUE] Response:', {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        data,
      })
      
      if (res.ok && data.ok !== false) {
        setQueueItems(data.items || [])
      } else {
        const errorMsg = data.message || data.error || `Failed to load email queue (${res.status})`
        console.error('[EMAIL QUEUE] Error:', { status: res.status, code: data.code, message: data.message, details: data.details })
        toast.error(errorMsg)
        setQueueItems([]) // Set empty array on error to prevent UI issues
      }
    } catch (error: any) {
      console.error('[EMAIL QUEUE] Request failed:', {
        url: '/api/email-queue',
        error: error.message,
        stack: error.stack,
      })
      toast.error(`Network error: ${error.message || 'Failed to load email queue'}`)
      setQueueItems([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleSendBatch = async () => {
    if (!canSendBatch) {
      toast.error('You do not have permission to send batch emails')
      return
    }

    const queuedCount = queueItems.filter((item) => item.status === 'QUEUED').length
    if (queuedCount === 0) {
      toast.error('No items in the queue to send')
      return
    }

    if (!confirm(`Are you sure you want to send all ${queuedCount} queued timesheet(s) in a single batch email?`)) {
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/email-queue/send-batch', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        toast.success(
          `Batch email sent successfully! ${data.sentCount || 0} timesheet(s) sent.`
        )
        fetchQueueItems() // Refresh the list
      } else {
        toast.error(data.error || 'Failed to send batch email')
      }
    } catch (error) {
      console.error('Error sending batch email:', error)
      toast.error('An unexpected error occurred while sending batch email')
    } finally {
      setSending(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session || !canViewQueue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav userRole={session?.user?.role || 'USER'} />
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">You do not have permission to view the email queue.</p>
          </div>
        </div>
      </div>
    )
  }

  const queuedCount = queueItems.filter((item) => item.status === 'QUEUED').length
  const sendingCount = queueItems.filter((item) => item.status === 'SENDING').length
  const sentCount = queueItems.filter((item) => item.status === 'SENT').length
  const failedCount = queueItems.filter((item) => item.status === 'FAILED').length

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav userRole={session.user.role} />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Queue</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage timesheets queued for email approval
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchQueueItems}
              disabled={loading || sending}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {queuedCount > 0 && canSendBatch && (
              <button
                onClick={handleSendBatch}
                disabled={sending || loading}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-700">Queued</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{queuedCount}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="text-sm font-medium text-yellow-700">Sending</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">{sendingCount}</div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch ID
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    <p className="mt-2">Loading queue...</p>
                  </td>
                </tr>
              ) : queueItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No items in queue
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.entityType === 'BCBA'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.entityType === 'BCBA' ? 'BCBA' : 'Regular'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={formatDateTime(item.queuedAt)}>
                      {formatRelativeTime(item.queuedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.status === 'SENT'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'SENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 max-w-xs truncate" title={item.errorMessage || undefined}>
                      {item.errorMessage || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                      {item.batchId || '—'}
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
