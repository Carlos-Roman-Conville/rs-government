import { validatePredicate } from './predicate.ts'
import type { Predicate } from './predicate.ts'
import { normalizeCalendarPoint } from './calendar.ts'
import type { CalendarPoint } from './calendar.ts'

export type LawId = `government/law.${string}`
export type LawModality = 'prohibit' | 'require' | 'permit' | 'empower' | 'establish'
export type LawStatus = 'in-force' | 'suspended' | 'repealed'
export type SanctionKind = 'fine' | 'seizure' | 'detention' | 'corporal' | 'outlawry' | 'exile'
export interface Sanction { kind: SanctionKind; amount: number | null; note: string }
export type Consequence = { kind: 'void' } | { kind: 'sanctions'; sanctions: Sanction[]; note?: string }
export interface Citation { key: string; title: string; year: number | null; locator: string | null }
export interface LawException { condition: Predicate; reason: string }
export type TaxSchedule = { kind: 'fixed'; amount: number; unit: string }
  | { kind: 'rate'; rate: number }
  | { kind: 'proportional-with-remission'; rate: number; remitBelow: number }
export interface TaxRule { base: string; schedule: TaxSchedule; treasury: string; collector?: string }
export type SpendingSchedule = Extract<TaxSchedule, { kind: 'fixed' | 'rate' }>
export interface SpendRule { treasury: string; payee: string }
export interface SuccessionRule {
  rule: 'primogeniture' | 'appointment' | 'election' | 'open-contest'
  prefer?: 'male' | 'none'
  superior?: string
  body?: string
}
export interface LawJurisdiction {
  authority: string | null
  /** Bilateral jurisdiction; authority remains the law set's existing identifier. */
  authorities?: [string, string]
  places: 'all' | string[]
  persons: 'all' | Predicate
  from: number | null
  until: number | null
  note?: string
}
interface LawFields {
  id: LawId
  issuer: string | null
  enactment: string | null
  jurisdiction: LawJurisdiction
  condition: Predicate
  exceptions: LawException[]
  consequence: Consequence
  enforcer: string[]
  procedure: string | null
  status: LawStatus
  supersedes: LawId[]
  sources: Citation[]
  /** validateLaw restricts this to establish/succeed with an office predicate. */
  succession?: SuccessionRule
  /** validateLaw restricts tax obligations to require laws. */
  tax?: TaxRule
  /** Appropriation amount reuses tax.schedule shapes; valid only with spend. */
  schedule?: SpendingSchedule
  spend?: SpendRule
}
type LawRule = (
  | { modality: 'empower'; regulated: { action: string; object: 'any' | Predicate; power: string } }
  | { modality: Exclude<LawModality, 'empower'>; regulated: { action: string; object: 'any' | Predicate; power?: never } }
)
export type Law = LawFields & LawRule
export type LawData = Omit<LawFields, 'jurisdiction' | 'enactment'> & LawRule & {
  enactment?: string | null
  jurisdiction: Omit<LawJurisdiction, 'from' | 'until'> & { from: CalendarPoint | null; until: CalendarPoint | null }
}

const lawId = /^government\/law\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Return deterministic, field-addressed failures without interpreting descriptive text. */
export function validateLaw(value: unknown): string[] {
  return validate(value, false)
}

/** Non-null bounds are calendar points in data and numeric days at runtime. */
export function validateLawData(value: unknown): string[] {
  return validate(value, true)
}

