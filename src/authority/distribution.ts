import { applicableLaws } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { evaluatePredicate } from '../law/predicate.ts'
import type { Law } from '../law/schema.ts'
import type { AuthorityReaders, AgentsReader, BeliefReader, CapacityReader, WeightReader } from './readers.ts'

export interface AuthoritySubject { id: string; place: string }
export type AuthorityClaimants = Readonly<Record<string, readonly string[]>>
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
 * Optional action scopes a power (e.g. legislate) to a particular action domain.
 */
export function deJure(laws: readonly Law[], actor: string, domain: string,
  person: { id: string | null; place: string }, day: number, facts: ActFacts, action?: string): 0 | 1 {
  return laws.some(law => {
    if (law.jurisdiction.authority === null || law.modality !== 'empower' || law.regulated.power !== domain) return false
    if (action !== undefined && law.regulated.action !== action) return false
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

/** Empower recipients can depend on host-owned offices and predicates. For each
 * active, unsuperseded grant, law.empowered-actors resolves its recipient actor IDs
 * with actor=issuer, object=law.id, action=the grant's action and place=''. An empty
 * list means no current recipients; missing facts fail rather than invent a link.
 * Delegation spans domains and places; this is a graph read, not a subject's J.
 */
function delegationGraph(laws: readonly Law[], day: number, facts: ActFacts): Map<string, Set<string>> {
  const active = laws.filter(law => law.status === 'in-force'
    && (law.jurisdiction.from === null || law.jurisdiction.from <= day)
    && (law.jurisdiction.until === null || day < law.jurisdiction.until))
  const graph = new Map<string, Set<string>>()
  const link = (from: string, to: string) => {
    if (!graph.has(from)) graph.set(from, new Set())
    graph.get(from)!.add(to)
  }
  for (const law of [...active].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (law.issuer === null || law.modality !== 'empower' || active.some(replacement => replacement.id !== law.id
      && law.jurisdiction.authority !== null
      && replacement.jurisdiction.authority !== null
      && replacement.issuer === law.issuer
      && replacement.jurisdiction.authority === law.jurisdiction.authority
      && replacement.supersedes.includes(law.id))) continue
    const recipients = facts('law.empowered-actors', { actor: law.issuer, object: law.id,
      action: law.regulated.action, place: '', day, attempted: false, succeeded: false })
    if (!Array.isArray(recipients) || !recipients.every(id => typeof id === 'string' && id.trim())) {
      throw new Error('read "law.empowered-actors": expected an array of non-empty actor IDs')
    }
    for (const recipient of ids(recipients)) {
      link(law.issuer, recipient)
      link(recipient, law.issuer)
    }
  }
  return graph
}

function linkedActors(graph: ReadonlyMap<string, ReadonlySet<string>>, actor: string): string[] {
  const visited = new Set([actor])
  for (const current of visited) {
    for (const linked of graph.get(current) ?? []) visited.add(linked)
  }
  visited.delete(actor)
  return [...visited].sort()
}

/** All other actors transitively linked by active empowerment in either direction,
 * sorted and unique. Cycles are allowed; the starting actor is excluded.
 */
export function delegationChain(laws: readonly Law[], actor: string, day: number, facts: ActFacts): string[] {
  return linkedActors(delegationGraph(laws, day, facts), actor)
}

export function recognition(actor: string, domain: string, persons: readonly string[],
  readers: BeliefReader & WeightReader): { R: number | null; flags: AuthorityFlag[] } {
  const { R, flags } = recognitionAggregate(actor, domain, persons, readers)
  return { R, flags }
}

/** Shared aggregation for authority and legitimacy; each unique belief is read once. */
export function recognitionAggregate(actor: string, domain: string, persons: readonly string[],
  readers: BeliefReader & WeightReader) {
  let weighted = 0, total = 0, sum = 0, known = 0
  const population = ids(persons)
  const missingSubjects: string[] = []
  for (const person of population) {
    const b = belief(readers.recognition(person, actor, domain))
    if (b === null) { missingSubjects.push(person); continue }
    const weight = nonnegative(readers.weight(person), 'weight')
    weighted += weight * b
    total += weight
    sum += b
    known++
  }
  const flags: AuthorityFlag[] = total === 0 ? [{ kind: 'no-weighted-belief', actor, domain }] : []
  return { R: total === 0 ? null : weighted / total,
    shareBelieving: known === 0 ? null : sum / known,
    populationSize: population.length, missingCount: missingSubjects.length, missingSubjects, flags }
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

/** Computed afresh on every read, one row per requested actor/domain/person.
 * Population comes from the jurisdiction; person.place supplies the subject's
 * location with object=person, action=domain and place='' before it is known.
 * Rivals must hold a grant over that subject or be host-named claimants for the
 * domain, and must be outside the actor's delegation chain. Host claimants may
 * include actors not requested as output rows. Empty populations produce no rows.
 */
export function distribution(laws: readonly Law[], actors: readonly string[], domains: readonly string[],
  jurisdiction: string, day: number, readers: AuthorityReaders, facts: ActFacts,
  f: AuthorityFormula = provisionalF, claimants: AuthorityClaimants = {}): AuthorityRow[] {
  const persons = ids(readers.persons(jurisdiction))
  if (!persons.length || !actors.length || !domains.length) return []
  const graph = delegationGraph(laws, day, facts)
  return ids(actors).flatMap(actor => {
    const chain = new Set([actor, ...linkedActors(graph, actor)])
    return ids(domains).flatMap(domain => {
      const recognized = recognition(actor, domain, persons, readers)
      const backed = backing(actor, domain, readers)
      const named = claimants[domain] ?? []
      const candidates = ids([...actors, ...named]).filter(candidate => !chain.has(candidate))
      return persons.map(person => {
        const place = facts('person.place', { actor, action: domain, object: person,
          place: '', day, attempted: false, succeeded: false })
        if (typeof place !== 'string' || !place.trim()) {
          throw new Error('read "person.place": expected a non-empty place ID')
        }
        const subject = { id: person, place }
        const rivals = rivalBacking(actor, domain, candidates.filter(candidate => named.includes(candidate)
          || deJure(laws, candidate, domain, subject, day, facts) === 1), readers)
        const inputs: AuthorityInputs = {
          J: deJure(laws, actor, domain, subject, day, facts),
          R: recognized.R, C: backed.C, C_opp: rivals.C_opp,
        }
        return { actor, domain, person, ...inputs, A: effectiveAuthority(inputs, f), f: f.id,
          flags: [...recognized.flags, ...backed.flags, ...rivals.flags].map(flag => ({ ...flag })) }
      })
    })
  })
}
