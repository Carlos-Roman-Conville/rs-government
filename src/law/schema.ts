import { validatePredicate } from './predicate.ts'
import type { Predicate } from './predicate.ts'

export type LawId = `government/law.${string}`
export type LawModality = 'prohibit' | 'require' | 'permit' | 'empower' | 'establish'
export type LawStatus = 'in-force' | 'suspended' | 'repealed'
export type SanctionKind = 'fine' | 'seizure' | 'detention' | 'corporal' | 'outlawry' | 'exile'
export interface Sanction { kind: SanctionKind; amount: number | null; note: string }
export type Consequence = { kind: 'void' } | { kind: 'sanctions'; sanctions: Sanction[] }
export interface Citation { key: string; title: string; year: number | null; locator: string | null }
export interface LawException { condition: Predicate; reason: string }
export interface LawJurisdiction {
  authority: string
  places: 'all' | string[]
  persons: 'all' | Predicate
  from: number
  until: number | null
}
interface LawFields {
  id: LawId
  issuer: string
  enactment: string
  jurisdiction: LawJurisdiction
  condition: Predicate
  exceptions: LawException[]
  consequence: Consequence
  enforcer: string[]
  procedure: string | null
  status: LawStatus
  supersedes: LawId[]
  sources: Citation[]
}
export type Law = LawFields & (
  | { modality: 'empower'; regulated: { action: string; object: 'any' | Predicate; power: string } }
  | { modality: Exclude<LawModality, 'empower'>; regulated: { action: string; object: 'any' | Predicate; power?: never } }
)

const lawId = /^government\/law\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Return deterministic, field-addressed failures without interpreting descriptive text. */
export function validateLaw(value: unknown): string[] {
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
  string(value.issuer, 'issuer')
  string(value.enactment, 'enactment')
  oneOf(value.modality, ['prohibit', 'require', 'permit', 'empower', 'establish'], 'modality')
  if (object(value.jurisdiction, 'jurisdiction')) {
    const j = value.jurisdiction
    string(j.authority, 'jurisdiction.authority')
    if (j.places !== 'all') array(j.places, 'jurisdiction.places', string)
    if (j.persons !== 'all') predicate(j.persons, 'jurisdiction.persons')
    number(j.from, 'jurisdiction.from')
    if (j.until !== null) number(j.until, 'jurisdiction.until')
    if (finite(j.from) && finite(j.until) && j.until < j.from) fail('jurisdiction.until', 'must be at least from')
  }
  if (object(value.regulated, 'regulated')) {
    string(value.regulated.action, 'regulated.action')
    if (value.regulated.object !== 'any') predicate(value.regulated.object, 'regulated.object')
    if (value.modality === 'empower') string(value.regulated.power, 'regulated.power')
    else if ('power' in value.regulated) fail('regulated.power', 'allowed only for empower')
  }
  predicate(value.condition, 'condition')
  array(value.exceptions, 'exceptions', (item, path) => {
    if (!object(item, path)) return
    predicate(item.condition, `${path}.condition`)
    string(item.reason, `${path}.reason`)
  })
  if (object(value.consequence, 'consequence')) {
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
