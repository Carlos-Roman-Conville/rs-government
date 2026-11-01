import { applicableLaws, evaluateAct } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { evaluatePredicate } from '../law/predicate.ts'
import type { Law, LawId } from '../law/schema.ts'
import type { Breach } from '../law/violation.ts'

/** The host supplies the taxable subject and its location, without owner writes. */
export interface TaxPayer { id: string; place: string; object: string | null }
export interface TaxBase { amount: number; unit: string }
export interface TaxAssessment {
  type: 'government.tax_assessment'
  law: LawId
  payer: string
  base: number | null
  baseRead: string
  owed: number | null
  unit: string | null
  day: number
  reason: string | null
  treasury: string
  collector: string | null
  act: Act
}
interface AssessmentReference { law: LawId; payer: string; day: number }
/** One host choice per assessment; owner and source account are never inferred. */
export interface TaxPayment extends AssessmentReference {
  amount: number
  unit: string
  owner: 'settlement' | 'economy'
  from: string
}
/** Confirmed total received at the deadline. Zero is explicit non-payment;
 * null or an absent outcome is unknown, never evidence of a breach.
 */
export interface TaxPaymentOutcome extends AssessmentReference { paid: number | null; unit: string }
export type TaxCollectionCommand = AssessmentReference & {
  from: string; to: string; amount: number; unit: string
} & ({ owner: 'settlement'; type: 'pay' } | { owner: 'economy'; type: 'transfer' })

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const key = (row: AssessmentReference) => JSON.stringify([row.law, row.payer, row.day])
const ordered = (a: AssessmentReference, b: AssessmentReference) =>
  compare(a.law, b.law) || compare(a.payer, b.payer) || a.day - b.day
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

/** Pure assessment phase. Base ports return {amount, unit}, null or undefined.
 * Fixed amounts still need a known base. Remission is strictly below remitBelow;
 * at the threshold the full base is taxed. No rounding or currency is invented.
 * Predicate failures retain the evaluator's fail-fast semantics.
 */
export function assess(laws: readonly Law[], day: number, payers: readonly TaxPayer[], facts: ActFacts): TaxAssessment[] {
  if (!Number.isFinite(day)) throw new Error('Tax day must be finite')
  if (new Set(payers.map(payer => payer.id)).size !== payers.length) throw new Error('Duplicate tax payer')
  const assessments: TaxAssessment[] = []
  for (const payer of [...payers].sort((a, b) => compare(a.id, b.id))) {
    for (const law of [...laws].sort((a, b) => compare(a.id, b.id))) {
      if (law.modality !== 'require' || !law.tax) continue
      const act: Act = { actor: payer.id, object: payer.object, place: payer.place,
        action: law.regulated.action, day, attempted: false, succeeded: false }
      const read = (name: string) => facts(name, act)
      if (![...applicableLaws(laws, act, facts).values()].flat().includes(law)
        || (law.regulated.object !== 'any' && !evaluatePredicate(law.regulated.object, read))
        || !evaluatePredicate(law.condition, read)
        || law.exceptions.some(exception => evaluatePredicate(exception.condition, read))) continue
      const { base: baseRead, schedule, treasury, collector } = law.tax
      const row: TaxAssessment = { type: 'government.tax_assessment', law: law.id, payer: payer.id,
        baseRead, base: null, owed: null, unit: schedule.kind === 'fixed' ? schedule.unit : null,
        day, reason: null, treasury, collector: collector ?? null, act }
      let value: unknown
      try { value = read(baseRead) }
      catch (error) {
        row.reason = `base read ${baseRead} failed: ${error instanceof Error ? error.message : String(error)}`
      }
      if (!row.reason) {
        if (value == null) row.reason = `missing base read: ${baseRead}`
        else if (typeof value !== 'object' || !('amount' in value) || !nonnegative(value.amount)
          || !('unit' in value) || !nonempty(value.unit)) row.reason = `invalid base read: ${baseRead}; expected {amount, unit}`
        else {
          row.base = value.amount
          row.unit = schedule.kind === 'fixed' ? schedule.unit : value.unit
          const owed = schedule.kind === 'fixed' ? schedule.amount
            : schedule.kind === 'proportional-with-remission' && value.amount < schedule.remitBelow
              ? 0 : value.amount * schedule.rate
          if (nonnegative(owed)) row.owed = owed
          else row.reason = `invalid assessment amount: ${baseRead}`
        }
      }
      assessments.push(row)
    }
  }
  return assessments.sort(ordered)
}

function index(assessments: readonly TaxAssessment[]): Map<string, TaxAssessment> {
  const result = new Map(assessments.map(row => [key(row), row]))
  if (result.size !== assessments.length) throw new Error('Duplicate tax assessment')
  return result
}

function match(rows: readonly AssessmentReference[], assessments: readonly TaxAssessment[]): TaxAssessment[] {
  const byKey = index(assessments), seen = new Set<string>()
  return rows.map(row => {
    const id = key(row), assessment = byKey.get(id)
    if (seen.has(id)) throw new Error(`Duplicate tax payment: ${id}`)
    seen.add(id)
    if (!assessment) throw new Error(`Unknown tax assessment: ${id}`)
    return assessment
  })
}

/** Commands are host-adapted owner envelopes, not executed ledger operations.
 * A choice is not a receipt: only confirmed outcomes go to taxBreaches.
 */
export function collectionCommands(assessments: readonly TaxAssessment[], payments: readonly TaxPayment[]): TaxCollectionCommand[] {
  const matched = match(payments, assessments)
  return payments.flatMap((payment, i): TaxCollectionCommand[] => {
    const assessment = matched[i]
    if (!nonnegative(payment.amount) || !nonempty(payment.from)
      || !['settlement', 'economy'].includes(payment.owner)) throw new Error('Invalid tax payment choice')
    if (assessment.owed === null || assessment.unit !== payment.unit) throw new Error('Unresolved assessment or tax payment unit mismatch')
    if (payment.amount > assessment.owed) throw new Error('Tax payment exceeds assessment')
    if (payment.amount === 0) return []
    const details = { law: payment.law, payer: payment.payer, day: payment.day,
      from: payment.from, to: assessment.treasury, amount: payment.amount, unit: payment.unit }
    return [payment.owner === 'settlement' ? { ...details, owner: 'settlement', type: 'pay' }
      : { ...details, owner: 'economy', type: 'transfer' }]
  }).sort(ordered)
}

/** Adapt confirmed shortfalls into ordinary omission acts. evaluateAct remains
 * the sole breach producer; keep the full law set for supersession, then select
 * this obligation so a paid rival tax cannot be breached by another's shortfall.
 */
export function taxBreaches(laws: readonly Law[], assessments: readonly TaxAssessment[],
  outcomes: readonly TaxPaymentOutcome[], facts: ActFacts): Breach[] {
  const matched = match(outcomes, assessments)
  return outcomes.flatMap((outcome, i) => {
    const row = matched[i]
    if (outcome.paid === null) return []
    if (!nonnegative(outcome.paid)) throw new Error('Invalid confirmed tax payment')
    if (row.owed === null) return []
    if (outcome.unit !== row.unit) throw new Error('Confirmed tax payment unit mismatch')
    if (outcome.paid >= row.owed) return []
    return evaluateAct(laws, { ...row.act, action: `omit:${row.act.action}`, attempted: false, succeeded: false }, facts)
      .filter(breach => breach.law === row.law)
  }).sort((a, b) => compare(a.law, b.law) || compare(a.act.actor, b.act.actor) || a.act.day - b.act.day)
}
