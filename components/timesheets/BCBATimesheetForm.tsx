'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  getDaysInRange,
  getDayName,
  isSunday,
  isFriday,
  isSaturday,
} from '@/lib/dateUtils'
import {
  parseTimeToMinutes,
  INVALID_TIME,
} from '@/lib/timeUtils'
import { TimeFieldAMPM, TimeAMPM, timeAMPMToMinutes, minutesToTimeAMPM, timeAMPMTo24Hour } from './TimeFieldAMPM'
import { format } from 'date-fns'
import {
  calculateDurationMinutes,
  validateTimeRange,
  formatHours,
} from '@/lib/timesheetUtils'
import { checkInternalOverlaps } from '@/lib/timesheetOverlapUtils'

interface Provider {
  id: string
  name: string
  phone?: string | null
  dlb?: string | null
  signature?: string | null
}

interface Client {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  idNumber?: string | null
  dlb?: string | null
  signature?: string | null
}

interface BCBA {
  id: string
  name: string
}

interface Insurance {
  id: string
  name: string
}

interface TimesheetEntry {
  id: string
  date: string
  startTime: string
  endTime: string
  minutes: number
  units: number
  notes: string | null
  invoiced?: boolean
}

interface Timesheet {
  id: string
  providerId: string
  clientId: string
  bcbaId: string
  insuranceId?: string | null
  serviceType?: string | null
  sessionData?: string | null
  startDate: string
  endDate: string
  status: string
  timezone?: string
  entries: TimesheetEntry[]
}

interface BCBATimesheetFormProps {
  providers: Provider[]
  clients: Client[]
  bcbas: BCBA[]
  insurances?: Insurance[] // Optional, not used for BCBA timesheets
  timesheet?: Timesheet
}

// Simplified DayEntry for BCBA - single time entry (no DR/SV)
interface DayEntry {
  date: Date
  dayName: string
  from: TimeAMPM | null
  to: TimeAMPM | null
  hours: number
  use: boolean
  invoiced: boolean
  touched: {
    from: boolean
    to: boolean
  }
  errors: {
    time: string | null
  }
  overlapConflict?: {
    message: string
  }
}

interface DefaultTimes {
  sun: {
    from: TimeAMPM | null
    to: TimeAMPM | null
    enabled: boolean
  }
  weekdays: {
    from: TimeAMPM | null
    to: TimeAMPM | null
    enabled: boolean
  }
  fri: {
    from: TimeAMPM | null
    to: TimeAMPM | null
    enabled: boolean
  }
}

