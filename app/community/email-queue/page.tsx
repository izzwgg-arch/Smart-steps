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
  const [canDelete, setCanDelete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [scheduleSend, setScheduleSend] = useState(false)
  const [scheduledDateTime, setScheduledDateTime] = useState('')

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
        setCanDelete(
          data.permissions['community.invoices.emailqueue.delete']?.canDelete === true ||
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
    const visibleItemIds = queueItems.map((item) => item.id)
    if (visibleItemIds.every((id) => selectedItems.has(id))) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(visibleItemIds))
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!canDelete) {
      toast.error('You do not have permission to delete queue items')
      return
    }

    if (!confirm('Remove this item from the email queue? This does not delete the invoice.')) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/community/email-queue/${itemId}/remove`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        toast.success('Item removed from queue')
        fetchQueueItems() // Refresh the list
        setSelectedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })
      } else {
        toast.error(data.error || 'Failed to remove item from queue')
      }
    } catch (error) {
      console.error('Error removing from queue:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!canDelete) {
      toast.error('You do not have permission to delete queue items')
      return
    }

    if (selectedItems.size === 0) {
      toast.error('Please select items to delete')
      return
    }

    if (!confirm(`Remove ${selectedItems.size} selected item(s) from the email queue? This does not delete invoices.`)) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/community/email-queue/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedItems) }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success(`${data.deletedCount || selectedItems.size} item(s) removed from queue`)
        fetchQueueItems() // Refresh the list
        setSelectedItems(new Set())
      } else {
        toast.error(data.error || 'Failed to delete items')
      }
    } catch (error) {
      console.error('Error deleting items:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleSendBatch = async () => {
    if (!canSendBatch) {
      toast.error('You do not have permission to send batch emails')
      return
    }

    const queuedItems = queueItems.filter((item) => item.status === 'QUEUED')
    if (queuedItems.length === 0) {
      toast.error('No items in the queue to send')
      return
    }

    // Show email modal (will send all queued items)
    setShowEmailModal(true)
  }

  const handleSendSelected = async () => {
    if (!canSendBatch) {
      toast.error('You do not have permission to send batch emails')
      return
    }

    if (selectedItems.size === 0) {
      toast.error('Please select items to send')
      return
    }

    const selectedQueued = queueItems.filter(
      (item) => selectedItems.has(item.id) && item.status === 'QUEUED'
    )
    const selectedNonQueued = queueItems.filter(
      (item) => selectedItems.has(item.id) && item.status !== 'QUEUED'
    )

    if (selectedNonQueued.length > 0) {
      toast.error('Only queued items can be sent. Please deselect non-queued items.')
      return
    }

    if (selectedQueued.length === 0) {
      toast.error('No queued items selected to send')
      return
    }

    // Show email modal (will send only selected items)
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

    // Validate scheduled date-time if scheduling is enabled
    if (scheduleSend) {
      if (!scheduledDateTime) {
        toast.error('Please select a date and time for scheduled send')
        return
      }
      const scheduledDate = new Date(scheduledDateTime)
      const now = new Date()
      if (scheduledDate <= now) {
        toast.error('Scheduled date and time must be in the future')
        return
      }
    }

    setShowEmailModal(false)
    setSending(true)
    try {
      const requestBody: any = {
        recipients: emails,
        itemIds: selectedItems.size > 0 ? Array.from(selectedItems) : undefined,
      }
      
      if (scheduleSend && scheduledDateTime) {
        requestBody.scheduledSendAt = scheduledDateTime
      }

      const res = await fetch('/api/community/email-queue/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data = await res.json()

      if (res.ok) {
        if (scheduleSend) {
          toast.success(
            `Email scheduled successfully! ${data.scheduledCount || 0} invoice(s) will be sent at ${new Date(scheduledDateTime).toLocaleString()}.`
          )
        } else {
          toast.success(
            `Batch email sent successfully! ${data.sentCount || 0} invoice(s) sent.`
          )
        }
        fetchQueueItems() // Refresh the list
        setSelectedItems(new Set())
        setCustomEmail('')
        setScheduleSend(false)
        setScheduledDateTime('')
      } else {
        toast.error(data.error || 'Failed to send/schedule batch email')
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
              <>
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
                      <span>Send All Queued ({queuedCount})</span>
                    </>
                  )}
                </button>
                {selectedItems.size > 0 && (
                  <button
                    onClick={handleSendSelected}
                    disabled={sending || loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Selected ({selectedItems.size})</span>
                  </button>
                )}
              </>
            )}
            {canDelete && selectedItems.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting || loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedItems.size})</span>
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

        {/* Bulk Action Bar */}
        {selectedItems.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              {canSendBatch && (
                <button
                  onClick={handleSendSelected}
                  disabled={sending || loading}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Send Selected
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting || loading}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Selected
                </button>
              )}
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Queue Items Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={queueItems.length > 0 && queueItems.every((item) => selectedItems.has(item.id))}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : queueItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No items in the queue
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deleting}
                          className="text-red-600 hover:text-red-800 flex items-center space-x-1 disabled:opacity-50"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
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
              
              {/* Schedule Send Checkbox */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleSend}
                    onChange={(e) => {
                      setScheduleSend(e.target.checked)
                      if (!e.target.checked) {
                        setScheduledDateTime('')
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Schedule Send</span>
                </label>
              </div>

              {/* Date-Time Picker (shown when Schedule Send is checked) */}
              {scheduleSend && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Send Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select a future date and time to schedule the email send
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEmailModal(false)
                    setCustomEmail('')
                    setScheduleSend(false)
                    setScheduledDateTime('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendBatch}
                  disabled={sending || (scheduleSend && !scheduledDateTime)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : scheduleSend ? 'Schedule Email' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
