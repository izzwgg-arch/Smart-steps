'use client'

import { useState, useEffect, useRef } from 'react'

interface TimeFieldProps {
  value: string | null // 24-hour format "HH:mm" or null
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

/**
 * TimeField - Rebuilt time input component
 * 
 * Requirements:
 * - Allows ANY time entry (00:00-23:59)
 * - NO auto-jump/auto-rewrite while typing
 * - Parsing ONLY on blur
 * - Internal format: 24-hour "HH:mm" string
 * - Display: 12-hour with AM/PM
 * - No NaN ever
 */
export function TimeField({
  value,
  onChange,
  placeholder = '--:-- AM',
  className = '',
  disabled = false,
  required = false,
}: TimeFieldProps) {
  // rawText: what user is typing (never auto-rewritten)
  const [rawText, setRawText] = useState<string>('')
  // value24: canonical 24-hour "HH:mm" format (updated only on blur)
  const [value24, setValue24] = useState<string | null>(value)
  // Display parts derived from value24
  const [displayParts, setDisplayParts] = useState<{
    hour12: string
    minute: string
    ampm: 'AM' | 'PM'
  } | null>(null)
  // Validation error
  const [error, setError] = useState<string | null>(null)
  // Track if input is focused (to prevent auto-formatting while typing)
  const [isFocused, setIsFocused] = useState(false)
  // AM/PM state (for toggle)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM')
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Convert 24-hour "HH:mm" to 12-hour display parts
  const value24ToDisplayParts = (val24: string | null): {
    hour12: string
    minute: string
    ampm: 'AM' | 'PM'
  } | null => {
    if (!val24) return null
    
    const [hours, minutes] = val24.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return null
    
    let hour12 = hours % 12
    if (hour12 === 0) hour12 = 12
    const ampmVal: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
    
    return {
      hour12: hour12.toString(),
      minute: minutes.toString().padStart(2, '0'),
      ampm: ampmVal,
    }
  }

  // Parse user input to 24-hour "HH:mm" format
  // Accepts various formats: "3:00 PM", "15:00", "3 PM", "3:00", etc.
  const parseTo24Hour = (text: string, currentAmpm: 'AM' | 'PM'): string | null => {
    if (!text || text.trim() === '') return null
    
    const trimmed = text.trim()
    
    // Extract AM/PM if present
    const ampmMatch = trimmed.match(/\s*(AM|PM)\s*$/i)
    const hasAmpm = !!ampmMatch
    const detectedAmpm = ampmMatch ? (ampmMatch[1].toUpperCase() === 'PM' ? 'PM' : 'AM') : currentAmpm
    
    // Remove AM/PM and extract numbers
    const numbersOnly = trimmed.replace(/\s*(AM|PM)\s*/gi, '').replace(/\D/g, '')
    
    if (numbersOnly.length === 0) return null
    
    let hours: number
    let minutes: number
    
    // Parse based on length
    if (numbersOnly.length <= 2) {
      // Just hours: "3" or "15"
      hours = parseInt(numbersOnly, 10)
      minutes = 0
    } else if (numbersOnly.length === 3) {
      // "315" -> 3:15
      hours = parseInt(numbersOnly[0], 10)
      minutes = parseInt(numbersOnly.slice(1), 10)
    } else {
      // "1530" or "315" -> HH:MM
      hours = parseInt(numbersOnly.slice(0, 2), 10)
      minutes = parseInt(numbersOnly.slice(2, 4), 10)
    }
    
    if (isNaN(hours) || isNaN(minutes)) return null
    
    // Validate ranges
    if (hours < 0 || hours > 23) return null
    if (minutes < 0 || minutes > 59) return null
    
    // Convert 12-hour to 24-hour if AM/PM detected or if hours <= 12 and no explicit 24-hour format
    if (hasAmpm || (hours <= 12 && !hasAmpm && hours !== 0)) {
      if (detectedAmpm === 'PM' && hours !== 12) {
        hours += 12
      } else if (detectedAmpm === 'AM' && hours === 12) {
        hours = 0
      }
    }
    
    // Ensure valid 24-hour range
    if (hours < 0 || hours > 23) return null
    if (minutes < 0 || minutes > 59) return null
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Initialize from value prop
  useEffect(() => {
    if (value !== value24) {
      setValue24(value)
      const parts = value24ToDisplayParts(value)
      setDisplayParts(parts)
      if (parts) {
        setRawText(`${parts.hour12}:${parts.minute}`)
        setAmpm(parts.ampm)
      } else {
        setRawText('')
      }
      setError(null)
    }
  }, [value])

  // Handle blur - parse and update
  const handleBlur = () => {
    setIsFocused(false)
    
    if (!rawText.trim()) {
      // Empty is allowed (unless required)
      if (required) {
        setError('Time is required')
      } else {
        setError(null)
        setValue24(null)
        onChange(null)
      }
      return
    }
    
    const parsed = parseTo24Hour(rawText, ampm)
    
    if (parsed) {
      setValue24(parsed)
      onChange(parsed)
      const parts = value24ToDisplayParts(parsed)
      setDisplayParts(parts)
      if (parts) {
        setRawText(`${parts.hour12}:${parts.minute}`)
        setAmpm(parts.ampm)
      }
      setError(null)
    } else {
      setError('Invalid time format')
      // Keep rawText as-is for user to fix
    }
  }

  // Handle input change - update rawText only, no parsing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setRawText(newText)
    setError(null) // Clear error while typing
  }

  // Handle AM/PM toggle
  const handleAmpmToggle = (newAmpm: 'AM' | 'PM') => {
    setAmpm(newAmpm)
    
    // If we have a valid time, update it
    if (rawText.trim()) {
      const parsed = parseTo24Hour(rawText, newAmpm)
      if (parsed) {
        setValue24(parsed)
        onChange(parsed)
        const parts = value24ToDisplayParts(parsed)
        if (parts) {
          setDisplayParts(parts)
        }
      }
    }
  }

  // Display value when not focused (show formatted)
  const displayValue = isFocused 
    ? rawText 
    : (displayParts ? `${displayParts.hour12}:${displayParts.minute}` : '')

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true)
              // When focusing, show rawText or current formatted value
              if (!rawText && displayParts) {
                setRawText(`${displayParts.hour12}:${displayParts.minute}`)
              }
            }}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-20 px-2 py-1 text-center border ${
              error ? 'border-red-500' : 'border-gray-300'
            } rounded text-sm focus:ring-primary-500 focus:border-primary-500`}
          />
          <div className="flex border border-gray-300 rounded text-sm overflow-hidden">
            <button
              type="button"
              onClick={() => handleAmpmToggle('AM')}
              disabled={disabled}
              className={`px-2 py-1 ${
                ampm === 'AM'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => handleAmpmToggle('PM')}
              disabled={disabled}
              className={`px-2 py-1 border-l border-gray-300 ${
                ampm === 'PM'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              PM
            </button>
          </div>
        </div>
        {error && (
          <span className="text-xs text-red-500 mt-0.5">{error}</span>
        )}
      </div>
    </div>
  )
}
