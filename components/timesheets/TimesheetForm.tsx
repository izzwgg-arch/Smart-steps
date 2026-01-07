'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  getDaysInRange,
  getDayName,
  getDayShortName,
  isSunday,
  isFriday,
} from '@/lib/dateUtils'
import {
  parseTimeToMinutes,
  INVALID_TIME,
} from '@/lib/timeUtils'
import { to24Hour } from '@/lib/time'
import { TimePartsInput } from './TimePartsInput'
import { partsToMinutes, minutesToParts, durationMinutes } from '@/lib/timeParts'
import { format } from 'date-fns'
import { calculateUnits } from '@/lib/dateUtils'

interface Provider {
  id: string
  name: string
}

interface Client {
  id: string
  name: string
  insurance: {
    id: string
    name: string
  }
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
}

interface Timesheet {
  id: string
  providerId: string
  clientId: string
  bcbaId: string
  insuranceId: string
  startDate: string
  endDate: string
  status: string
  entries: TimesheetEntry[]
}

interface TimesheetFormProps {
  providers: Provider[]
  clients: Client[]
  bcbas: BCBA[]
  insurances: Insurance[]
  timesheet?: Timesheet
}

// Internal representation: minutes since midnight (0-1439) or null
interface DayEntry {
  date: Date
  dayName: string
  drFromMinutes: number | null // minutes since midnight, or null
  drToMinutes: number | null
  drHours: number
  drUse: boolean
  svFromMinutes: number | null
  svToMinutes: number | null
  svHours: number
  svUse: boolean
  isOverridden: boolean // true if user manually edited this row (prevents auto-update)
}

interface DefaultTimes {
  sun: {
    drFromMinutes: number | null
    drToMinutes: number | null
    svFromMinutes: number | null
    svToMinutes: number | null
    enabled: boolean
  }
  weekdays: {
    drFromMinutes: number | null
    drToMinutes: number | null
    svFromMinutes: number | null
    svToMinutes: number | null
    enabled: boolean
  }
  fri: {
    drFromMinutes: number | null
    drToMinutes: number | null
    svFromMinutes: number | null
    svToMinutes: number | null
    enabled: boolean
  }
}

