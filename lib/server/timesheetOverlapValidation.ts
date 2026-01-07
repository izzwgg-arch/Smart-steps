import { prisma } from '@/lib/prisma'

export type TimesheetEntryType = 'DR' | 'SV' | 'UNKNOWN'
export type OverlapScope = 'provider' | 'client' | 'both' | 'internal'

export interface IncomingTimesheetEntry {
  date: string // ISO string
  startTime: string // HH:mm (24h)
  endTime: string // HH:mm (24h)
  notes?: string | null // DR | SV | null
}

export interface OverlapConflict {
  code: 'OVERLAP_CONFLICT'
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  entryType: TimesheetEntryType
  scope: OverlapScope
  provider: { id: string; name: string }
  client: { id: string; name: string }
  conflicting?: {
    timesheetId: string
    entryId: string
    startTime: string
    endTime: string
    entryType: TimesheetEntryType
  }
  message: string
}

function parseHHMMToMinutes(hhmm: string): number | null {
  if (!hhmm) return null
  const match = hhmm.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function normalizeDateStr(dateIso: string): string {
  // Always compare by UTC date portion (stored dates use ISO in this app)
  return new Date(dateIso).toISOString().slice(0, 10)
}

function toEntryType(notes?: string | null): TimesheetEntryType {
  if (notes === 'DR') return 'DR'
  if (notes === 'SV') return 'SV'
  return 'UNKNOWN'
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  // Overlap: startA < endB AND startB < endA (end == start is allowed)
  return startA < endB && startB < endA
}

export async function detectTimesheetOverlaps(params: {
  providerId: string
  clientId: string
  providerName: string
  clientName: string
  entries: IncomingTimesheetEntry[]
  excludeTimesheetId?: string
}): Promise<OverlapConflict[]> {
  const { providerId, clientId, providerName, clientName, entries, excludeTimesheetId } = params

  // Build normalized entries with minutes
  const normalized = entries
    .map((e) => {
      const date = normalizeDateStr(e.date)
      const startMinutes = parseHHMMToMinutes(e.startTime)
      const endMinutes = parseHHMMToMinutes(e.endTime)
      return {
        raw: e,
        date,
        startMinutes,
        endMinutes,
        entryType: toEntryType(e.notes),
      }
    })
    .filter((e) => e.startMinutes !== null && e.endMinutes !== null) as Array<{
    raw: IncomingTimesheetEntry
    date: string
    startMinutes: number
    endMinutes: number
    entryType: TimesheetEntryType
  }>

  const conflicts: OverlapConflict[] = []

  // Internal overlap check (within incoming payload)
  const byDate = new Map<string, typeof normalized>()
  for (const e of normalized) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }

  for (const [date, list] of byDate.entries()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (rangesOverlap(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) {
          conflicts.push({
            code: 'OVERLAP_CONFLICT',
            date,
            startTime: a.raw.startTime,
            endTime: a.raw.endTime,
            entryType: a.entryType,
            scope: 'internal',
            provider: { id: providerId, name: providerName },
            client: { id: clientId, name: clientName },
            message: `Overlap detected on ${date}: ${a.entryType} ${a.raw.startTime}–${a.raw.endTime} overlaps with ${b.entryType} ${b.raw.startTime}–${b.raw.endTime} in this timesheet.`,
          })
        }
      }
    }
  }

  const uniqueDates = Array.from(new Set(normalized.map((e) => e.date)))
  if (uniqueDates.length === 0) return conflicts

  // Fetch existing entries on those dates for:
  // - same provider OR same client (as required), excluding deleted timesheets and (optionally) current timesheet
  const dateOr = uniqueDates.map((date) => ({
    date: {
      gte: new Date(`${date}T00:00:00.000Z`),
      lte: new Date(`${date}T23:59:59.999Z`),
    },
  }))

  const existing = await prisma.timesheetEntry.findMany({
    where: {
      OR: dateOr,
      timesheet: {
        deletedAt: null,
        ...(excludeTimesheetId ? { id: { not: excludeTimesheetId } } : {}),
        OR: [{ providerId }, { clientId }],
      },
    },
    include: {
      timesheet: {
        select: {
          id: true,
          providerId: true,
          clientId: true,
          provider: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  })

  // Compare each incoming entry to each existing entry on the same date
  for (const inc of normalized) {
    for (const ex of existing) {
      const exDate = ex.date.toISOString().slice(0, 10)
      if (exDate !== inc.date) continue

      const exStart = parseHHMMToMinutes(ex.startTime)
      const exEnd = parseHHMMToMinutes(ex.endTime)
      if (exStart === null || exEnd === null) continue

      if (!rangesOverlap(inc.startMinutes, inc.endMinutes, exStart, exEnd)) continue

      const providerMatch = ex.timesheet.providerId === providerId
      const clientMatch = ex.timesheet.clientId === clientId
      const scope: OverlapScope = providerMatch && clientMatch ? 'both' : providerMatch ? 'provider' : 'client'

      const exType = toEntryType(ex.notes)
      const providerLabel = ex.timesheet.provider?.name || providerName
      const clientLabel = ex.timesheet.client?.name || clientName

      conflicts.push({
        code: 'OVERLAP_CONFLICT',
        date: inc.date,
        startTime: inc.raw.startTime,
        endTime: inc.raw.endTime,
        entryType: inc.entryType,
        scope,
        provider: { id: providerId, name: providerName },
        client: { id: clientId, name: clientName },
        conflicting: {
          timesheetId: ex.timesheet.id,
          entryId: ex.id,
          startTime: ex.startTime,
          endTime: ex.endTime,
          entryType: exType,
        },
        message:
          scope === 'both'
            ? `Overlap detected on ${inc.date}: ${inc.entryType} ${inc.raw.startTime}–${inc.raw.endTime} overlaps with existing ${exType} ${ex.startTime}–${ex.endTime} for Provider ${providerLabel} and Client ${clientLabel}.`
            : scope === 'provider'
              ? `Overlap detected on ${inc.date}: Provider ${providerLabel} already scheduled ${ex.startTime}–${ex.endTime}.`
              : `Overlap detected on ${inc.date}: Client ${clientLabel} already scheduled ${ex.startTime}–${ex.endTime}.`,
      })
    }
  }

  return conflicts
}

