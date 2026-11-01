import { backing, deJure, delegationChain } from '../authority/distribution.ts'
import type { AuthoritySubject } from '../authority/distribution.ts'
import type { BeliefReader, CapacityReader } from '../authority/readers.ts'
import { applicableLaws, evaluateAct, inForceLaws, lawConditionsHold } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import type { Law, LawId } from '../law/schema.ts'
import type { Breach } from '../law/violation.ts'

/** DESIGN §1.13: recruitment is ordinary require laws over these action kinds.
 * This vocabulary supplies no eligibility, historical rule or recruitment choice.
 */
export const MILITARY_ACTIONS = ['muster', 'serve', 'provide-arms'] as const
export type MilitaryAction = typeof MILITARY_ACTIONS[number]
export interface LevySubject { id: string; place: string; object: string | null }
export interface LevyFacts { subjects: readonly LevySubject[]; actFacts: ActFacts }
interface LevyReference { law: LawId; person: string; day: number }
export interface LevyObligation extends LevyReference { act: Act }
/** Host-confirmed compliance at the deadline, including service and arms duties.
 * false confirms omission; null or an absent outcome remains unknown.
 */
export interface MusterOutcome extends LevyReference { fulfilled: boolean | null }

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const key = (row: LevyReference) => JSON.stringify([row.law, row.person, row.day])
const ordered = (a: LevyReference, b: LevyReference) =>
  compare(a.law, b.law) || compare(a.person, b.person) || a.day - b.day

/** The host supplies candidate persons, objects and places from owned state.
 * All applicability and predicate matching belongs to the shared law evaluator.
 */
export function levyObligations(laws: readonly Law[], day: number, facts: LevyFacts): LevyObligation[] {
  if (!Number.isFinite(day)) throw new Error('Levy day must be finite')
  if (new Set(facts.subjects.map(person => person.id)).size !== facts.subjects.length) {
    throw new Error('Duplicate levy subject')
  }
  return [...facts.subjects].sort((a, b) => compare(a.id, b.id)).flatMap(person =>
    MILITARY_ACTIONS.flatMap(action => {
      const act: Act = { actor: person.id, object: person.object, place: person.place,
        action, day, attempted: false, succeeded: false }
      return [...applicableLaws(laws, act, facts.actFacts).values()].flat()
        .filter(law => law.modality === 'require'
          && law.regulated.action === action && lawConditionsHold(law, act, facts.actFacts))
        .map(law => ({ law: law.id, person: person.id, day, act: { ...act } }))
    })).sort(ordered)
}

/** Like taxBreaches, only confirmed omissions enter evaluateAct. Keep the full
 * law set for supersession, then select this duty, not a fulfilled rival's duty.
 */
export function levyBreaches(laws: readonly Law[], obligations: readonly LevyObligation[],
  outcomes: readonly MusterOutcome[], facts: ActFacts): Breach[] {
  const byKey = new Map(obligations.map(row => [key(row), row])), seen = new Set<string>()
  if (byKey.size !== obligations.length) throw new Error('Duplicate levy obligation')
  return outcomes.flatMap(outcome => {
    const id = key(outcome), row = byKey.get(id)
    if (seen.has(id)) throw new Error(`Duplicate muster outcome: ${id}`)
    seen.add(id)
    if (!row) throw new Error(`Unknown levy obligation: ${id}`)
    if (outcome.fulfilled == null || outcome.fulfilled === true) return []
    if (outcome.fulfilled !== false) throw new Error('Invalid confirmed muster outcome')
    return evaluateAct(laws, { ...row.act, action: `omit:${row.act.action}`,
      attempted: false, succeeded: false }, facts).filter(breach => breach.law === row.law)
  }).sort((a, b) => compare(a.law, b.law) || compare(a.act.actor, b.act.actor) || a.act.day - b.act.day)
}

/** Membership is supplied by the host from Society/Settlement, never stored here. */
export interface ForceMembers { actor: string; persons: readonly string[] }
export interface ForceSupply { amount: number; unit: string }
export interface ForceReaders extends BeliefReader, CapacityReader {
  /** Economy inventory snapshot; an absent provider/value means unknown supply. */
  supply?(actor: string): ForceSupply | null | undefined
}

/** DESIGN §1.13/§1.2: capacity is backing in the command domain, with the shared
 * missing-belief flags intact. Supply is a separate read, never a multiplier.
 * Pay already uses appropriations (§1.10); combat outcomes belong to Reality/Life.
 */
export function forceCapacity(members: ForceMembers, readers: ForceReaders) {
  const capacity = backing(members.actor, 'command', {
    recognition: (person, actor, domain) => readers.recognition(person, actor, domain),
    capacity: person => readers.capacity(person), agents: () => members.persons,
  })
  const supply = readers.supply?.(members.actor) ?? null
  if (supply !== null && (!Number.isFinite(supply.amount) || supply.amount < 0
    || typeof supply.unit !== 'string' || !supply.unit.trim())) throw new Error('Invalid Economy supply read')
  return { ...capacity, supply: supply === null ? null : { ...supply },
    note: supply === null ? 'Missing Economy supply read.' : null }
}

export interface CommandOffice {
  /** Host-resolved office actor and the subject/place over which power is queried. */
  id: string
  subject: AuthoritySubject
  actFacts: ActFacts
}

/** The existing delegation chain is a sorted connected set, not a ranked list of
 * superiors. J separately reports this office's command grant over the subject.
 */
export function chainOfCommand(laws: readonly Law[], office: CommandOffice, day: number) {
  if (!Number.isFinite(day)) throw new Error('Command day must be finite')
  // Resolve supersession across ALL laws before selecting command grants.
  const grants = inForceLaws(laws, day).filter(law => law.modality === 'empower'
    && law.regulated.action === 'command' && law.regulated.power === 'command')
  return { office: office.id,
    J: deJure(laws, office.id, 'command', office.subject, day, office.actFacts, 'command'),
    chain: delegationChain(grants, office.id, day, office.actFacts) }
}
