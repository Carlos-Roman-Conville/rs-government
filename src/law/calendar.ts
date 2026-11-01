/** Source precision is retained in data; the host supplies the runtime epoch. */
export interface CalendarPoint {
  year: number
  month?: number
  day?: number
  calendar: 'julian' | 'gregorian'
}
export type ToDay = (point: Required<CalendarPoint>) => number

/** Missing month/day means the first day, including exclusive repeal bounds. */
export function normalizeCalendarPoint(value: unknown): Required<CalendarPoint> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected calendar point')
  const p = value as Record<string, unknown>
  if (typeof p.year !== 'number' || !Number.isSafeInteger(p.year)) throw new Error('year must be a safe integer')
  if (p.calendar !== 'julian' && p.calendar !== 'gregorian') throw new Error('calendar must be julian|gregorian')
  if ('day' in p && !('month' in p)) throw new Error('day requires month')
  const month = 'month' in p ? p.month : 1
  const day = 'day' in p ? p.day : 1
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('invalid month')
  const leap = p.year % 4 === 0 && (p.calendar === 'julian' || p.year % 100 !== 0 || p.year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > days) throw new Error('invalid day for month and calendar')
  return { year: p.year, month, day, calendar: p.calendar }
}
