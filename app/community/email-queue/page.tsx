'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Check, X, Mail, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { DashboardNav } from '@/components/DashboardNav'
import { formatDateTime, formatRelativeTime, formatCurrency } from '@/lib/utils'

interface QueuedItem {
  id: string
  entityType: 'COMMUNITY_INVOICE'
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
  invoice?: {
    id: string
    client: {
      firstName: string
      lastName: string
      medicaidId: string | null
    }
    class: {
      name: string
    }
    units: number
    totalAmount: number
    serviceDate: string | null
  } | null
}

export default function CommunityEmailQueuePage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [queueItems, setQueueItems] = useState<QueuedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [canViewQueue, setCanViewQueue] = useState(false)
  const [canSendBatch, setCanSendBatch] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customEmail, setCustomEmail] = useState('')

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
          data.permissions['community.invoices.emailqueue.view']?.canView === true ||
            session?.user?.role === 'SUPER_ADMIN' ||
            session?.user?.role === 'ADMIN'
        )
        setCanSendBatch(
          data.permissions['community.invoices.emailqueue.send']?.canCreate === true ||
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
      const res = await fetch('/api/community/email-queue')
      const data = await res.json()

      if (res.ok && data.ok !== false) {
        setQueueItems(data.items || [])
      } else {
        const errorMsg = data.message || data.error || `Failed to load email queue (${res.status})`
        toast.error(errorMsg)
        setQueueItems([])
      }
    } catch (error: any) {
      toast.error(`Network error: ${error.message || 'Failed to load email queue'}`)
      setQueueItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSelect = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    const queuedItemIds = queueItems
      .filter((item) => item.status === 'QUEUED')
      .map((item) => item.id)
    if (queuedItemIds.every((id) => selectedItems.has(id))) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(queuedItemIds))
    }
  }

  const handleRemoveFromQueue = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this invoice from the email queue? The invoice will not be deleted.')) {
      return
    }

    try {
      const res = await fetch(`/api/community/email-queue/${itemId}/remove`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        toast.success('Invoice removed from queue')
        fetchQueueItems() // Refresh the list
        setSelectedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })
      } else {
        toast.error(data.error || 'Failed to remove invoice from queue')
      }
    } catch (error) {
      console.error('Error removing from queue:', error)
      toast.error('An unexpected error occurred')
    }
  }

  const handleSendBatch = async () => {
    if (!canSendBatch) {
      toast.error('You do not have permission to send batch emails')
      return
    }

    const queuedItems = queueItems.filter((item) => item.status === 'QUEUED')
    const itemsToSend = selectedItems.size > 0
      ? queuedItems.filter((item) => selectedItems.has(item.id))
      : queuedItems

    if (itemsToSend.length === 0) {
      toast.error('No items selected to send')
      return
    }

    // Show email modal
    setShowEmailModal(true)
  }

  const handleConfirmSendBatch = async () => {
    if (!customEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const emails = customEmail.split(',').map((e) => e.trim()).filter(Boolean)
    const invalidEmails = emails.filter((e) => !emailRegex.test(e))
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address(es): ${invalidEmails.join(', ')}`)
      return
    }

    setShowEmailModal(false)
    setSending(true)
    try {
      const res = await fetch('/api/community/email-queue/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emails,
          itemIds: selectedItems.size > 0 ? Array.from(selectedItems) : undefined,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(
          `Batch email sent successfully! ${data.sentCount || 0} invoice(s) sent.`
        )
        fetchQueueItems() // Refresh the list
        setSelectedItems(new Set())
        setCustomEmail('')
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
            <p className="text-gray-500">You do not have permission to view the community email queue.</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Community Invoice Email Queue</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage community invoices queued for email approval
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchQueueItems}
              disabled={loading || sending}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {canSendBatch && queuedCount > 0 && (
              <button
                onClick={handleSendBatch}
                disabled={sending || queuedCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send {selectedItems.size > 0 ? `Selected (${selectedItems.size})` : `All Queued (${queuedCount})`}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Queued</div>
            <div className="text-2xl font-bold text-cyan-600">{queuedCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Sending</div>
            <div className="text-2xl font-bold text-blue-600">{sendingCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Sent</div>
            <div className="text-2xl font-bold text-green-600">{sentCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </div>
        </div>

        {/* Queue Items Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {canSendBatch && queuedCount > 0 && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={queueItems.filter((item) => item.status === 'QUEUED').every((item) => selectedItems.has(item.id)) && queueItems.filter((item) => item.status === 'QUEUED').length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queued At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
                {canSendBatch && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={canSendBatch ? 9 : 8} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : queueItems.length === 0 ? (
                <tr>
                  <td colSpan={canSendBatch ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                    No items in the queue
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {canSendBatch && item.status === 'QUEUED' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    {canSendBatch && item.status !== 'QUEUED' && (
                      <td className="px-6 py-4 whitespace-nowrap"></td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.invoice
                        ? `${item.invoice.client.firstName} ${item.invoice.client.lastName}`
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.invoice?.class.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.invoice?.units || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.invoice ? formatCurrency(item.invoice.totalAmount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.status === 'QUEUED' && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-cyan-100 text-cyan-800">
                          Queued
                        </span>
                      )}
                      {item.status === 'SENDING' && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 flex items-center space-x-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Sending</span>
                        </span>
                      )}
                      {item.status === 'SENT' && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      )}
                      {item.status === 'FAILED' && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 flex items-center space-x-1">
                          <X className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRelativeTime(item.queuedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.sentAt ? formatRelativeTime(item.sentAt) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                      {item.errorMessage || '-'}
                    </td>
                    {canSendBatch && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.status === 'QUEUED' && (
                          <button
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Remove</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Enter Email Address(es)</h2>
              <p className="text-sm text-gray-600 mb-4">
                Enter one or more email addresses separated by commas.
              </p>
              <input
                type="text"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="email@example.com, another@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEmailModal(false)
                    setCustomEmail('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendBatch}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