export function BCBATimesheetForm({
  providers,
  clients,
  bcbas,
  insurances,
  timesheet,
}: BCBATimesheetFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState<Date | null>(
    timesheet ? new Date(timesheet.startDate) : null
  )
  const [endDate, setEndDate] = useState<Date | null>(
    timesheet ? new Date(timesheet.endDate) : null
  )
  const [providerId, setProviderId] = useState(timesheet?.providerId || '')
  const [clientId, setClientId] = useState(timesheet?.clientId || '')
  const [bcbaId, setBcbaId] = useState(timesheet?.bcbaId || '')
  const [serviceType, setServiceType] = useState(timesheet?.serviceType || '')
  const [sessionData, setSessionData] = useState(timesheet?.sessionData || '')
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [timezone, setTimezone] = useState<string>(timesheet?.timezone || 'America/New_York')
  const [overlapConflicts, setOverlapConflicts] = useState<Array<{ index: number; message: string }>>([])
  const conflictRowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  
  // Get DLB from client or provider
  const selectedClient = clients.find(c => c.id === clientId)
  const selectedProvider = providers.find(p => p.id === providerId)
  const dlb = selectedClient?.dlb || selectedProvider?.dlb || ''

  const [defaultTimes, setDefaultTimes] = useState<DefaultTimes>({
    sun: {
      from: null,
      to: null,
      enabled: false,
    },
    weekdays: {
      from: null,
      to: null,
      enabled: false,
    },
    fri: {
      from: null,
      to: null,
      enabled: false,
    },
  })

  const hasInitializedRef = useRef(false)

  // Load timesheet data when in edit mode
  useEffect(() => {
    if (timesheet && startDate && endDate && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      const days = getDaysInRange(startDate, endDate)
      const daysWithoutSaturday = days.filter((date) => {
        if (date.getDay() === 6) {
          return false
        }
        return true
      })

      const entries: DayEntry[] = daysWithoutSaturday.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const dayEntries = timesheet.entries.filter((entry) => {
          const entryDate = format(new Date(entry.date), 'yyyy-MM-dd')
          return entryDate === dateStr
        })

        // BCBA timesheets have single entry (no DR/SV distinction)
        const entry = dayEntries[0]

        const fromMinutes = entry ? parseTimeToMinutes(entry.startTime) : null
        const toMinutes = entry ? parseTimeToMinutes(entry.endTime) : null

        const from = fromMinutes !== null && fromMinutes !== INVALID_TIME
          ? minutesToTimeAMPM(fromMinutes)
          : null
        const to = toMinutes !== null && toMinutes !== INVALID_TIME
          ? minutesToTimeAMPM(toMinutes)
          : null

        const duration = calculateDurationMinutes(from, to)
        const hours = duration !== null ? duration / 60 : 0

        return {
          date,
          dayName: getDayName(date),
          from,
          to,
          hours,
          use: !!entry,
          invoiced: entry?.invoiced || false,
          touched: {
            from: true,
            to: true,
          },
          errors: {
            time: null,
          },
        }
      })

      setDayEntries(entries)
      calculateTotalHours(entries)
    }
  }, [timesheet, startDate, endDate])

  // Generate days when date range changes (for new timesheets only)
  useEffect(() => {
    if (startDate && endDate && !timesheet) {
      const days = getDaysInRange(startDate, endDate)
      const daysWithoutSaturday = days.filter((date) => {
        if (date.getDay() === 6) {
          return false
        }
        return true
      })

      const entries: DayEntry[] = daysWithoutSaturday.map((date) => {
        let defaults = defaultTimes.weekdays
        if (isSunday(date)) {
          defaults = defaultTimes.sun
        } else if (isFriday(date)) {
          defaults = defaultTimes.fri
        }

        const hasValidTimes =
          defaults.enabled &&
          defaults.from !== null &&
          defaults.to !== null

        const duration = hasValidTimes
          ? calculateDurationMinutes(defaults.from, defaults.to)
          : null

        const hours = duration !== null ? duration / 60 : 0

        return {
          date,
          dayName: getDayName(date),
          from: hasValidTimes ? defaults.from : null,
          to: hasValidTimes ? defaults.to : null,
          hours,
          use: hasValidTimes,
          invoiced: false,
          touched: {
            from: false,
            to: false,
          },
          errors: {
            time: null,
          },
        }
      })

      setDayEntries(entries)
      calculateTotalHours(entries)
    }
  }, [startDate, endDate, timesheet])

  // Auto-update day entries when defaults change
  useEffect(() => {
    if (timesheet || !startDate || !endDate) return

    setDayEntries((prevEntries) => {
      if (prevEntries.length === 0) return prevEntries

      const updated = prevEntries.map((entry) => {
        let defaults = defaultTimes.weekdays
        if (isSunday(entry.date)) {
          defaults = defaultTimes.sun
        } else if (isFriday(entry.date)) {
          defaults = defaultTimes.fri
        }

        const hasValidTimes =
          defaults.enabled &&
          defaults.from !== null &&
          defaults.to !== null

        const newFrom = entry.touched.from ? entry.from : (hasValidTimes ? defaults.from : null)
        const newTo = entry.touched.to ? entry.to : (hasValidTimes ? defaults.to : null)

        const duration = calculateDurationMinutes(newFrom, newTo)
        const hours = duration !== null ? duration / 60 : 0

        return {
          ...entry,
          from: newFrom,
          to: newTo,
          hours,
          use: hasValidTimes && !entry.touched.from && !entry.touched.to ? true : entry.use,
        }
      })

      calculateTotalHours(updated)
      return updated
    })
  }, [defaultTimes, startDate, endDate, timesheet])

  // Check for overlaps
  useEffect(() => {
    if (dayEntries.length === 0 || !providerId || !clientId) {
      setOverlapConflicts([])
      return
    }

    // Check internal overlaps
    const entriesForCheck = dayEntries
      .filter(e => e.use && e.from && e.to)
      .map(e => ({
        date: e.date,
        startTime: e.from!,
        endTime: e.to!,
        type: 'BCBA' as const,
      }))

    // Simplified overlap check for BCBA (single entry type)
    const conflictMap = new Map<number, { message: string }>()
    
    for (let i = 0; i < entriesForCheck.length; i++) {
      for (let j = i + 1; j < entriesForCheck.length; j++) {
        const e1 = entriesForCheck[i]
        const e2 = entriesForCheck[j]
        
        if (format(e1.date, 'yyyy-MM-dd') === format(e2.date, 'yyyy-MM-dd')) {
          const start1 = timeAMPMToMinutes(e1.startTime)
          const end1 = timeAMPMToMinutes(e1.endTime)
          const start2 = timeAMPMToMinutes(e2.startTime)
          const end2 = timeAMPMToMinutes(e2.endTime)
          
          if (start1 !== null && end1 !== null && start2 !== null && end2 !== null) {
            if ((start1 < end2 && end1 > start2)) {
              const idx = dayEntries.findIndex(d => format(d.date, 'yyyy-MM-dd') === format(e1.date, 'yyyy-MM-dd'))
              if (idx >= 0) {
                conflictMap.set(idx, {
                  message: 'Overlapping time entries on the same day',
                })
              }
            }
          }
        }
      }
    }

    // Check external overlaps
    const checkExternalOverlaps = async () => {
      try {
        const entriesForCheck = dayEntries
          .filter(e => e.use && e.from && e.to)
          .map(e => ({
            date: e.date.toISOString(),
            startTime: timeAMPMTo24Hour(e.from!),
            endTime: timeAMPMTo24Hour(e.to!),
            notes: null,
          }))

        if (entriesForCheck.length === 0) {
          const conflictsArray = Array.from(conflictMap.entries()).map(([index, data]) => ({
            index,
            ...data,
          }))
          setOverlapConflicts(conflictsArray)
          return
        }

        const res = await fetch('/api/timesheets/check-overlaps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            clientId,
            entries: entriesForCheck,
            excludeTimesheetId: timesheet?.id,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.conflicts && Array.isArray(data.conflicts)) {
            data.conflicts.forEach((conflict: any) => {
              const idx = dayEntries.findIndex(d => format(d.date, 'yyyy-MM-dd') === conflict.date)
              if (idx >= 0) {
                conflictMap.set(idx, {
                  message: conflict.message || 'Overlap with existing timesheet',
                })
              }
            })
          }
        }

        const conflictsArray = Array.from(conflictMap.entries()).map(([index, data]) => ({
          index,
          ...data,
        }))
        setOverlapConflicts(conflictsArray)
      } catch (error) {
        console.error('Error checking overlaps:', error)
      }
    }

    checkExternalOverlaps()
  }, [dayEntries, providerId, clientId, timesheet?.id])

  const calculateTotalHours = (entries: DayEntry[]) => {
    const total = entries.reduce((sum, entry) => {
      const hours = entry.use && entry.hours > 0 ? entry.hours : 0
      return sum + hours
    }, 0)
    setTotalHours(total)
  }

  const updateDefaultTimes = (
    dayType: 'sun' | 'weekdays' | 'fri',
    field: 'from' | 'to' | 'enabled',
    value: TimeAMPM | null | boolean
  ) => {
    if (field === 'enabled') {
      setDefaultTimes((prev) => ({
        ...prev,
        [dayType]: {
          ...prev[dayType],
          [field]: value as boolean,
        },
      }))
      return
    }

    if (typeof value !== 'object' && value !== null) return

    setDefaultTimes((prev) => ({
      ...prev,
      [dayType]: {
        ...prev[dayType],
        [field]: value as TimeAMPM | null,
      },
    }))
  }

  const applyDefaultsToDates = () => {
    if (timesheet) return
    if (!startDate || !endDate) return

    setDayEntries((prevEntries) => {
      if (prevEntries.length === 0) return prevEntries

      const updated = prevEntries.map((entry) => {
        let defaults = defaultTimes.weekdays
        if (isSunday(entry.date)) {
          defaults = defaultTimes.sun
        } else if (isFriday(entry.date)) {
          defaults = defaultTimes.fri
        }

        const hasValidTimes =
          defaults.enabled &&
          defaults.from !== null &&
          defaults.to !== null

        const newFrom = entry.touched.from ? entry.from : (hasValidTimes ? defaults.from : null)
        const newTo = entry.touched.to ? entry.to : (hasValidTimes ? defaults.to : null)

        const duration = calculateDurationMinutes(newFrom, newTo)
        const hours = duration !== null ? duration / 60 : 0

        return {
          ...entry,
          from: newFrom,
          to: newTo,
          hours,
          use: hasValidTimes && !entry.touched.from && !entry.touched.to ? true : entry.use,
        }
      })

      calculateTotalHours(updated)
      return updated
    })
  }

  const resetRowToDefault = (index: number) => {
    if (timesheet) return
    if (!startDate || !endDate) return

    setDayEntries((prevEntries) => {
      if (index < 0 || index >= prevEntries.length) return prevEntries

      const entry = prevEntries[index]
      let defaults = defaultTimes.weekdays
      if (isSunday(entry.date)) {
        defaults = defaultTimes.sun
      } else if (isFriday(entry.date)) {
        defaults = defaultTimes.fri
      }

      const hasValidTimes =
        defaults.enabled &&
        defaults.from !== null &&
        defaults.to !== null

      const duration = hasValidTimes ? calculateDurationMinutes(defaults.from, defaults.to) : null
      const hours = duration !== null ? duration / 60 : 0

      const updated = [...prevEntries]
      updated[index] = {
        ...entry,
        from: hasValidTimes ? defaults.from : null,
        to: hasValidTimes ? defaults.to : null,
        hours,
        use: hasValidTimes,
        touched: {
          from: false,
          to: false,
        },
      }

      calculateTotalHours(updated)
      return updated
    })
  }

  const updateDayEntry = (
    index: number,
    field: 'from' | 'to' | 'use',
    value: TimeAMPM | null | boolean
  ) => {
    if (index < 0 || index >= dayEntries.length) return

    const updated = [...dayEntries]

    if (field === 'use') {
      updated[index] = {
        ...updated[index],
        use: value as boolean,
      }
      setDayEntries(updated)
      calculateTotalHours(updated)
      return
    }

    if (typeof value !== 'object' && value !== null) return

    const touchedField = field as 'from' | 'to'
    updated[index] = {
      ...updated[index],
      [field]: value as TimeAMPM | null,
      touched: {
        ...updated[index].touched,
        [touchedField]: true,
      },
    }

    // Recalculate hours
    if (field === 'from' || field === 'to') {
      const startTime = updated[index].from
      const endTime = updated[index].to

      if (startTime && endTime) {
        const duration = calculateDurationMinutes(startTime, endTime)
        if (duration !== null) {
          updated[index].hours = duration / 60
          const error = validateTimeRange(startTime, endTime)
          updated[index].errors.time = error
        } else {
          updated[index].hours = 0
          updated[index].errors.time = 'Invalid time range'
        }
      } else {
        updated[index].hours = 0
        updated[index].errors.time = null
      }
    }

    setDayEntries(updated)
    calculateTotalHours(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!startDate || !endDate) {
      toast.error('Please select start and end dates')
      return
    }

    if (!providerId || !clientId || !bcbaId) {
      toast.error('Please fill all required fields')
      return
    }

    if (!serviceType) {
      toast.error('Please select a Service Type')
      return
    }

    if (!sessionData) {
      toast.error('Please select Session Data / Analysis')
      return
    }

    if (dayEntries.length === 0) {
      toast.error('Please select dates')
      return
    }

    // Check for validation errors
    const hasErrors = dayEntries.some(entry => entry.errors.time)
    if (hasErrors) {
      toast.error('Please fix validation errors before submitting')
      return
    }

    // Check for overlap conflicts
    if (overlapConflicts.length > 0) {
      toast.error('Please fix overlap conflicts before submitting')
      return
    }

    // Check for invoiced entries
    const hasInvoicedEntries = dayEntries.some(entry => entry.use && entry.invoiced)
    if (hasInvoicedEntries) {
      const confirmed = confirm(
        'Warning: Some entries are already invoiced. Editing them may cause double billing. Continue?'
      )
      if (!confirmed) return
    }

    const entries = dayEntries
      .filter((entry) => entry.use)
      .map((entry) => {
        if (entry.from === null || entry.to === null) {
          toast.error(
            `Invalid times for ${format(entry.date, 'MMM d')}: Please enter both start and end times`
          )
          return null
        }

        const duration = calculateDurationMinutes(entry.from, entry.to)
        if (duration === null) {
          toast.error(
            `Invalid time range for ${format(entry.date, 'MMM d')}: ${entry.errors.time || 'Invalid times'}`
          )
          return null
        }

        const units = duration / 15

        return {
          date: entry.date.toISOString(),
          startTime: timeAMPMTo24Hour(entry.from),
          endTime: timeAMPMTo24Hour(entry.to),
          minutes: duration,
          units: units,
          notes: null,
          invoiced: entry.invoiced,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    if (entries.length === 0) {
      toast.error('Please add at least one valid time entry')
      return
    }

    setLoading(true)

    try {
      const url = timesheet ? `/api/timesheets/${timesheet.id}` : '/api/timesheets'
      const method = timesheet ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          clientId,
          bcbaId,
          isBCBA: true,
          serviceType,
          sessionData,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          timezone,
          entries,
        }),
      })

      if (res.ok) {
        toast.success(`BCBA Timesheet ${timesheet ? 'updated' : 'created'} successfully`)
        router.push('/bcba-timesheets')
        router.refresh()
      } else {
        const data = await res.json()
        if (data?.code === 'OVERLAP_CONFLICT' && Array.isArray(data?.conflicts)) {
          const next = (data.conflicts as Array<any>)
            .map((c) => {
              const idx = dayEntries.findIndex((d) => format(d.date, 'yyyy-MM-dd') === c.date)
              return idx >= 0 ? { index: idx, message: c.message || 'Overlap detected' } : null
            })
            .filter(Boolean) as Array<{ index: number; message: string }>

          setOverlapConflicts(next)
          if (next.length > 0) {
            const rowElement = conflictRowRefs.current.get(next[0].index)
            if (rowElement) {
              setTimeout(() => rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
            }
          }
          toast.error('Overlap conflicts detected. Please fix highlighted rows.')
        } else {
          toast.error(data.error || `Failed to ${timesheet ? 'update' : 'create'} timesheet`)
        }
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/bcba-timesheets"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to BCBA Timesheets
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {timesheet ? 'Edit BCBA Timesheet' : 'New BCBA Timesheet'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date Range Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>

        {/* Default Times Section */}
        {!timesheet && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Default Times</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day Type</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">FROM</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">TO</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">ENABLED</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(['sun', 'weekdays', 'fri'] as const).map((dayType) => {
                    const defaults = defaultTimes[dayType]
                    const label = dayType === 'sun' ? 'Sunday' : dayType === 'fri' ? 'Friday' : 'Weekdays'
                    return (
                      <tr key={dayType}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{label}</td>
                        <td className="px-4 py-2">
                          <TimeFieldAMPM
                            value={defaults.from}
                            onChange={(time) => updateDefaultTimes(dayType, 'from', time)}
                            placeholder="--:--"
                            className="justify-center"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <TimeFieldAMPM
                            value={defaults.to}
                            onChange={(time) => updateDefaultTimes(dayType, 'to', time)}
                            placeholder="--:--"
                            className="justify-center"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={defaults.enabled}
                              onChange={(e) =>
                                updateDefaultTimes(dayType, 'enabled', e.target.checked)
                              }
                              className="rounded border-gray-300 text-primary-600"
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assignment Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Assignment</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BCBA <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={bcbaId}
                onChange={(e) => setBcbaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select BCBA</option>
                {bcbas.map((bcba) => (
                  <option key={bcba.id} value={bcba.id}>
                    {bcba.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select service type</option>
                <option value="Assessment">Assessment</option>
                <option value="Direct Care">Direct Care</option>
                <option value="Supervision">Supervision</option>
                <option value="Treatment Planning">Treatment Planning</option>
                <option value="Parent Training">Parent Training</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Data / Analysis <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={sessionData}
                onChange={(e) => setSessionData(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select session data</option>
                <option value="Session Notes">Session Notes</option>
                <option value="Client Data Analysis">Client Data Analysis</option>
                <option value="Excel Export Action Plan">Excel Export Action Plan</option>
              </select>
            </div>
            {dlb && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DLB
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {dlb}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Days Table */}
        {dayEntries.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Days for {startDate && format(startDate, 'MMM d')} - {endDate && format(endDate, 'MMM d')}
              </h2>
              <div className="flex items-center gap-4">
                {!timesheet && (
                  <button
                    type="button"
                    onClick={applyDefaultsToDates}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply Default Times to Dates
                  </button>
                )}
                <div className="text-lg font-bold text-primary-600">
                  TOTAL: {totalHours.toFixed(2)} HRS
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">DATE</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">FROM</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">TO</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">HOURS</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">USE</th>
                    {!timesheet && (
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dayEntries.map((entry, index) => {
                    const conflict = overlapConflicts.find(c => c.index === index)
                    const hasConflict = !!conflict

                    return (
                      <tr
                        key={index}
                        ref={(el) => {
                          if (el && hasConflict) {
                            conflictRowRefs.current.set(index, el)
                          } else {
                            conflictRowRefs.current.delete(index)
                          }
                        }}
                        className={hasConflict ? 'bg-red-50' : ''}
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {format(entry.date, 'EEE M/d/yyyy')}
                        </td>
                        <td className={`px-2 py-2 ${hasConflict ? 'bg-red-100' : ''}`}>
                          <TimeFieldAMPM
                            value={entry.from}
                            onChange={(time) => updateDayEntry(index, 'from', time)}
                            placeholder="--:--"
                            className={`justify-center ${hasConflict ? 'border-red-500' : ''}`}
                            disabled={timesheet?.status === 'LOCKED'}
                          />
                        </td>
                        <td className={`px-2 py-2 ${hasConflict ? 'bg-red-100' : ''}`}>
                          <TimeFieldAMPM
                            value={entry.to}
                            onChange={(time) => updateDayEntry(index, 'to', time)}
                            placeholder="--:--"
                            className={`justify-center ${hasConflict ? 'border-red-500' : ''}`}
                            disabled={timesheet?.status === 'LOCKED'}
                          />
                        </td>
                        <td className="px-2 py-2 text-sm text-gray-700">
                          {entry.hours > 0 ? formatHours(entry.hours) : '-'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col items-center">
                            <input
                              type="checkbox"
                              checked={entry.use}
                              onChange={(e) => updateDayEntry(index, 'use', e.target.checked)}
                              disabled={timesheet?.status === 'LOCKED'}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            {entry.invoiced && (
                              <span className="text-xs text-red-600 mt-1" title="Already invoiced">⚠</span>
                            )}
                          </div>
                          {entry.errors.time && (
                            <div className="text-xs text-red-600 mt-1">{entry.errors.time}</div>
                          )}
                          {hasConflict && (
                            <div className="text-xs text-red-600 mt-1 font-semibold" title={conflict.message}>
                              Overlap!
                            </div>
                          )}
                        </td>
                        {!timesheet && (
                          <td className="px-2 py-2 text-center">
                            {(entry.touched.from || entry.touched.to) && (
                              <button
                                type="button"
                                onClick={() => resetRowToDefault(index)}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                title="Reset this row to default times"
                              >
                                Reset
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {dayEntries.length === 0 && startDate && endDate && (
          <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
            Select a start and end date to generate days.
          </div>
        )}

        {/* Overlap Conflict Messages */}
        {overlapConflicts.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-800 mb-2 flex items-center">
              <span className="mr-2">⚠️</span>
              Overlap Conflicts Detected
            </h3>
            <p className="text-sm text-red-700 mb-3">
              Please fix the following conflicts before saving:
            </p>
            <ul className="list-disc list-inside space-y-2">
              {overlapConflicts.map((conflict, idx) => {
                const entry = dayEntries[conflict.index]
                if (!entry) return null
                return (
                  <li key={idx} className="text-sm text-red-700">
                    <strong>{format(entry.date, 'MM/dd/yyyy')}</strong> - {conflict.message}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Link
            href="/bcba-timesheets"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || dayEntries.length === 0 || overlapConflicts.length > 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (timesheet ? 'Updating...' : 'Creating...') : (timesheet ? 'Update Timesheet' : 'Create Timesheet')}
          </button>
        </div>
      </form>
    </div>
  )
}
