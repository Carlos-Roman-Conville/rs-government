import { applicableLaws } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { evaluatePredicate } from '../law/predicate.ts'
import type { Law } from '../law/schema.ts'
import type { AuthorityReaders, AgentsReader, BeliefReader, CapacityReader, WeightReader } from './readers.ts'

export interface AuthoritySubject { id: string; place: string }
export type AuthorityFlag =
  | { kind: 'no-weighted-belief'; actor: string; domain: string }
  | { kind: 'missing-agent-belief'; actor: string; domain: string; person: string }
export interface AuthorityInputs { J: 0 | 1; R: number | null; C: number; C_opp: number }
export type AuthorityFormula = ((inputs: Readonly<AuthorityInputs>) => number | null) & {
  readonly id: string
  readonly provisional: boolean
}
export interface AuthorityRow extends AuthorityInputs {
  actor: string
  domain: string
  person: string
  A: number | null
  f: string
  flags: AuthorityFlag[]
}

function ids(values: readonly string[]): string[] { return [...new Set(values)].sort() }
function nonnegative(value: number, port: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${port}: expected a finite nonnegative number`)
  return value
}
function belief(value: number | null): number | null {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('government.port.recognition: expected null or a probability in [0,1]')
  }
  return value
}

/** A hypothetical exercise of power, not a performed act. As in evaluateAct,
 * actor is the would-be power holder and object is the subject person. The host
 * resolves office membership and other predicates through facts. An issuer or
 * jurisdiction authority is not automatically the recipient of its own grant.
 */
export function deJure(laws: readonly Law[], actor: string, domain: string,
  person: AuthoritySubject, day: number, facts: ActFacts): 0 | 1 {
  return laws.some(law => {
    if (law.modality !== 'empower' || law.regulated.power !== domain) return false
    const act: Act = { actor, action: law.regulated.action, object: person.id,
      place: person.place, day, attempted: false, succeeded: false }
    // Keep the full law set here so non-empower replacements can supersede grants.
    if (![...applicableLaws(laws, act, facts).values()].some(group => group.includes(law))) return false
    const read = (name: string) => facts(name, act)
    return (law.regulated.object === 'any' || evaluatePredicate(law.regulated.object, read))
      && evaluatePredicate(law.condition, read)
      && !law.exceptions.some(exception => evaluatePredicate(exception.condition, read))
  }) ? 1 : 0
}

export function recognition(actor: string, domain: string, persons: readonly string[],
  readers: BeliefReader & WeightReader): { R: number | null; flags: AuthorityFlag[] } {
  let weighted = 0, total = 0
  for (const person of ids(persons)) {
    const b = belief(readers.recognition(person, actor, domain))
    if (b === null) continue
    const weight = nonnegative(readers.weight(person), 'weight')
    weighted += weight * b
    total += weight
  }
  return total === 0
    ? { R: null, flags: [{ kind: 'no-weighted-belief', actor, domain }] }
    : { R: weighted / total, flags: [] }
}

export function backing(actor: string, domain: string,
  readers: BeliefReader & CapacityReader & AgentsReader): { C: number; flags: AuthorityFlag[] } {
  let C = 0
  const flags: AuthorityFlag[] = []
  for (const person of ids(readers.agents(actor))) {
    const y = belief(readers.recognition(person, actor, domain))
    if (y === null) flags.push({ kind: 'missing-agent-belief', actor, domain, person })
    else C += nonnegative(readers.capacity(person), 'capacity') * y
  }
  return { C, flags }
}

/** rivals is the caller's set of contesting actors, not all actors in the world. */
export function strongestRival(actor: string, domain: string, rivals: readonly string[],
  readers: BeliefReader & CapacityReader & AgentsReader): number {
  return rivalBacking(actor, domain, rivals, readers).C_opp
}

function rivalBacking(actor: string, domain: string, rivals: readonly string[],
  readers: BeliefReader & CapacityReader & AgentsReader): { C_opp: number; flags: AuthorityFlag[] } {
  let C_opp = 0
  const flags: AuthorityFlag[] = []
  for (const rival of ids(rivals).filter(id => id !== actor)) {
    const result = backing(rival, domain, readers)
    C_opp = Math.max(C_opp, result.C)
    flags.push(...result.flags)
  }
  return { C_opp, flags }
}

/** Level-5 hypothesis, subject to validation; never an independently owned score. */
export const provisionalF = Object.freeze(Object.assign(
  ({ J, R, C, C_opp }: Readonly<AuthorityInputs>): number | null =>
    R === null ? null : C + C_opp === 0 ? 0 : J * R * C / (C + C_opp),
  { id: 'government.authority.provisional-v1', provisional: true as const },
))

export function effectiveAuthority(inputs: Readonly<AuthorityInputs>, f: AuthorityFormula = provisionalF): number | null {
  // Unknown recognition remains unknown even with a replacement hypothesis.
  return inputs.R === null ? null : f(Object.freeze({ ...inputs }))
}

/** Computed afresh on every read. actors is the set of competing claimants in
 * this jurisdiction (also the place ID used for law applicability). J is a
 * relation over a subject: retain one row per actor/domain/person rather than
 * inventing an aggregate J. Empty populations produce no subject rows.
 */
export function distribution(laws: readonly Law[], actors: readonly string[], domains: readonly string[],
  jurisdiction: string, day: number, readers: AuthorityReaders, facts: ActFacts,
  f: AuthorityFormula = provisionalF): AuthorityRow[] {
  const persons = ids(readers.persons(jurisdiction))
  return ids(actors).flatMap(actor => ids(domains).flatMap(domain => {
    const recognized = recognition(actor, domain, persons, readers)
    const backed = backing(actor, domain, readers)
    const rivals = rivalBacking(actor, domain, actors, readers)
    return persons.map(person => {
      const inputs: AuthorityInputs = {
        J: deJure(laws, actor, domain, { id: person, place: jurisdiction }, day, facts),
        R: recognized.R, C: backed.C, C_opp: rivals.C_opp,
      }
      return { actor, domain, person, ...inputs, A: effectiveAuthority(inputs, f), f: f.id,
        flags: [...recognized.flags, ...backed.flags, ...rivals.flags].map(flag => ({ ...flag })) }
    })
  }))
}
