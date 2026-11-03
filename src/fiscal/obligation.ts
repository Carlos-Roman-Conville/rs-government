import type { LawId } from '../law/schema.ts'
import type { TaxAssessment, TaxCollectionCommand } from './tax.ts'

type EntryFields = { readonly ref: string; readonly day: number }
/** Receipts and refunds are owner confirmations, never payment choices or reports. */
export type ObligationEntry = EntryFields & (
  | { readonly kind: 'receipt' | 'refund'; readonly amount: number }
  | { readonly kind: 'failed-transfer'; readonly reason: string }
  | { readonly kind: 'remission'; readonly amount: number; readonly law: LawId }
  | { readonly kind: 'correction'; readonly delta: number; readonly reason: string }
)
/** Identity is (law, payer, assessedOn), the assessment's (law, payer, day). */
export interface TaxObligation {
  readonly type: 'government.tax_obligation'
  readonly law: LawId
  readonly payer: string
  readonly unit: string
  readonly assessedOn: number
  readonly due: number
  readonly assessed: number
  /** Retained from the assessment to address collection envelopes to its owner. */
  readonly treasury: string
  readonly entries: readonly ObligationEntry[]
}
export interface ObligationStatus { remaining: number; outstanding: number; overpaid: number }
export interface CollectionRequest {
  readonly ref: string
  readonly amount: number
  readonly from: string
  readonly owner: 'settlement' | 'economy'
}
export interface TaxShortfall {
  law: LawId; payer: string; unit: string; day: number; outstanding: number; held: number | null
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** No law supplies a deadline yet: the host must supply the scenario's due day. */
export function openObligation(assessment: TaxAssessment, due: number): TaxObligation {
  if (assessment.owed === null) throw new Error('An unresolved assessment opens no obligation')
  if (!nonnegative(assessment.owed) || !nonempty(assessment.unit) || !nonempty(assessment.treasury)) {
    throw new Error('Invalid resolved tax assessment')
  }
  if (!Number.isFinite(assessment.day) || !Number.isFinite(due) || due < assessment.day) {
    throw new Error('Due day must be finite and at or after assessedOn')
  }
  return { type: 'government.tax_obligation', law: assessment.law, payer: assessment.payer,
    unit: assessment.unit, assessedOn: assessment.day, due, assessed: assessment.owed,
    treasury: assessment.treasury, entries: [] }
}

function validateEntry(entry: ObligationEntry): void {
  if (!nonempty(entry.ref) || !Number.isFinite(entry.day)) throw new Error('Invalid entry ref or day')
  switch (entry.kind) {
    case 'receipt': case 'refund': case 'remission':
      if (!nonnegative(entry.amount)) throw new Error('Entry amount must be finite and non-negative')
      if (entry.kind === 'remission' && !nonempty(entry.law)) throw new Error('Remission requires a law')
      break
    case 'correction':
      if (!Number.isFinite(entry.delta)) throw new Error('Correction delta must be finite')
      if (!nonempty(entry.reason)) throw new Error('Correction requires a reason')
      break
    case 'failed-transfer':
      if (!nonempty(entry.reason)) throw new Error('Failed transfer requires a reason')
      break
    default: throw new Error('Unknown obligation entry kind')
  }
}

/** Append a copied entry; replay is independent of object property order. */
export function applyEntry(obligation: TaxObligation, entry: ObligationEntry): TaxObligation {
  validateEntry(entry)
  const previous = obligation.entries.find(row => row.ref === entry.ref)
  if (previous) {
    const keys = Object.keys(previous) as (keyof ObligationEntry)[]
    if (keys.length !== Object.keys(entry).length || keys.some(key => previous[key] !== entry[key])) {
      throw new Error(`Conflicting obligation entry ref: ${entry.ref}`)
    }
    return obligation
  }
  const next = { ...obligation, entries: [...obligation.entries, { ...entry }] }
  obligationStatus(next)
  return next
}

/** Recompute in ref order for deterministic sums regardless of append order.
 * Refunds cannot exceed receipts; corrections and remission never clamp the record.
 */
export function obligationStatus(obligation: TaxObligation): ObligationStatus {
  let corrections = 0, remitted = 0, received = 0, refunded = 0
  const entries = [...obligation.entries].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)
  for (const entry of entries) {
    switch (entry.kind) {
      case 'correction': corrections += entry.delta; break
      case 'remission': remitted += entry.amount; break
      case 'receipt': received += entry.amount; break
      case 'refund': refunded += entry.amount; break
      case 'failed-transfer': break
    }
  }
  if (refunded > received) throw new Error('Refund exceeds confirmed paid total')
  const remaining = (obligation.assessed + corrections) - remitted - (received - refunded)
  if (![corrections, remitted, received, refunded, remaining].every(Number.isFinite)) {
    throw new Error('Obligation total must be finite')
  }
  return { remaining, outstanding: Math.max(0, remaining), overpaid: Math.max(0, -remaining) }
}

function validateRequest(request: CollectionRequest): void {
  if (!nonempty(request.ref) || !nonempty(request.from) || !nonnegative(request.amount)
    || !['settlement', 'economy'].includes(request.owner)) throw new Error('Invalid collection request')
}

/** Pending requests belong to this obligation and are maintained by the host.
 * Issuing an envelope records no receipt. The host removes a request on confirmation or failure.
 */
export function requestCollection(obligation: TaxObligation, pending: readonly CollectionRequest[],
  request: CollectionRequest): TaxCollectionCommand | null {
  validateRequest(request)
  const refs = new Set<string>()
  let reserved = 0
  for (const row of [...pending].sort((a, b) => a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)) {
    validateRequest(row)
    if (refs.has(row.ref)) throw new Error(`Duplicate pending collection ref: ${row.ref}`)
    refs.add(row.ref)
    reserved += row.amount
  }
  if (refs.has(request.ref)) return null
  if (request.amount > obligationStatus(obligation).outstanding - reserved) {
    throw new Error('Collection exceeds outstanding less pending amounts')
  }
  if (request.amount === 0) return null
  const details = { law: obligation.law, payer: obligation.payer, day: obligation.assessedOn,
    from: request.from, to: obligation.treasury, amount: request.amount, unit: obligation.unit }
  return request.owner === 'settlement' ? { ...details, owner: 'settlement', type: 'pay' }
    : { ...details, owner: 'economy', type: 'transfer' }
}

/** An observable amount owed and owner holding read, with no inference about intent. */
export function shortfall(obligation: TaxObligation, day: number, held: number | null): TaxShortfall | null {
  if (!Number.isFinite(day) || (held !== null && !nonnegative(held))) throw new Error('Invalid shortfall day or holding')
  const { outstanding } = obligationStatus(obligation)
  return day >= obligation.due && outstanding > 0
    ? { law: obligation.law, payer: obligation.payer, unit: obligation.unit, day, outstanding, held }
    : null
}
