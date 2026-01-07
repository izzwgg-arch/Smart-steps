/**
 * Time Utilities for 24-hour "HH:mm" string format
 * 
 * Internal format: "HH:mm" (e.g., "15:30") or null
 * Never returns NaN
 */

/**
 * Convert 24-hour "HH:mm" string to minutes since midnight
 * Returns null if invalid (never NaN)
 */
export function time24ToMinutes(time24: string | null): number | null {
  if (!time24) return null
  
  const [hours, minutes] = time24.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to 24-hour "HH:mm" string
 * Returns null if invalid
 */
export function minutesToTime24(minutes: number | null): string | null {
  if (minutes === null || minutes < 0 || minutes >= 1440) return null
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Calculate duration in minutes between two 24-hour time strings
 * Returns null if invalid (never NaN)
 */
export function durationTime24(start24: string | null, end24: string | null): number | null {
  const startMins = time24ToMinutes(start24)
  const endMins = time24ToMinutes(end24)
  
  if (startMins === null || endMins === null) return null
  if (endMins < startMins) return null // Overnight not supported
  
  return endMins - startMins
}

/**
 * Validate time range (end >= start)
 */
export function validateTime24Range(
  start24: string | null,
  end24: string | null
): { valid: boolean; error?: string } {
  if (!start24) {
    return { valid: false, error: 'Start time is required' }
  }
  if (!end24) {
    return { valid: false, error: 'End time is required' }
  }
  
  const startMins = time24ToMinutes(start24)
  const endMins = time24ToMinutes(end24)
  
  if (startMins === null) {
    return { valid: false, error: 'Invalid start time' }
  }
  if (endMins === null) {
    return { valid: false, error: 'Invalid end time' }
  }
  if (endMins < startMins) {
    return { valid: false, error: 'End time must be after start time' }
  }
  
  return { valid: true }
}
