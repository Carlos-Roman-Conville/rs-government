import { evaluatePredicate, validatePredicate } from '../law/predicate.ts'
import type { Predicate } from '../law/predicate.ts'

/** Inclusive minimum; fractions are in [0, 1], counts are nonnegative. */
export type ChoiceMinimum = { fraction: number } | { count: number }
export interface CollectiveProcedure {
  id: string
  eligible: Predicate
  /** Omitted means one vote each; a supplied map must cover every eligible member. */
  weights?: Readonly<Record<string, number>>
  quorum: ChoiceMinimum
  threshold: ChoiceMinimum
  tie: 'fails' | 'chair' | null
}
export interface Ballot { member: string; vote: boolean | null }
export interface ChoiceFacts {
  read: (name: string, member: string) => unknown
  /** Host-supplied casting choice, used only for a tie; never inferred. */
  chairVote?: boolean | null
}
export interface CollectiveDecision {
  kind: 'body'
  quorate: boolean
  adopted: boolean
  unresolved: 'tie' | 'chair-choice-missing' | null
  tally: {
    eligible: number
    present: number
    yes: number
    no: number
    abstain: number
    ignored: string[]
  }
}

function minimum(rule: ChoiceMinimum, total: number): number {
  const fraction = 'fraction' in rule
  const value = fraction ? rule.fraction : rule.count
  if (Object.keys(rule).length !== 1 || !Number.isFinite(value) || value < 0
    || (fraction && value > 1)) throw new Error('Invalid choice minimum')
  return fraction ? value * total : value
}

/** Quorum counts people submitting ballots (including null abstentions), out of
 * eligible people. Threshold counts weighted yes votes, out of weighted yes + no.
 * Minima are inclusive: half with tie=fails is simple majority. A chair resolves
 * equal positive yes/no tallies without adding weight or bypassing the threshold.
 * Empty/abstention-only votes never adopt. Duplicate members/ballots are errors.
 * Sorting before summation makes the result independent of input order.
 */
export function decide(procedure: CollectiveProcedure, members: readonly string[],
  ballots: readonly Ballot[], facts: ChoiceFacts): CollectiveDecision {
  if (!procedure.id.trim()) throw new Error('Procedure id must be non-empty')
  if (![null, 'fails', 'chair'].includes(procedure.tie)) throw new Error('Invalid tie rule')
  const errors = validatePredicate(procedure.eligible)
  if (errors.length) throw new Error(errors.join('\n'))
  minimum(procedure.quorum, 0)
  minimum(procedure.threshold, 0)
  if (new Set(members).size !== members.length) throw new Error('Duplicate member')
  const eligible = new Set([...members].sort().filter(member =>
    evaluatePredicate(procedure.eligible, name => facts.read(name, member))))
  const weights = new Map<string, number>()
  for (const member of eligible) {
    const weight = procedure.weights === undefined ? 1
      : Object.hasOwn(procedure.weights, member) ? procedure.weights[member] : undefined
    if (weight === undefined || !Number.isFinite(weight) || weight < 0) {
      throw new Error(`Missing or invalid weight: ${member}`)
    }
    weights.set(member, weight)
  }
  const tally: CollectiveDecision['tally'] = {
    eligible: eligible.size, present: 0, yes: 0, no: 0, abstain: 0, ignored: [],
  }
  const seen = new Set<string>()
  for (const ballot of [...ballots].sort((a, b) => a.member < b.member ? -1 : a.member > b.member ? 1 : 0)) {
    if (!eligible.has(ballot.member)) { tally.ignored.push(ballot.member); continue }
    if (seen.has(ballot.member)) throw new Error(`Duplicate ballot: ${ballot.member}`)
    seen.add(ballot.member)
    if (ballot.vote !== null && typeof ballot.vote !== 'boolean') throw new Error('Invalid ballot')
    tally.present++
    tally[ballot.vote === null ? 'abstain' : ballot.vote ? 'yes' : 'no'] += weights.get(ballot.member)!
  }
  const cast = tally.yes + tally.no
  if (![cast, tally.abstain].every(Number.isFinite)) throw new Error('Vote weight overflow')
  const quorate = tally.present >= minimum(procedure.quorum, tally.eligible)
  const tied = cast > 0 && tally.yes === tally.no
  const unresolved = tied && procedure.tie === null ? 'tie'
    : tied && procedure.tie === 'chair' && typeof facts.chairVote !== 'boolean' ? 'chair-choice-missing' : null
  const tiePasses = !tied || (procedure.tie === 'chair' && facts.chairVote === true)
  return { kind: 'body', quorate,
    adopted: quorate && cast > 0 && tally.yes >= minimum(procedure.threshold, cast) && tiePasses,
    tally, unresolved }
}
