import { normalizeCalendarPoint } from '../src/law/calendar.ts'
import type { CalendarPoint } from '../src/law/calendar.ts'

/** Proleptic Julian/Gregorian days since Gregorian 1970-01-01 (day zero).
 * March-based integer Julian day numbers share an epoch across both calendars.
 * This checker adapter is not the host's kernel calendar.
 */
export function toDay(point: CalendarPoint): number {
  const { year, month, day, calendar } = normalizeCalendarPoint(point)
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  const base = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4)
  const jdn = calendar === 'julian' ? base - 32083
    : base - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  const result = jdn - 2440588
  if (!Number.isSafeInteger(result)) throw new Error('calendar day exceeds safe integer range')
  return result
}