function validate(value: unknown, calendarDates: boolean): string[] {
  const failures: string[] = []
  const fail = (path: string, rule: string) => { failures.push(`${path}: ${rule}`) }
  function object(value: unknown, path: string): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      fail(path, 'expected object'); return false
    }
    return true
  }
  function string(value: unknown, path: string): void {
    if (typeof value !== 'string' || !value.trim()) fail(path, 'expected non-empty string')
  }
  function number(value: unknown, path: string): void {
    if (!finite(value)) fail(path, 'expected finite number')
  }
  function id(value: unknown, path: string): void {
    if (typeof value !== 'string' || !lawId.test(value)) fail(path, 'expected government/law.<lowercase-kebab-slug>')
  }
  function oneOf(value: unknown, choices: string[], path: string): void {
    if (typeof value !== 'string' || !choices.includes(value)) fail(path, `expected ${choices.join('|')}`)
  }
  function array(value: unknown, path: string, visit: (item: unknown, path: string) => void): void {
    if (!Array.isArray(value)) fail(path, 'expected array')
    else value.forEach((item, i) => visit(item, `${path}[${i}]`))
  }
  const predicate = (value: unknown, path: string) => { failures.push(...validatePredicate(value, path)) }
  if (!object(value, 'law')) return failures
  id(value.id, 'id')
  if ('spend' in value) {
    if (value.modality !== 'require') fail('spend', 'allowed only for require')
    if (object(value.spend, 'spend')) {
      string(value.spend.treasury, 'spend.treasury')
      string(value.spend.payee, 'spend.payee')
      for (const key of Object.keys(value.spend)) {
        if (!['treasury', 'payee'].includes(key)) fail(`spend.${key}`, 'unknown field')
      }
    }
    if (object(value.schedule, 'schedule')) {
      const s = value.schedule
      oneOf(s.kind, ['fixed', 'rate'], 'schedule.kind')
      const field = s.kind === 'fixed' ? 'amount' : 'rate'
      if (!finite(s[field]) || s[field] < 0) fail(`schedule.${field}`, 'expected finite non-negative number')
      if (s.kind === 'fixed') string(s.unit, 'schedule.unit')
      for (const key of Object.keys(s)) {
        if (!['kind', field, ...(s.kind === 'fixed' ? ['unit'] : [])].includes(key)) fail(`schedule.${key}`, 'unknown field')
      }
    }
  } else if ('schedule' in value) fail('schedule', 'requires spend')
  if (value.issuer !== null) string(value.issuer, 'issuer')
  if (value.enactment !== null && !(calendarDates && !('enactment' in value))) string(value.enactment, 'enactment')
  oneOf(value.modality, ['prohibit', 'require', 'permit', 'empower', 'establish'], 'modality')
  if (object(value.jurisdiction, 'jurisdiction')) {
    const j = value.jurisdiction
    if (j.authority !== null) string(j.authority, 'jurisdiction.authority')
    if ('authorities' in j) {
      const enforcers = value.enforcer
      array(j.authorities, 'jurisdiction.authorities', string)
      if (!Array.isArray(j.authorities) || j.authorities.length !== 2
        || new Set(j.authorities).size !== 2) {
        fail('jurisdiction.authorities', 'expected two distinct authorities')
      } else if (Array.isArray(enforcers) && enforcers.length
        && (enforcers.length !== 2 || !j.authorities.every(party => enforcers.includes(party)))) {
        fail('enforcer', 'bilateral law requires both parties or no enforcer')
      }
    }
    if (j.places !== 'all') array(j.places, 'jurisdiction.places', string)
    if (j.persons !== 'all') predicate(j.persons, 'jurisdiction.persons')
    if (calendarDates) {
      for (const key of ['from', 'until']) {
        if (j[key] === null) continue
        try { normalizeCalendarPoint(j[key]) }
        catch (error) { fail(`jurisdiction.${key}`, (error as Error).message) }
      }
    } else {
      if (j.from !== null) number(j.from, 'jurisdiction.from')
      if (j.until !== null) number(j.until, 'jurisdiction.until')
      if (finite(j.from) && finite(j.until) && j.until < j.from) fail('jurisdiction.until', 'must be at least from')
    }
    if ('note' in j) string(j.note, 'jurisdiction.note')
  }
  if (object(value.regulated, 'regulated')) {
    string(value.regulated.action, 'regulated.action')
    if (value.regulated.object !== 'any') predicate(value.regulated.object, 'regulated.object')
    if (value.modality === 'empower') string(value.regulated.power, 'regulated.power')
    else if ('power' in value.regulated) fail('regulated.power', 'allowed only for empower')
    if (value.regulated.action === 'succeed' && value.modality === 'establish'
      && value.regulated.object === 'any') fail('regulated.object', 'succession requires an office predicate')
  }
  if ('succession' in value) {
    if (value.modality !== 'establish' || !value.regulated || typeof value.regulated !== 'object'
      || !('action' in value.regulated) || value.regulated.action !== 'succeed') {
      fail('succession', 'allowed only for establish with action succeed')
    }
    if (object(value.succession, 'succession')) {
      const s = value.succession
      oneOf(s.rule, ['primogeniture', 'appointment', 'election', 'open-contest'], 'succession.rule')
      if ('prefer' in s) oneOf(s.prefer, ['male', 'none'], 'succession.prefer')
      if ('superior' in s) string(s.superior, 'succession.superior')
      if ('body' in s) string(s.body, 'succession.body')
      for (const key of Object.keys(s)) {
        if (!['rule', 'prefer', 'superior', 'body'].includes(key)) fail(`succession.${key}`, 'unknown field')
      }
    }
  }
  if ('tax' in value) {
    if (value.modality !== 'require') fail('tax', 'allowed only for require')
    if (object(value.tax, 'tax')) {
      const tax = value.tax
      string(tax.base, 'tax.base')
      string(tax.treasury, 'tax.treasury')
      if ('collector' in tax) string(tax.collector, 'tax.collector')
      for (const key of Object.keys(tax)) {
        if (!['base', 'schedule', 'treasury', 'collector'].includes(key)) fail(`tax.${key}`, 'unknown field')
      }
      if (object(tax.schedule, 'tax.schedule')) {
        const schedule = tax.schedule
        oneOf(schedule.kind, ['fixed', 'rate', 'proportional-with-remission'], 'tax.schedule.kind')
        const fields = schedule.kind === 'fixed' ? ['amount']
          : schedule.kind === 'rate' ? ['rate'] : ['rate', 'remitBelow']
        for (const field of fields) {
          if (!finite(schedule[field]) || schedule[field] < 0) fail(`tax.schedule.${field}`, 'expected finite non-negative number')
        }
        if (schedule.kind === 'fixed') string(schedule.unit, 'tax.schedule.unit')
        const allowed = ['kind', ...fields, ...(schedule.kind === 'fixed' ? ['unit'] : [])]
        for (const key of Object.keys(schedule)) {
          if (!allowed.includes(key)) fail(`tax.schedule.${key}`, 'unknown field')
        }
      }
    }
  }
  predicate(value.condition, 'condition')
  array(value.exceptions, 'exceptions', (item, path) => {
    if (!object(item, path)) return
    predicate(item.condition, `${path}.condition`)
    string(item.reason, `${path}.reason`)
  })
  if (object(value.consequence, 'consequence')) {
    if ('note' in value.consequence) string(value.consequence.note, 'consequence.note')
    oneOf(value.consequence.kind, ['void', 'sanctions'], 'consequence.kind')
    if (value.consequence.kind === 'void' && 'sanctions' in value.consequence) fail('consequence.sanctions', 'allowed only for sanctions')
    if (value.consequence.kind === 'sanctions') array(value.consequence.sanctions, 'consequence.sanctions', (item, path) => {
      if (!object(item, path)) return
      oneOf(item.kind, ['fine', 'seizure', 'detention', 'corporal', 'outlawry', 'exile'], `${path}.kind`)
      if (item.amount !== null) number(item.amount, `${path}.amount`)
      string(item.note, `${path}.note`)
    })
  }
  array(value.enforcer, 'enforcer', string)
  if (value.procedure !== null) string(value.procedure, 'procedure')
  oneOf(value.status, ['in-force', 'suspended', 'repealed'], 'status')
  array(value.supersedes, 'supersedes', id)
  array(value.sources, 'sources', (item, path) => {
    if (!object(item, path)) return
    string(item.key, `${path}.key`)
    string(item.title, `${path}.title`)
    if (item.year !== null) number(item.year, `${path}.year`)
    if (item.locator !== null) string(item.locator, `${path}.locator`)
  })
  if (Array.isArray(value.sources) && !value.sources.length && value.issuer !== 'fixture') fail('sources', 'at least one citation required unless issuer is fixture')
  return failures.sort()
}
