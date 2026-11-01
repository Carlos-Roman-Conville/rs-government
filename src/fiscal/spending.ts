import { evaluateAct } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { validateLaw } from '../law/schema.ts'
import type { Law, LawId } from '../law/schema.ts'
import type { Breach } from '../law/violation.ts'
import type { TaxBase } from './tax.ts'

/** Read-only owner snapshot; the host identifies the obligated institution and place. */
export interface TreasuryBalance extends TaxBase {
  institution: string
  place: string
  facts: ActFacts
}
export type BalanceReader = (treasury: string, day: number) => TreasuryBalance
export type ReceiptsReader = (treasury: string, day: number) => TaxBase
export interface Appropriation {
  type: 'government.appropriation'
  law: LawId
  treasury: string
  payee: string
  due: number
  /** Amount allocated to a command, not a confirmed ledger payment. */
  paid: number
  unfunded: number
  unit: string
}
export interface SpendingCommand {
  owner: 'settlement'
  type: 'pay'
  law: LawId
  from: string
  to: string
  amount: number
  unit: string
}
export interface AppropriationsResult {
  records: Appropriation[]
  commands: SpendingCommand[]
  breaches: Breach[]
}

function checkAmount(value: TaxBase): void {
  if (!value || !Number.isFinite(value.amount) || value.amount < 0 || !value.unit?.trim()) {
    throw new Error('Expected a known non-negative amount and unit')
  }
}

/** DESIGN §1.10: allocate within the balance in enactment order, supplied by the
 * host as laws array order (enactment IDs are opaque, not dates). Each treasury
 * shares one local remaining balance. No owner state is written; hosts execute
 * commands and must avoid replaying the same appropriation period.
 */
export function appropriations(laws: readonly Law[], day: number,
  balance: BalanceReader, receipts: ReceiptsReader): AppropriationsResult {
  if (!Number.isFinite(day)) throw new Error('Spending day must be finite')
  if (new Set(laws.map(law => law.id)).size !== laws.length) throw new Error('Duplicate law')
  const result: AppropriationsResult = { records: [], commands: [], breaches: [] }
  const accounts = new Map<string, { snapshot: TreasuryBalance; remaining: number }>()
  const received = new Map<string, TaxBase>()
  for (const law of laws) {
    if (!law.spend) continue
    const errors = validateLaw(law)
    if (errors.length) throw new Error(errors.join('; '))
    const { treasury, payee } = law.spend
    let account = accounts.get(treasury)
    if (!account) {
      const snapshot = balance(treasury, day)
      checkAmount(snapshot)
      if (!snapshot.institution?.trim() || !snapshot.place?.trim()) throw new Error('Missing treasury context')
      account = { snapshot, remaining: snapshot.amount }
      accounts.set(treasury, account)
    }
    const act: Act = { actor: account.snapshot.institution, object: treasury,
      place: account.snapshot.place, day, action: `omit:${law.regulated.action}`,
      attempted: false, succeeded: false }
    // The existing evaluator owns applicability, supersession and breach semantics.
    const breaches = evaluateAct(laws, act, account.snapshot.facts).filter(breach => breach.law === law.id)
    if (!breaches.length) continue
    const schedule = law.schedule!
    let due: number
    if (schedule.kind === 'fixed') {
      if (schedule.unit !== account.snapshot.unit) throw new Error('Appropriation unit mismatch')
      due = schedule.amount
    } else {
      let base = received.get(treasury)
      if (!base) {
        base = receipts(treasury, day)
        checkAmount(base)
        received.set(treasury, base)
      }
      if (base.unit !== account.snapshot.unit) throw new Error('Receipts unit mismatch')
      due = base.amount * schedule.rate
    }
    if (!Number.isFinite(due)) throw new Error('Invalid appropriation amount')
    const paid = Math.min(due, account.remaining), unfunded = due - paid
    account.remaining -= paid
    result.records.push({ type: 'government.appropriation', law: law.id, treasury, payee,
      due, paid, unfunded, unit: account.snapshot.unit })
    if (paid > 0) result.commands.push({ owner: 'settlement', type: 'pay', law: law.id,
      from: treasury, to: payee, amount: paid, unit: account.snapshot.unit })
    if (unfunded > 0) result.breaches.push(...breaches)
  }
  return result
}
