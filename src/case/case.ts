import type { Law, LawId, Sanction } from '../law/schema.ts'
import type { ProcedureId } from '../law/procedure.ts'

/** What someone wrote or said, preserved independently of any finding. */
export interface Report {
  id: string
  /** Non-empty, sorted authors; no jury-size rule is inferred here. */
  by: string[]
  to: string
  day: number
  form: 'presentment' | 'plaint' | 'testimony' | 'account' | 'announcement'
  claim: { accused: string | null; action: string; object: string | null; day: number | null; law: LawId | null }
  quantity: { amount: number; unit: string } | null
}
export interface Evidence {
  id: string
  kind: 'report' | 'denial' | 'oath'
  ref: string | null
  by: string
  supports: string | null
  holder: string
  day: number
}
/** The scenario declares the sourced procedure and its parameters; no defaults. */
export type DecisionRule =
  | { kind: 'presentment'; procedure: ProcedureId; touchesFreehold: boolean | null }
  | { kind: 'wager-of-law'; procedure: ProcedureId; oathHelpersRequired: number | null }
export interface Case {
  id: string
  procedure: ProcedureId
  rule: DecisionRule
  charge: Report['claim']
  /** ID of the initiating report, which is not automatically presented evidence. */
  initiatedBy: string
  presented: Evidence[]
  finding: Finding | null
}
export interface Finding {
  case: string
  day: number
  outcome: 'liable' | 'not-liable' | 'unresolved'
  reason: string
  basis: string[]
}
export interface Order {
  type: 'government.order'
  id: string
  case: string
  law: LawId
  against: string | null
  day: number
  sanctions: Sanction[]
}

function validateReport(report: Report): void {
  if (!report.by.length || report.by.some((author, i) => !author.trim()
    || (i > 0 && report.by[i - 1] > author))) {
    throw new Error('Report authors must be non-empty and sorted')
  }
}

export function openCase(id: string, initiating: Report, charge: Report['claim'], rule: DecisionRule): Case {
  if (!initiating || !['presentment', 'plaint'].includes(initiating.form)) {
    throw new Error('A case requires an initiating presentment or plaint')
  }
  validateReport(initiating)
  if (!id.trim() || !initiating.id.trim()) throw new Error('Case and initiating report ids must be non-empty')
  if (rule.kind === 'wager-of-law' && rule.oathHelpersRequired !== null
    && (!Number.isSafeInteger(rule.oathHelpersRequired) || rule.oathHelpersRequired < 0)) {
    throw new Error('Number of oath-helpers must be a non-negative integer or null')
  }
  return { id, procedure: rule.procedure, rule: { ...rule }, charge: { ...charge },
    initiatedBy: initiating.id, presented: [], finding: null }
}

function copy(caseRecord: Case): Case {
  return { ...caseRecord, rule: { ...caseRecord.rule }, charge: { ...caseRecord.charge },
    presented: caseRecord.presented.map(item => ({ ...item })),
    finding: caseRecord.finding && { ...caseRecord.finding, basis: [...caseRecord.finding.basis] } }
}

export function present(caseRecord: Case, evidence: Evidence): Case {
  if (caseRecord.finding) throw new Error('Cannot present evidence after a finding')
  if (caseRecord.presented.some(item => item.id === evidence.id)) throw new Error('Duplicate evidence id')
  const next = copy(caseRecord)
  next.presented.push({ ...evidence })
  next.presented.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return next
}

function matches(claim: Report['claim'], charge: Report['claim']): boolean {
  return claim.accused === charge.accused && claim.action === charge.action
    && claim.object === charge.object && claim.law === charge.law
}

/** Resolves only presented report references. Unpresented records supply no proof.
 * Sources: the two manorial procedure records' proof fields (Maitland, Select Pleas).
 */
export function find(caseRecord: Case, day: number, reports: readonly Report[]): Case {
  if (caseRecord.finding) throw new Error('A finding is written only once')
  const rule = caseRecord.rule
  const form = rule.kind === 'presentment' ? 'presentment' : 'plaint'
  const proof = caseRecord.presented.filter(item => {
    if (item.kind !== 'report' || item.ref === null) return false
    const resolved = reports.filter(report => report.id === item.ref)
    if (resolved.length > 1) throw new Error(`Duplicate report id: ${item.ref}`)
    const report = resolved[0]
    if (!report) return false
    validateReport(report)
    return report.form === form && matches(report.claim, caseRecord.charge)
  })
  const conclude = (outcome: Finding['outcome'], reason: string, basis: Evidence[]): Case => ({
    ...copy(caseRecord), finding: { case: caseRecord.id, day, outcome, reason,
      basis: basis.map(item => item.id).sort() },
  })
  if (rule.kind === 'presentment') {
    if (!proof.length) return conclude('unresolved', 'no presentment presented', [])
    if (rule.touchesFreehold === null) return conclude('unresolved', 'freehold not stated', proof)
    if (rule.touchesFreehold) return conclude('unresolved',
      'presentment touching freehold is traversable; traverse not modelled', proof)
    return conclude('liable', 'presentment untraversable', proof)
  }
  const denials = caseRecord.presented.filter(item => item.kind === 'denial' && item.by === caseRecord.charge.accused)
  const prerequisites = [...proof, ...denials]
  const missing = [!proof.length && 'no plaint presented', !denials.length && 'no denial by accused presented'].filter(Boolean)
  if (missing.length) return conclude('unresolved', missing.join('; '), prerequisites)
  if (rule.oathHelpersRequired === null) {
    return conclude('unresolved', 'number of oath-helpers not stated', prerequisites)
  }
  const oaths = caseRecord.presented.filter(item => item.kind === 'oath'
    && caseRecord.charge.accused !== null && item.supports === caseRecord.charge.accused
    && item.by !== caseRecord.charge.accused)
  const basis = [...prerequisites, ...oaths]
  return new Set(oaths.map(item => item.by)).size >= rule.oathHelpersRequired
    ? conclude('not-liable', 'law made', basis)
    : conclude('unresolved', 'law not made; consequence not stated in the procedure record', basis)
}

/** An order prescribes sanctions; execution belongs to the host's later records. */
export function issueOrder(id: string, finding: Finding, caseRecord: Case, law: Law, day: number): Order {
  if (finding.outcome !== 'liable') throw new Error('Only a liable finding permits an order')
  const recorded = caseRecord.finding
  if (finding.case !== caseRecord.id || !recorded || recorded.outcome !== finding.outcome
    || recorded.day !== finding.day || recorded.reason !== finding.reason
    || recorded.basis.length !== finding.basis.length
    || recorded.basis.some((ref, i) => ref !== finding.basis[i])) {
    throw new Error('Finding does not match the case finding')
  }
  if (law.id !== caseRecord.charge.law) throw new Error('Law does not match the charge')
  return { type: 'government.order', id, case: caseRecord.id, law: law.id,
    against: caseRecord.charge.accused, day,
    sanctions: law.consequence.kind === 'sanctions' ? law.consequence.sanctions.map(item => ({ ...item })) : [] }
}