export function TimesheetForm({
  providers,
  clients,
  bcbas,
  insurances,
  timesheet,
}: TimesheetFormProps) {
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
  const [insuranceId, setInsuranceId] = useState(timesheet?.insuranceId || '')
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([])
  const [totalHours, setTotalHours] = useState(0)
  
  // Store temporary display values for day entry inputs while typing

  const [defaultTimes, setDefaultTimes] = useState<DefaultTimes>({
    sun: {
      drFromMinutes: null,
      drToMinutes: null,
      svFromMinutes: null,
      svToMinutes: null,
      enabled: false,
    },
    weekdays: {
      drFromMinutes: null,
      drToMinutes: null,
      svFromMinutes: null,
      svToMinutes: null,
      enabled: false,
    },
    fri: {
      drFromMinutes: null,
      drToMinutes: null,
      svFromMinutes: null,
      svToMinutes: null,
      enabled: false,
    },
  })

  // Track if we've initialized edit mode to prevent overwriting existing entries
  const hasInitializedRef = useRef(false)

  // Auto-select insurance when client is selected
  useEffect(() => {
    if (clientId) {
      const client = clients.find((c) => c.id === clientId)
      if (client) {
        setInsuranceId(client.insurance.id)
      }
    }
  }, [clientId, clients])

  // Load timesheet data when in edit mode
  useEffect(() => {
    if (timesheet && startDate && endDate && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      const days = getDaysInRange(startDate, endDate)
      const entries: DayEntry[] = days.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const dayEntries = timesheet.entries.filter((entry) => {
          const entryDate = format(new Date(entry.date), 'yyyy-MM-dd')
          return entryDate === dateStr
        })

        const drEntry = dayEntries.find((e) => e.notes === 'DR')
        const svEntry = dayEntries.find((e) => e.notes === 'SV')

        const drFromMinutes = drEntry
          ? parseTimeToMinutes(drEntry.startTime)
          : null
        const drToMinutes = drEntry
          ? parseTimeToMinutes(drEntry.endTime)
          : null
        const svFromMinutes = svEntry
          ? parseTimeToMinutes(svEntry.startTime)
          : null
        const svToMinutes = svEntry
          ? parseTimeToMinutes(svEntry.endTime)
          : null

        // Convert INVALID_TIME to null
        const drFrom = drFromMinutes === INVALID_TIME ? null : drFromMinutes
        const drTo = drToMinutes === INVALID_TIME ? null : drToMinutes
        const svFrom = svFromMinutes === INVALID_TIME ? null : svFromMinutes
        const svTo = svToMinutes === INVALID_TIME ? null : svToMinutes

        const drDuration = durationMinutes(drFrom, drTo)
        const svDuration = durationMinutes(svFrom, svTo)

        // Guard against NaN
        const drHours = drDuration !== null ? drDuration / 60 : 0
        const svHours = svDuration !== null ? svDuration / 60 : 0

        return {
          date,
          dayName: getDayName(date),
          drFromMinutes: drFrom,
          drToMinutes: drTo,
          drHours,
          drUse: !!drEntry,
          svFromMinutes: svFrom,
          svToMinutes: svTo,
          svHours,
          svUse: !!svEntry,
          isOverridden: true, // Existing entries are always overridden (user data)
        }
      })
      setDayEntries(entries)
      calculateTotalHours(entries)
    }
  }, [timesheet, startDate, endDate])

  // Generate days when date range changes (for new timesheets only)
  // This ONLY runs when dates change, not when defaults change
  useEffect(() => {
    if (startDate && endDate && !timesheet) {
      const days = getDaysInRange(startDate, endDate)
      const entries: DayEntry[] = days.map((date) => {
        let defaults = defaultTimes.weekdays
        if (isSunday(date)) {
          defaults = defaultTimes.sun
        } else if (isFriday(date)) {
          defaults = defaultTimes.fri
        }

        const hasValidDrTimes =
          defaults.enabled &&
          defaults.drFromMinutes !== null &&
          defaults.drToMinutes !== null
        const hasValidSvTimes =
          defaults.enabled &&
          defaults.svFromMinutes !== null &&
          defaults.svToMinutes !== null

        const drDuration = hasValidDrTimes
          ? durationMinutes(defaults.drFromMinutes, defaults.drToMinutes)
          : null
        const svDuration = hasValidSvTimes
          ? durationMinutes(defaults.svFromMinutes, defaults.svToMinutes)
          : null

        const drHours = drDuration !== null ? drDuration / 60 : 0
        const svHours = svDuration !== null ? svDuration / 60 : 0

        return {
          date,
          dayName: getDayName(date),
          drFromMinutes: hasValidDrTimes
            ? defaults.drFromMinutes
            : null,
          drToMinutes: hasValidDrTimes ? defaults.drToMinutes : null,
          drHours,
          drUse: hasValidDrTimes,
          svFromMinutes: hasValidSvTimes
            ? defaults.svFromMinutes
            : null,
          svToMinutes: hasValidSvTimes ? defaults.svToMinutes : null,
          svHours,
          svUse: hasValidSvTimes,
          isOverridden: false, // New entries start as not overridden
        }
      })
      setDayEntries(entries)
      calculateTotalHours(entries)
    }
  }, [startDate, endDate, timesheet]) // REMOVED defaultTimes - no auto-update

  // REMOVED: Auto-updating useEffect that caused race conditions
  // Now using explicit "Apply Defaults" button instead

  const calculateTotalHours = (entries: DayEntry[]) => {
    const total = entries.reduce((sum, entry) => {
      const drHours = entry.drUse && entry.drHours > 0 ? entry.drHours : 0
      const svHours = entry.svUse && entry.svHours > 0 ? entry.svHours : 0
      return sum + drHours + svHours
    }, 0)
    setTotalHours(total)
  }

  const updateDefaultTimes = (
    dayType: 'sun' | 'weekdays' | 'fri',
    field: 'drFrom' | 'drTo' | 'svFrom' | 'svTo' | 'enabled',
    value: number | null | boolean
  ) => {
    if (field === 'enabled') {
      setDefaultTimes((prev) => ({
        ...prev,
        [dayType]: {
          ...prev[dayType],
          enabled: value as boolean,
        },
      }))
      return
    }

    if (typeof value !== 'number' && value !== null) return

    const fieldKeyMinutes = `${field}Minutes` as
      | 'drFromMinutes'
      | 'drToMinutes'
      | 'svFromMinutes'
      | 'svToMinutes'
    
    setDefaultTimes((prev) => ({
      ...prev,
      [dayType]: {
        ...prev[dayType],
        [fieldKeyMinutes]: value,
      },
    }))
  }

  // Apply default times to all non-overridden rows
  const applyDefaultsToDates = () => {
    if (timesheet) return // Don't apply in edit mode
    if (!startDate || !endDate) return

    setDayEntries((prevEntries) => {
      if (prevEntries.length === 0) return prevEntries

      const updated = prevEntries.map((entry) => {
        // Skip overridden rows
        if (entry.isOverridden) return entry

        let defaults = defaultTimes.weekdays
        if (isSunday(entry.date)) {
          defaults = defaultTimes.sun
        } else if (isFriday(entry.date)) {
          defaults = defaultTimes.fri
        }

        const hasValidDrTimes =
          defaults.enabled &&
          defaults.drFromMinutes !== null &&
          defaults.drToMinutes !== null
        const hasValidSvTimes =
          defaults.enabled &&
          defaults.svFromMinutes !== null &&
          defaults.svToMinutes !== null

        const drDuration = hasValidDrTimes
          ? durationMinutes(defaults.drFromMinutes, defaults.drToMinutes)
          : null
        const svDuration = hasValidSvTimes
          ? durationMinutes(defaults.svFromMinutes, defaults.svToMinutes)
          : null

        const drHours = drDuration !== null ? drDuration / 60 : 0
        const svHours = svDuration !== null ? svDuration / 60 : 0

        return {
          ...entry,
          drFromMinutes: hasValidDrTimes ? defaults.drFromMinutes : null,
          drToMinutes: hasValidDrTimes ? defaults.drToMinutes : null,
          drHours,
          drUse: hasValidDrTimes,
          svFromMinutes: hasValidSvTimes ? defaults.svFromMinutes : null,
          svToMinutes: hasValidSvTimes ? defaults.svToMinutes : null,
          svHours,
          svUse: hasValidSvTimes,
          isOverridden: false, // Still not overridden after applying defaults
        }
      })

      calculateTotalHours(updated)
      return updated
    })
  }

  // Reset a single row to default times
  const resetRowToDefault = (index: number) => {
    if (timesheet) return // Don't reset in edit mode
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

      const hasValidDrTimes =
        defaults.enabled &&
        defaults.drFromMinutes !== null &&
        defaults.drToMinutes !== null
      const hasValidSvTimes =
        defaults.enabled &&
        defaults.svFromMinutes !== null &&
        defaults.svToMinutes !== null

      const drDuration = hasValidDrTimes
        ? durationMinutes(defaults.drFromMinutes, defaults.drToMinutes)
        : null
      const svDuration = hasValidSvTimes
        ? durationMinutes(defaults.svFromMinutes, defaults.svToMinutes)
        : null

      const drHours = drDuration !== null ? drDuration / 60 : 0
      const svHours = svDuration !== null ? svDuration / 60 : 0

      const updated = [...prevEntries]
      updated[index] = {
        ...entry,
        drFromMinutes: hasValidDrTimes ? defaults.drFromMinutes : null,
        drToMinutes: hasValidDrTimes ? defaults.drToMinutes : null,
        drHours,
        drUse: hasValidDrTimes,
        svFromMinutes: hasValidSvTimes ? defaults.svFromMinutes : null,
        svToMinutes: hasValidSvTimes ? defaults.svToMinutes : null,
        svHours,
        svUse: hasValidSvTimes,
        isOverridden: false, // Reset to not overridden
      }

      calculateTotalHours(updated)
      return updated
    })
  }

  const updateDayEntry = (
    index: number,
    field: 'drFrom' | 'drTo' | 'svFrom' | 'svTo' | 'drUse' | 'svUse',
    value: number | null | boolean
  ) => {
    const updated = [...dayEntries]

    if (field === 'drUse' || field === 'svUse') {
      updated[index] = {
        ...updated[index],
        [field]: value as boolean,
        isOverridden: true, // Manual edit means overridden
      }
      setDayEntries(updated)
      calculateTotalHours(updated)
      return
    }

    if (typeof value !== 'number' && value !== null) return

    const fieldKeyMinutes = `${field}Minutes` as
      | 'drFromMinutes'
      | 'drToMinutes'
      | 'svFromMinutes'
      | 'svToMinutes'

    updated[index] = {
      ...updated[index],
      [fieldKeyMinutes]: value,
      isOverridden: true, // Manual edit means overridden
    }

    // Recalculate hours
    if (field === 'drFrom' || field === 'drTo') {
      const startMinutes = updated[index].drFromMinutes
      const endMinutes = updated[index].drToMinutes

      if (startMinutes !== null && endMinutes !== null) {
        const duration = durationMinutes(startMinutes, endMinutes)
        updated[index].drHours = duration !== null ? duration / 60 : 0
      } else {
        updated[index].drHours = 0
      }
    }

    if (field === 'svFrom' || field === 'svTo') {
      const startMinutes = updated[index].svFromMinutes
      const endMinutes = updated[index].svToMinutes

      if (startMinutes !== null && endMinutes !== null) {
        const duration = durationMinutes(startMinutes, endMinutes)
        updated[index].svHours = duration !== null ? duration / 60 : 0
      } else {
        updated[index].svHours = 0
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

    if (!providerId || !clientId || !bcbaId || !insuranceId) {
      toast.error('Please fill all assignment fields')
      return
    }

    if (dayEntries.length === 0) {
      toast.error('Please select dates')
      return
    }

    const entries = dayEntries
      .filter((entry) => entry.drUse || entry.svUse)
      .flatMap((entry) => {
        const result = []
        if (entry.drUse) {
          const startMinutes = entry.drFromMinutes
          const endMinutes = entry.drToMinutes

          // Guard against invalid times
          if (startMinutes === null || endMinutes === null) {
            toast.error(
              `Invalid DR times for ${format(entry.date, 'MMM d')}: Please enter both start and end times`
            )
            return []
          }

          const duration = durationMinutes(startMinutes, endMinutes)
          if (duration === null || duration <= 0) {
            toast.error(
              `Invalid DR time range for ${format(entry.date, 'MMM d')}: End time must be after start time`
            )
            return []
          }

          result.push({
            date: entry.date.toISOString(),
            startTime: to24Hour(startMinutes),
            endTime: to24Hour(endMinutes),
            minutes: duration,
            notes: 'DR',
          })
        }
        if (entry.svUse) {
          const startMinutes = entry.svFromMinutes
          const endMinutes = entry.svToMinutes

          // Guard against invalid times
          if (startMinutes === null || endMinutes === null) {
            toast.error(
              `Invalid SV times for ${format(entry.date, 'MMM d')}: Please enter both start and end times`
            )
            return []
          }

          const duration = durationMinutes(startMinutes, endMinutes)
          if (duration === null || duration <= 0) {
            toast.error(
              `Invalid SV time range for ${format(entry.date, 'MMM d')}: End time must be after start time`
            )
            return []
          }

          result.push({
            date: entry.date.toISOString(),
            startTime: to24Hour(startMinutes),
            endTime: to24Hour(endMinutes),
            minutes: duration,
            notes: 'SV',
          })
        }
        return result
      })

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
          insuranceId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          entries,
        }),
      })

      if (res.ok) {
        toast.success(`Timesheet ${timesheet ? 'updated' : 'created'} successfully`)
        router.push('/timesheets')
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || `Failed to ${timesheet ? 'update' : 'create'} timesheet`)
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Debug panel state (dev only)
  const [showDebug, setShowDebug] = useState(false)

  // Prepare debug data
  const debugData = {
    defaultTimes: {
      sun: {
        drFrom: defaultTimes.sun.drFromMinutes,
        drTo: defaultTimes.sun.drToMinutes,
        svFrom: defaultTimes.sun.svFromMinutes,
        svTo: defaultTimes.sun.svToMinutes,
        enabled: defaultTimes.sun.enabled,
      },
      weekdays: {
        drFrom: defaultTimes.weekdays.drFromMinutes,
        drTo: defaultTimes.weekdays.drToMinutes,
        svFrom: defaultTimes.weekdays.svFromMinutes,
        svTo: defaultTimes.weekdays.svToMinutes,
        enabled: defaultTimes.weekdays.enabled,
      },
      fri: {
        drFrom: defaultTimes.fri.drFromMinutes,
        drTo: defaultTimes.fri.drToMinutes,
        svFrom: defaultTimes.fri.svFromMinutes,
        svTo: defaultTimes.fri.svToMinutes,
        enabled: defaultTimes.fri.enabled,
      },
    },
    dayEntries: dayEntries.map((entry) => ({
      date: format(entry.date, 'yyyy-MM-dd'),
      dayName: entry.dayName,
      drFrom: entry.drFromMinutes,
      drTo: entry.drToMinutes,
      drHours: entry.drHours,
      drUse: entry.drUse,
      svFrom: entry.svFromMinutes,
      svTo: entry.svToMinutes,
      svHours: entry.svHours,
      svUse: entry.svUse,
      isOverridden: entry.isOverridden,
    })),
    savePayload: (() => {
      const entries = dayEntries
        .filter((entry) => entry.drUse || entry.svUse)
        .flatMap((entry) => {
          const result = []
          if (entry.drUse && entry.drFromMinutes !== null && entry.drToMinutes !== null) {
            const duration = durationMinutes(entry.drFromMinutes, entry.drToMinutes)
            if (duration !== null) {
              result.push({
                date: entry.date.toISOString(),
                startTime: to24Hour(entry.drFromMinutes),
                endTime: to24Hour(entry.drToMinutes),
                minutes: duration,
                notes: 'DR',
              })
            }
          }
          if (entry.svUse && entry.svFromMinutes !== null && entry.svToMinutes !== null) {
            const duration = durationMinutes(entry.svFromMinutes, entry.svToMinutes)
            if (duration !== null) {
              result.push({
                date: entry.date.toISOString(),
                startTime: to24Hour(entry.svFromMinutes),
                endTime: to24Hour(entry.svToMinutes),
                minutes: duration,
                notes: 'SV',
              })
            }
          }
          return result
        })
      return entries
    })(),
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="text-sm font-semibold text-yellow-800 hover:text-yellow-900"
          >
            {showDebug ? '▼' : '▶'} Debug Panel (Dev Only)
          </button>
          {showDebug && (
            <div className="mt-2 text-xs font-mono bg-white p-3 rounded border border-yellow-300 max-h-96 overflow-auto">
              <div className="mb-2">
                <strong>Default Times (minutes):</strong>
                <pre className="mt-1">{JSON.stringify(debugData.defaultTimes, null, 2)}</pre>
              </div>
              <div className="mb-2">
                <strong>Day Entries (first 3):</strong>
                <pre className="mt-1">{JSON.stringify(debugData.dayEntries.slice(0, 3), null, 2)}</pre>
              </div>
              <div className="mb-2">
                <strong>Save Payload (first 3):</strong>
                <pre className="mt-1">{JSON.stringify(debugData.savePayload.slice(0, 3), null, 2)}</pre>
              </div>
              <div>
                <strong>Total Hours:</strong> {totalHours.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mb-6">
        <Link
          href="/timesheets"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Timesheets
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {timesheet ? 'Edit Timesheet' : 'Create Timesheet'}
        </h1>
        {timesheet && timesheet.status !== 'DRAFT' && (
          <p className="mt-2 text-sm text-yellow-600">
            Note: Only draft timesheets can be edited. This timesheet status is: {timesheet.status}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dates Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Dates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="MM/dd/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholderText="mm/dd/yyyy"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="MM/dd/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholderText="mm/dd/yyyy"
                required
              />
            </div>
          </div>
        </div>

        {/* Default Times Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Default Times</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Day
                  </th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-l border-r">
                    DR
                  </th>
                  <th colSpan={2} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    SV
                  </th>
                </tr>
                <tr>
                  <th></th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">From</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500 border-r">To</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">From</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">To</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(['sun', 'weekdays', 'fri'] as const).map((dayType) => {
                  const defaults = defaultTimes[dayType]
                  return (
                    <tr key={dayType}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                        {dayType === 'sun' ? 'Sun' : dayType === 'fri' ? 'Fri' : 'Weekdays'}
                      </td>
                      <td className="px-4 py-2">
                        <TimePartsInput
                          value={defaults.drFromMinutes}
                          onChange={(minutes) => updateDefaultTimes(dayType, 'drFrom', minutes)}
                          placeholder="--:-- AM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-4 py-2 border-r">
                        <TimePartsInput
                          value={defaults.drToMinutes}
                          onChange={(minutes) => updateDefaultTimes(dayType, 'drTo', minutes)}
                          placeholder="--:-- PM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <TimePartsInput
                          value={defaults.svFromMinutes}
                          onChange={(minutes) => updateDefaultTimes(dayType, 'svFrom', minutes)}
                          placeholder="--:-- AM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <TimePartsInput
                          value={defaults.svToMinutes}
                          onChange={(minutes) => updateDefaultTimes(dayType, 'svTo', minutes)}
                          placeholder="--:-- PM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={defaults.enabled}
                          onChange={(e) =>
                            updateDefaultTimes(dayType, 'enabled', e.target.checked)
                          }
                          className="rounded border-gray-300 text-primary-600"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

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
                Insurance <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={insuranceId}
                onChange={(e) => setInsuranceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select insurance</option>
                {insurances.map((insurance) => (
                  <option key={insurance.id} value={insurance.id}>
                    {insurance.name}
                  </option>
                ))}
              </select>
            </div>
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
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">DAY</th>
                    <th colSpan={4} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase border-l border-r">DR</th>
                    <th colSpan={4} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">SV</th>
                    {!timesheet && (
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
                    )}
                  </tr>
                  <tr>
                    <th></th>
                    <th></th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500 border-l">FROM</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">TO</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">HOURS</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500 border-r">USE</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">FROM</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">TO</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">HOURS</th>
                    <th className="px-2 py-1 text-xs font-medium text-gray-500">USE</th>
                    {!timesheet && <th></th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dayEntries.map((entry, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {format(entry.date, 'EEE M/d/yyyy')}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {entry.dayName}
                      </td>
                      <td className="px-2 py-2 border-l">
                        <TimePartsInput
                          value={entry.drFromMinutes}
                          onChange={(minutes) => updateDayEntry(index, 'drFrom', minutes)}
                          placeholder="--:-- AM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <TimePartsInput
                          value={entry.drToMinutes}
                          onChange={(minutes) => updateDayEntry(index, 'drTo', minutes)}
                          placeholder="--:-- PM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-700">
                        {entry.drHours > 0 ? entry.drHours.toFixed(2) : '-'}
                      </td>
                      <td className="px-2 py-2 border-r">
                        <input
                          type="checkbox"
                          checked={entry.drUse}
                          onChange={(e) => updateDayEntry(index, 'drUse', e.target.checked)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <TimePartsInput
                          value={entry.svFromMinutes}
                          onChange={(minutes) => updateDayEntry(index, 'svFrom', minutes)}
                          placeholder="--:-- AM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <TimePartsInput
                          value={entry.svToMinutes}
                          onChange={(minutes) => updateDayEntry(index, 'svTo', minutes)}
                          placeholder="--:-- PM"
                          className="justify-center"
                        />
                      </td>
                      <td className="px-2 py-2 text-sm text-gray-700">
                        {entry.svHours > 0 ? entry.svHours.toFixed(2) : '-'}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={entry.svUse}
                          onChange={(e) => updateDayEntry(index, 'svUse', e.target.checked)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                      </td>
                      {!timesheet && (
                        <td className="px-2 py-2 text-center">
                          {entry.isOverridden && (
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
                  ))}
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

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Link
            href="/timesheets"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || dayEntries.length === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (timesheet ? 'Updating...' : 'Creating...') : (timesheet ? 'Update Timesheet' : 'Create Timesheet')}
          </button>
        </div>
      </form>
    </div>
  )
}
