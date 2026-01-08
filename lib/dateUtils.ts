import { startOfDay, endOfDay, eachDayOfInterval, format, getDay, parse } from 'date-fns'

export function getDaysInRange(startDate: Date, endDate: Date): Date[] {
  return eachDayOfInterval({
    start: startOfDay(startDate),
    end: endOfDay(endDate),
  })
}

export function getDayName(date: Date): string {
  return format(date, 'EEEE')
}

export function getDayShortName(date: Date): string {
  return format(date, 'EEE')
}

export function isSunday(date: Date): boolean {
  return getDay(date) === 0
}

export function isFriday(date: Date): boolean {
  return getDay(date) === 5
}

export function isSaturday(date: Date): boolean {
  return getDay(date) === 6
}

export function isWeekday(date: Date): boolean {
  const day = getDay(date)
  return day > 0 && day < 5 // Monday to Friday
}

export function formatTimeForInput(time: string): string {
  if (!time || time === '--:--') return ''
  return time
}

export function parseTime(time: string): { hours: number; minutes: number } {
  if (!time || time === '--:--') return { hours: 0, minutes: 0 }
  
  // Handle 12-hour format with AM/PM
  const ampmMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1])
    const minutes = parseInt(ampmMatch[2])
    const ampm = ampmMatch[3].toUpperCase()
    
    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    
    return { hours, minutes }
  }
  
  // Handle 24-hour format
  const [hours, minutes] = time.split(':').map(Number)
  return { hours, minutes }
}

// Convert 24-hour to 12-hour format with AM/PM
export function to12Hour(time24: string): string {
  if (!time24 || time24 === '--:--') return '--:--'
  
  // Check if already in 12-hour format (has AM/PM)
  const ampmMatch = time24.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (ampmMatch) {
    // Validate the time part even if it has AM/PM
    const hours = parseInt(ampmMatch[1], 10)
    const minutes = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase()
    
    // Validate numbers
    if (isNaN(hours) || isNaN(minutes)) return '--:--'
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '--:--'
    
    // Return validated 12-hour format
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }
  
  // Parse 24-hour format
  const parts = time24.split(':')
  if (parts.length !== 2) return '--:--'
  
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  
  // Validate numbers
  if (isNaN(hours) || isNaN(minutes)) return '--:--'
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '--:--'
  
  const hour = hours % 12 || 12
  const ampm = hours >= 12 ? 'PM' : 'AM'
  return `${hour}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

// Convert 12-hour format to 24-hour format
export function to24Hour(time12: string): string {
  if (!time12 || time12 === '--:--' || time12.trim() === '') return '--:--'
  
  const ampmMatch = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10)
    const minutes = parseInt(ampmMatch[2], 10)
    const ampm = ampmMatch[3].toUpperCase()
    
    // Validate parsed values
    if (isNaN(hours) || isNaN(minutes)) return '--:--'
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '--:--'
    
    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  
  // If already in 24-hour format, validate and return
  const time24Match = time12.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)
  if (time24Match) {
    return time12
  }
  
  // Invalid format, return placeholder
  return '--:--'
}

export function calculateMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === '--:--' || endTime === '--:--') {
    return 0
  }
  
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes
  
  return Math.max(0, endMinutes - startMinutes)
}

export function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function calculateUnits(minutes: number): number {
  return Math.round((minutes / 15) * 100) / 100
}
