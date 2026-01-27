import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      fileData,
      mapping,
      fileName,
      periodStart,
      periodEnd,
    } = body

    if (!fileData || !mapping || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: fileData, mapping, fileName' },
        { status: 400 }
      )
    }

    // Validate required mappings
    if (!mapping.workDate) {
      return NextResponse.json(
        { error: 'Work Date mapping is required' },
        { status: 400 }
      )
    }

    if (!mapping.employeeName && !mapping.employeeExternalId) {
      return NextResponse.json(
        { error: 'Either Employee Name or Employee External ID mapping is required' },
        { status: 400 }
      )
    }

    // Check that at least one time field is mapped
    const hasTimeMapping = 
      mapping.minutesWorked ||
      mapping.hoursWorked ||
      (mapping.inTime && mapping.outTime) ||
      mapping.eventType // Event-based files (Clock-in/Clock-out)

    if (!hasTimeMapping) {
      return NextResponse.json(
        { error: 'At least one time field must be mapped: Minutes Worked, Hours Worked, both In Time and Out Time, or Event Type for event-based files.' },
        { status: 400 }
      )
    }

    // Check if this is an event-based file (has Att Type or Event Type column)
    // If IN and OUT are mapped to the same column, we'll pair events
    const hasEventTypeMapping = mapping.eventType || false
    const hasSameTimeColumn = mapping.inTime && mapping.outTime && mapping.inTime === mapping.outTime
    const hasOnlyInTime = mapping.inTime && !mapping.outTime // Only IN time mapped, no OUT time
    
    // FINGERPRINT SCANNER: Same column for IN/OUT OR only IN time mapped (no OUT) = sequential pairing
    // This handles cases where user only maps IN TIME column (fingerprint scanner files)
    const isFingerprintScannerCandidate = (hasSameTimeColumn || hasOnlyInTime) && !hasEventTypeMapping

    // Parse file data - IMPORTANT: Preserve ALL rows, maintain original order
    let data: any[] = []
    
    if (fileData.type === 'excel') {
      const buffer = Buffer.from(fileData.buffer, 'base64')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      // Use raw: true to preserve date/time values, then convert manually
      data = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null })
    } else if (fileData.type === 'csv') {
      const buffer = Buffer.from(fileData.buffer, 'base64')
      // Parse CSV using XLSX (it can read CSV)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null })
    }

    // Log total rows detected
    console.log(`[PAYROLL IMPORT] Total rows detected in file: ${data.length}`)

    // FINGERPRINT SCANNER DETECTION: 
    // ALWAYS check for multiple punches per employee per day FIRST
    // If detected, treat as fingerprint scanner regardless of mapping
    const employeeDateCounts = new Map<string, number>()
    data.forEach((row) => {
      const employeeId = (mapping.employeeName ? row[mapping.employeeName] : row[mapping.employeeExternalId])?.toString().trim() || ''
      const dateValue = row[mapping.workDate]
      let workDate: Date | null = null
      
      if (dateValue instanceof Date) {
        workDate = dateValue
      } else if (typeof dateValue === 'string') {
        workDate = new Date(dateValue)
      } else if (typeof dateValue === 'number') {
        workDate = new Date((dateValue - 25569) * 86400 * 1000)
      }
      
      if (workDate && !isNaN(workDate.getTime())) {
        const dateKey = `${employeeId}|${workDate.toISOString().split('T')[0]}`
        employeeDateCounts.set(dateKey, (employeeDateCounts.get(dateKey) || 0) + 1)
      }
    })
    
    // Check if any employee+date has more than 1 punch (fingerprint scanner pattern)
    const hasMultiplePunchesPerDay = Array.from(employeeDateCounts.values()).some(count => count > 1)
    
    // ALSO: If IN and OUT are mapped to different columns, it's likely a fingerprint scanner
    // where each row has one punch (either IN or OUT time)
    const hasSeparateInOutColumns = mapping.inTime && mapping.outTime && mapping.inTime !== mapping.outTime
    
    // FINGERPRINT SCANNER: If multiple punches per day detected, ALWAYS treat as fingerprint scanner
    // OR if mapping suggests it (same column, only IN time, OR separate IN/OUT columns)
    const isFingerprintScanner = (hasMultiplePunchesPerDay || isFingerprintScannerCandidate || hasSeparateInOutColumns) && !hasEventTypeMapping && data.length > 0
    
    console.log(`[PAYROLL IMPORT] Fingerprint scanner detection:`, {
      hasMultiplePunchesPerDay,
      employeeDateCounts: Array.from(employeeDateCounts.entries()).slice(0, 5),
      isFingerprintScannerCandidate,
      hasEventTypeMapping,
      isFingerprintScanner,
    })

    // Check if this is an event-based file (has Att Type or Event Type column)
    const eventTypeColumn = mapping.eventType || 'Att Type'
    const isEventBased = hasEventTypeMapping && data.length > 0 && data[0][eventTypeColumn] !== undefined

    // Debug logging
    console.log(`[PAYROLL IMPORT] Detection check:`, {
      hasSameTimeColumn,
      hasOnlyInTime,
      hasEventTypeMapping,
      inTime: mapping.inTime,
      outTime: mapping.outTime,
      eventType: mapping.eventType,
      dataLength: data.length,
      isFingerprintScannerCandidate,
      isFingerprintScanner,
      isEventBased,
    })

    if (isEventBased) {
      console.log(`[PAYROLL IMPORT] Detected event-based file format with event type column: ${eventTypeColumn}`)
    }
    
    if (isFingerprintScanner) {
      console.log(`[PAYROLL IMPORT] ✅ Detected fingerprint scanner file format: same column for IN/OUT, no event type. Will pair punches sequentially.`)
    }

    // Create PayrollImport record
    const payrollImport = await prisma.payrollImport.create({
      data: {
        originalFileName: fileName,
        uploadedByUserId: session.user.id,
        uploadedAt: new Date(),
        status: 'DRAFT',
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        mappingJson: mapping as any,
      },
    })

    // Process rows - handle event-based files and fingerprint scanner files differently
    let rows: any[] = []

    if (isFingerprintScanner) {
      // FINGERPRINT SCANNER: Pair punches sequentially (1st=IN, 2nd=OUT, 3rd=IN, 4th=OUT, etc.)
      console.log(`[PAYROLL IMPORT] Processing fingerprint scanner file: pairing punches sequentially`)
      
      // Group by employee + date
      const punchesByEmployeeDate: Map<string, any[]> = new Map()
      
      data.forEach((row, index) => {
        const employeeId = (mapping.employeeName ? row[mapping.employeeName] : row[mapping.employeeExternalId])?.toString().trim() || ''
        const dateValue = row[mapping.workDate]
        let workDate: Date | null = null
        
        if (dateValue instanceof Date) {
          workDate = dateValue
        } else if (typeof dateValue === 'string') {
          workDate = new Date(dateValue)
        } else if (typeof dateValue === 'number') {
          workDate = new Date((dateValue - 25569) * 86400 * 1000)
        }
        
        if (!workDate || isNaN(workDate.getTime())) return
        
        const dateKey = `${employeeId}|${workDate.toISOString().split('T')[0]}`
        
        if (!punchesByEmployeeDate.has(dateKey)) {
          punchesByEmployeeDate.set(dateKey, [])
        }
        
        // SIMPLE APPROACH: Each row is ONE punch. Use the time column that's mapped.
        // If both IN and OUT columns are mapped to different columns, use whichever has a value.
        // Most fingerprint scanners export one punch per row.
        const timeColumn = mapping.inTime || mapping.outTime
        const timeValue = timeColumn ? row[timeColumn] : null
        
        if (!timeValue || String(timeValue).trim() === '') return
        
        punchesByEmployeeDate.get(dateKey)!.push({
          index,
          row,
          time: timeValue,
          workDate,
          employeeNameRaw: mapping.employeeName ? row[mapping.employeeName]?.toString().trim() : null,
          employeeExternalIdRaw: mapping.employeeExternalId ? row[mapping.employeeExternalId]?.toString().trim() : null,
        })
      })
      
      // Helper function for parsing time (reuse from event-based logic)
      function parseTimeValue(timeValue: any, baseDate: Date | null): Date | null {
        if (!timeValue || !baseDate) return null
        
        if (timeValue instanceof Date) {
          if (isNaN(timeValue.getTime())) return null
          return timeValue
        }
        
        if (typeof timeValue === 'number') {
          const totalSeconds = Math.floor(timeValue * 86400)
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          
          const result = new Date(baseDate)
          result.setHours(hours, minutes, seconds, 0)
          return result
        }
        
        if (typeof timeValue === 'string') {
          const trimmed = timeValue.trim()
          if (!trimmed) return null
          
          const isoDate = new Date(trimmed)
          if (!isNaN(isoDate.getTime())) {
            return isoDate
          }
          
          const timePattern1 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
          if (timePattern1) {
            let hours = parseInt(timePattern1[1])
            const minutes = parseInt(timePattern1[2])
            const seconds = timePattern1[3] ? parseInt(timePattern1[3]) : 0
            
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              const result = new Date(baseDate)
              result.setHours(hours, minutes, seconds, 0)
              return result
            }
          }
          
          const timePattern2 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
          if (timePattern2) {
            let hours = parseInt(timePattern2[1])
            const minutes = parseInt(timePattern2[2])
            const seconds = timePattern2[3] ? parseInt(timePattern2[3]) : 0
            const period = timePattern2[4]?.trim().toUpperCase()
            
            if (period === 'PM' && hours !== 12) hours += 12
            if (period === 'AM' && hours === 12) hours = 0
            
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              const result = new Date(baseDate)
              result.setHours(hours, minutes, seconds, 0)
              return result
            }
          }
        }
        
        return null
      }
      
      // Pair punches sequentially for each employee + date group
      let rowIndex = 0
      console.log(`[PAYROLL IMPORT] Fingerprint scanner: Processing ${punchesByEmployeeDate.size} employee+date groups`)
      
      punchesByEmployeeDate.forEach((punches, key) => {
        console.log(`[PAYROLL IMPORT] Fingerprint scanner: Group ${key} has ${punches.length} punches`)
        
        if (punches.length === 0) return
        
        // RESTORE PREVIOUS BEHAVIOR: Collect ALL punches, sort chronologically, then pair
        // This matches the original behavior: earliest = IN, latest = OUT (for 2 punches)
        // For more than 2 punches: pair sequentially (1-2, 3-4, etc.)
        
        // Sort ALL punches chronologically by time (regardless of which column they came from)
        punches.sort((a, b) => {
          const timeA = parseTimeValue(a.time, a.workDate)
          const timeB = parseTimeValue(b.time, b.workDate)
          if (!timeA || !timeB) return 0
          return timeA.getTime() - timeB.getTime()
        })
        
        console.log(`[PAYROLL IMPORT] Fingerprint scanner: After sorting, group ${key} has ${punches.length} punches`)
        console.log(`[PAYROLL IMPORT] Fingerprint scanner: Group ${key} punch times:`, punches.map(p => {
          const t = parseTimeValue(p.time, p.workDate)
          return t ? t.toISOString() : 'null'
        }))
        
        // RESTORE PREVIOUS BEHAVIOR: For 2 punches, use earliest as IN and latest as OUT (ONE row)
        // For more than 2 punches, pair sequentially (1-2, 3-4, etc.) - creates multiple rows
        // For 1 punch, IN only, OUT null
        
        if (punches.length === 2) {
          // TWO PUNCHES: Earliest = IN, Latest = OUT (ONE row)
          const firstPunch = punches[0]
          const secondPunch = punches[1]
          
          const inTime = parseTimeValue(firstPunch.time, firstPunch.workDate)
          const outTime = parseTimeValue(secondPunch.time, secondPunch.workDate)
          
          if (!inTime) {
            console.warn(`[PAYROLL IMPORT] Fingerprint scanner: Skipping pair - could not parse IN time`)
            return
          }
          
          // Calculate hours if both IN and OUT exist
          let minutesWorked: number | null = null
          let hoursWorked: number | null = null
          
          if (inTime && outTime) {
            // Handle overnight shifts
            let adjustedOutTime = new Date(outTime)
            if (adjustedOutTime < inTime) {
              adjustedOutTime.setDate(adjustedOutTime.getDate() + 1)
            }
            
            const diffMs = adjustedOutTime.getTime() - inTime.getTime()
            if (diffMs > 0) {
              minutesWorked = Math.floor(diffMs / (1000 * 60))
              hoursWorked = parseFloat((minutesWorked / 60).toFixed(2))
            }
          }
          
          // Store raw punches in rawJson for data safety
          const rawPunches = [firstPunch.row, secondPunch.row]
          
          rows.push({
            importId: payrollImport.id,
            rowIndex: rowIndex++,
            employeeNameRaw: firstPunch.employeeNameRaw,
            employeeExternalIdRaw: firstPunch.employeeExternalIdRaw,
            workDate: firstPunch.workDate,
            inTime: inTime,
            outTime: outTime,
            minutesWorked: minutesWorked,
            hoursWorked: hoursWorked,
            linkedEmployeeId: null,
            rawJson: {
              rawPunches: rawPunches,
              originalInIndex: firstPunch.index,
              originalOutIndex: secondPunch.index,
              isIncomplete: !outTime,
            },
          })
        } else if (punches.length === 1) {
          // ONE PUNCH: IN only, OUT null
          const punch = punches[0]
          const inTime = parseTimeValue(punch.time, punch.workDate)
          
          if (!inTime) {
            console.warn(`[PAYROLL IMPORT] Fingerprint scanner: Skipping single punch - could not parse time`)
            return
          }
          
          rows.push({
            importId: payrollImport.id,
            rowIndex: rowIndex++,
            employeeNameRaw: punch.employeeNameRaw,
            employeeExternalIdRaw: punch.employeeExternalIdRaw,
            workDate: punch.workDate,
            inTime: inTime,
            outTime: null,
            minutesWorked: null,
            hoursWorked: null,
            linkedEmployeeId: null,
            rawJson: {
              rawPunches: [punch.row],
              originalInIndex: punch.index,
              originalOutIndex: null,
              isIncomplete: true,
            },
          })
        } else {
          // MORE THAN 2 PUNCHES: Pair sequentially (1-2, 3-4, etc.) - creates multiple rows
          for (let i = 0; i < punches.length; i += 2) {
            const inPunch = punches[i]
            const outPunch = punches[i + 1]
            
            const inTime = parseTimeValue(inPunch.time, inPunch.workDate)
            const outTime = outPunch ? parseTimeValue(outPunch.time, outPunch.workDate) : null
            
            console.log(`[PAYROLL IMPORT] Fingerprint scanner: Pair ${Math.floor(i/2) + 1} - IN: ${inTime ? inTime.toISOString() : 'null'}, OUT: ${outTime ? outTime.toISOString() : 'null'}`)
            
            if (!inTime) {
              console.warn(`[PAYROLL IMPORT] Fingerprint scanner: Skipping pair ${Math.floor(i/2) + 1} - could not parse IN time`)
              continue // Skip if can't parse IN time
            }
            
            // Calculate hours if both IN and OUT exist
            let minutesWorked: number | null = null
            let hoursWorked: number | null = null
            
            if (inTime && outTime) {
              // Handle overnight shifts
              let adjustedOutTime = new Date(outTime)
              if (adjustedOutTime < inTime) {
                adjustedOutTime.setDate(adjustedOutTime.getDate() + 1)
              }
              
              const diffMs = adjustedOutTime.getTime() - inTime.getTime()
              if (diffMs > 0) {
                minutesWorked = Math.floor(diffMs / (1000 * 60))
                hoursWorked = parseFloat((minutesWorked / 60).toFixed(2))
              }
            }
            
            // Store raw punches in rawJson for data safety
            const rawPunches = [inPunch.row]
            if (outPunch) {
              rawPunches.push(outPunch.row)
            }
            
            rows.push({
              importId: payrollImport.id,
              rowIndex: rowIndex++,
              employeeNameRaw: inPunch.employeeNameRaw,
              employeeExternalIdRaw: inPunch.employeeExternalIdRaw,
              workDate: inPunch.workDate,
              inTime: inTime,
              outTime: outTime,
              minutesWorked: minutesWorked,
              hoursWorked: hoursWorked,
              linkedEmployeeId: null,
              rawJson: {
                rawPunches: rawPunches,
                originalInIndex: inPunch.index,
                originalOutIndex: outPunch ? outPunch.index : null,
                isIncomplete: !outPunch,
              },
            })
          }
        }
      })
      
      console.log(`[PAYROLL IMPORT] Fingerprint scanner: Created ${rows.length} paired shift rows from ${data.length} raw punch rows`)
    } else if (isEventBased && mapping.inTime === mapping.outTime) {
      // EVENT-BASED: Pair IN and OUT events
      console.log(`[PAYROLL IMPORT] Pairing IN/OUT events for event-based file`)
      
      // Group events by employee + date
      const eventsByEmployeeDate: Map<string, any[]> = new Map()
      
      data.forEach((row, index) => {
        const employeeId = (mapping.employeeName ? row[mapping.employeeName] : row[mapping.employeeExternalId])?.toString().trim() || ''
        const dateValue = row[mapping.workDate]
        let workDate: Date | null = null
        
        if (dateValue instanceof Date) {
          workDate = dateValue
        } else if (typeof dateValue === 'string') {
          workDate = new Date(dateValue)
        } else if (typeof dateValue === 'number') {
          workDate = new Date((dateValue - 25569) * 86400 * 1000)
        }
        
        if (!workDate || isNaN(workDate.getTime())) return
        
        const dateKey = `${employeeId}|${workDate.toISOString().split('T')[0]}`
        
        if (!eventsByEmployeeDate.has(dateKey)) {
          eventsByEmployeeDate.set(dateKey, [])
        }
        
        const eventType = String(row[eventTypeColumn] || '').trim().toLowerCase()
        const isClockIn = eventType.includes('in') || eventType === 'clock-in' || eventType === 'clockin'
        const isClockOut = eventType.includes('out') || eventType === 'clock-out' || eventType === 'clockout'
        
        eventsByEmployeeDate.get(dateKey)!.push({
          index,
          row,
          isClockIn,
          isClockOut,
          time: row[mapping.inTime],
          workDate,
          employeeNameRaw: mapping.employeeName ? row[mapping.employeeName]?.toString().trim() : null,
          employeeExternalIdRaw: mapping.employeeExternalId ? row[mapping.employeeExternalId]?.toString().trim() : null,
        })
      })
      
      // Pair IN and OUT events
      let rowIndex = 0
      eventsByEmployeeDate.forEach((events, key) => {
        // Sort events by time
        events.sort((a, b) => {
          const timeA = String(a.time || '').trim()
          const timeB = String(b.time || '').trim()
          return timeA.localeCompare(timeB)
        })
        
        // Pair consecutive IN/OUT events
        let currentIn: any = null
        for (const event of events) {
          if (event.isClockIn && !currentIn) {
            currentIn = event
          } else if (event.isClockOut && currentIn) {
            // Create a paired row
            rows.push({
              importId: payrollImport.id,
              rowIndex: rowIndex++,
              employeeNameRaw: currentIn.employeeNameRaw,
              employeeExternalIdRaw: currentIn.employeeExternalIdRaw,
              workDate: currentIn.workDate,
              inTime: parseTimeValue(currentIn.time, currentIn.workDate),
              outTime: parseTimeValue(event.time, event.workDate),
              minutesWorked: null,
              hoursWorked: null,
              linkedEmployeeId: null,
              rawJson: {
                ...currentIn.row,
                pairedWith: event.row,
                originalInIndex: currentIn.index,
                originalOutIndex: event.index,
              },
            })
            currentIn = null
          }
        }
        
        // Handle unpaired IN events (no matching OUT)
        if (currentIn) {
          rows.push({
            importId: payrollImport.id,
            rowIndex: rowIndex++,
            employeeNameRaw: currentIn.employeeNameRaw,
            employeeExternalIdRaw: currentIn.employeeExternalIdRaw,
            workDate: currentIn.workDate,
            inTime: parseTimeValue(currentIn.time, currentIn.workDate),
            outTime: null,
            minutesWorked: null,
            hoursWorked: null,
            linkedEmployeeId: null,
            rawJson: {
              ...currentIn.row,
              unpaired: true,
              originalIndex: currentIn.index,
            },
          })
        }
      })
      
      // Helper function for parsing time (needs to be accessible)
      function parseTimeValue(timeValue: any, baseDate: Date | null): Date | null {
        if (!timeValue || !baseDate) return null
        
        if (timeValue instanceof Date) {
          if (isNaN(timeValue.getTime())) return null
          return timeValue
        }
        
        if (typeof timeValue === 'number') {
          const totalSeconds = Math.floor(timeValue * 86400)
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          
          const result = new Date(baseDate)
          result.setHours(hours, minutes, seconds, 0)
          return result
        }
        
        if (typeof timeValue === 'string') {
          const trimmed = timeValue.trim()
          if (!trimmed) return null
          
          const isoDate = new Date(trimmed)
          if (!isNaN(isoDate.getTime())) {
            return isoDate
          }
          
          const timePattern1 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
          if (timePattern1) {
            let hours = parseInt(timePattern1[1])
            const minutes = parseInt(timePattern1[2])
            const seconds = timePattern1[3] ? parseInt(timePattern1[3]) : 0
            
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              const result = new Date(baseDate)
              result.setHours(hours, minutes, seconds, 0)
              return result
            }
          }
          
          const timePattern2 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
          if (timePattern2) {
            let hours = parseInt(timePattern2[1])
            const minutes = parseInt(timePattern2[2])
            const seconds = timePattern2[3] ? parseInt(timePattern2[3]) : 0
            const period = timePattern2[4]?.trim().toUpperCase()
            
            if (period === 'PM' && hours !== 12) hours += 12
            if (period === 'AM' && hours === 12) hours = 0
            
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
              const result = new Date(baseDate)
              result.setHours(hours, minutes, seconds, 0)
              return result
            }
          }
        }
        
        return null
      }
      
      // Calculate hours for paired rows
      rows.forEach((row) => {
        if (row.inTime && row.outTime) {
          let outTime = new Date(row.outTime)
          if (outTime < row.inTime) {
            outTime.setDate(outTime.getDate() + 1)
          }
          const diffMs = outTime.getTime() - new Date(row.inTime).getTime()
          if (diffMs > 0) {
            row.minutesWorked = Math.floor(diffMs / (1000 * 60))
            row.hoursWorked = parseFloat((row.minutesWorked / 60).toFixed(2))
          }
        }
      })
    } else {
      // STANDARD: Process rows normally (one row = one timesheet entry)
      console.log(`[PAYROLL IMPORT] Using STANDARD processing path (not fingerprint scanner, not event-based)`)
      console.log(`[PAYROLL IMPORT] Standard path check: isFingerprintScanner=${isFingerprintScanner}, isEventBased=${isEventBased}, hasSameTimeColumn=${hasSameTimeColumn}`)
      rows = data.map((row, index) => {
        const employeeNameRaw = mapping.employeeName ? row[mapping.employeeName]?.toString().trim() : null
        const employeeExternalIdRaw = mapping.employeeExternalId ? row[mapping.employeeExternalId]?.toString().trim() : null
      
      // Parse work date
      let workDate: Date | null = null
      if (mapping.workDate && row[mapping.workDate]) {
        const dateValue = row[mapping.workDate]
        if (dateValue instanceof Date) {
          workDate = dateValue
        } else if (typeof dateValue === 'string') {
          workDate = new Date(dateValue)
        } else if (typeof dateValue === 'number') {
          // Excel serial date
          workDate = new Date((dateValue - 25569) * 86400 * 1000)
        }
      }

      // Parse time fields - CRITICAL: Preserve distinct IN and OUT values
      let inTime: Date | null = null
      let outTime: Date | null = null
      let minutesWorked: number | null = null
      let hoursWorked: number | null = null

      // Helper function to parse time value
      const parseTimeValue = (timeValue: any, baseDate: Date | null): Date | null => {
        if (!timeValue) return null
        
        // If already a Date object, use it directly
        if (timeValue instanceof Date) {
          if (isNaN(timeValue.getTime())) return null
          return timeValue
        }
        
        // If number (Excel serial time), convert it
        if (typeof timeValue === 'number') {
          if (!baseDate) return null
          // Excel time is fraction of day (0.5 = noon)
          const totalSeconds = Math.floor(timeValue * 86400)
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          
          const result = new Date(baseDate)
          result.setHours(hours, minutes, seconds, 0)
          return result
        }
        
        // If string, try multiple parsing strategies
        if (typeof timeValue === 'string') {
          const trimmed = timeValue.trim()
          if (!trimmed) return null
          
          // Try ISO date string first
          const isoDate = new Date(trimmed)
          if (!isNaN(isoDate.getTime())) {
            return isoDate
          }
          
          // Try time-only formats (HH:mm, HH:mm:ss, H:mm AM/PM)
          if (baseDate) {
            // Pattern 1: HH:mm or H:mm
            const timePattern1 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
            if (timePattern1) {
              let hours = parseInt(timePattern1[1])
              const minutes = parseInt(timePattern1[2])
              const seconds = timePattern1[3] ? parseInt(timePattern1[3]) : 0
              
              if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                const result = new Date(baseDate)
                result.setHours(hours, minutes, seconds, 0)
                return result
              }
            }
            
            // Pattern 2: H:mm AM/PM
            const timePattern2 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/)
            if (timePattern2) {
              let hours = parseInt(timePattern2[1])
              const minutes = parseInt(timePattern2[2])
              const seconds = timePattern2[3] ? parseInt(timePattern2[3]) : 0
              const period = timePattern2[4]?.trim().toUpperCase()
              
              if (period === 'PM' && hours !== 12) hours += 12
              if (period === 'AM' && hours === 12) hours = 0
              
              if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                const result = new Date(baseDate)
                result.setHours(hours, minutes, seconds, 0)
                return result
              }
            }
          }
        }
        
        return null
      }

      // Parse IN time
      if (mapping.inTime && row[mapping.inTime] !== null && row[mapping.inTime] !== undefined && row[mapping.inTime] !== '') {
        inTime = parseTimeValue(row[mapping.inTime], workDate)
      }

      // Parse OUT time - MUST be distinct from IN time
      if (mapping.outTime && row[mapping.outTime] !== null && row[mapping.outTime] !== undefined && row[mapping.outTime] !== '') {
        // CRITICAL: Check if source values are identical BEFORE parsing
        const inTimeSource = mapping.inTime ? row[mapping.inTime] : null
        const outTimeSource = row[mapping.outTime]
        
        // If source values are identical (same string/number), this is invalid
        if (inTimeSource !== null && inTimeSource !== undefined && 
            outTimeSource !== null && outTimeSource !== undefined &&
            String(inTimeSource).trim() === String(outTimeSource).trim()) {
          console.warn(`[PAYROLL IMPORT] Row ${index + 1}: Source IN and OUT values are identical (${String(inTimeSource)}). OUT time will be set to null. Please check your column mapping.`)
          outTime = null
        } else {
          // Only parse if source values are different
          outTime = parseTimeValue(outTimeSource, workDate)
          
          // CRITICAL: If parsed OUT time equals IN time, this is an error - do NOT use the same value
          if (inTime && outTime && outTime.getTime() === inTime.getTime()) {
            console.warn(`[PAYROLL IMPORT] Row ${index + 1}: Parsed IN and OUT times are identical (${inTime.toISOString()}). OUT time will be set to null.`)
            outTime = null
          }
          
          // Handle overnight shifts (OUT < IN on same day)
          if (inTime && outTime && outTime < inTime) {
            outTime = new Date(outTime)
            outTime.setDate(outTime.getDate() + 1)
          }
        }
      }

      // Calculate minutes/hours from in/out time
      // PRIORITY: Use IN/OUT times if both are available
      if (inTime && outTime) {
        const diffMs = outTime.getTime() - inTime.getTime()
        if (diffMs > 0) {
          minutesWorked = Math.floor(diffMs / (1000 * 60))
          hoursWorked = parseFloat((minutesWorked / 60).toFixed(2))
        } else {
          // Invalid: OUT < IN (shouldn't happen after overnight check, but just in case)
          console.warn(`[PAYROLL IMPORT] Row ${index + 1}: OUT time is before IN time. Hours not calculated.`)
          minutesWorked = null
          hoursWorked = null
        }
      } else if (mapping.minutesWorked && row[mapping.minutesWorked] !== null && row[mapping.minutesWorked] !== undefined && row[mapping.minutesWorked] !== '') {
        const parsedMinutes = parseInt(String(row[mapping.minutesWorked]))
        if (!isNaN(parsedMinutes) && parsedMinutes >= 0) {
          minutesWorked = parsedMinutes
          hoursWorked = parseFloat((minutesWorked / 60).toFixed(2))
        }
      } else if (mapping.hoursWorked && row[mapping.hoursWorked] !== null && row[mapping.hoursWorked] !== undefined && row[mapping.hoursWorked] !== '') {
        const parsedHours = parseFloat(String(row[mapping.hoursWorked]))
        if (!isNaN(parsedHours) && parsedHours >= 0) {
          hoursWorked = parsedHours
          minutesWorked = Math.round(hoursWorked * 60)
        }
      }

      return {
        importId: payrollImport.id,
        rowIndex: index,
        employeeNameRaw: employeeNameRaw || null,
        employeeExternalIdRaw: employeeExternalIdRaw || null,
        workDate: workDate || new Date(), // Default to today if not parsed
        inTime: inTime || null,
        outTime: outTime || null,
        minutesWorked: minutesWorked || null,
        hoursWorked: hoursWorked !== null ? hoursWorked : null,
        linkedEmployeeId: null,
        rawJson: row as any,
      }
      })
    }

    // Log sample of parsed data for debugging
    if (rows.length > 0) {
      const sampleRow = rows[0]
      console.log(`[PAYROLL IMPORT] Sample parsed row:`, {
        employee: sampleRow.employeeNameRaw || sampleRow.employeeExternalIdRaw,
        workDate: sampleRow.workDate,
        inTime: sampleRow.inTime,
        outTime: sampleRow.outTime,
        hoursWorked: sampleRow.hoursWorked,
        minutesWorked: sampleRow.minutesWorked,
      })
    }

    // Create all import rows in a transaction
    // IMPORTANT: Import ALL rows, not just a subset
    await prisma.$transaction(
      rows.map(row => prisma.payrollImportRow.create({ data: row }))
    )

    console.log(`[PAYROLL IMPORT] Successfully imported ${rows.length} rows`)

    return NextResponse.json({
      success: true,
      importId: payrollImport.id,
      rowCount: rows.length,
      message: `Successfully imported ${rows.length} rows from file`,
    })
  } catch (error: any) {
    console.error('Error saving import:', error)
    return NextResponse.json(
      { error: 'Failed to save import', details: error.message },
      { status: 500 }
    )
  }
}
