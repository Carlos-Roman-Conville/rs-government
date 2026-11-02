import type { AuthorityReaders } from '../src/authority/readers.ts'
import type { ActFacts } from '../src/law/evaluate.ts'

export interface AuthorityStubData {
  beliefs: Record<string, Record<string, Record<string, number | null>>>
  weights: Record<string, number>
  capacities: Record<string, number>
  agents: Record<string, readonly string[]>
  populations: Record<string, readonly string[]>
}

function required<T>(value: T | undefined, key: string): T {
  if (value === undefined) throw new Error(`Missing stub value: ${key}`)
  return value
}

/** No numeric defaults: tests explicitly supply zero resources/capacity. */
export function authorityStubs(data: AuthorityStubData): AuthorityReaders {
  return {
    recognition: (person, actor, domain) => data.beliefs[person]?.[actor]?.[domain] ?? null,
    weight: person => required(data.weights[person], `weight:${person}`),
    capacity: person => required(data.capacities[person], `capacity:${person}`),
    agents: actor => [...required(data.agents[actor], `agents:${actor}`)],
    persons: jurisdiction => [...required(data.populations[jurisdiction], `persons:${jurisdiction}`)],
  }
}

export interface SuccessionStubData {
  children: Record<string, readonly string[] | null>
  persons: Record<string, { alive: boolean | null; born: number | null; sex: string | null;
    fullAge?: boolean | null; blemished?: boolean | null; prince?: boolean | null }>
  parents?: Record<string, { father: string | null; mother: string | null } | null>
  firstPurchasers?: Record<string, string | null>
  pastHolders?: Record<string, readonly string[] | null>
  officeHolders?: Record<string, string | null>
  treatyHeirs?: Record<string, string | null>
  contestVictors?: Record<string, string | null>
  officeRegents?: Record<string, readonly string[] | null>
}

/** Society/Life provider stubs; absent data stays unknown, never an empty family. */
export function successionStubs(data: SuccessionStubData): ActFacts {
  return (name, act) => {
    if (act.object === null) throw new Error('Succession reads require a subject')
    if (name === 'kin.children') return data.children[act.object] ?? null
    if (name === 'kin.parents') return data.parents?.[act.object] ?? null
    if (name === 'estate.first-purchaser') return data.firstPurchasers?.[act.object] ?? null
    if (name === 'office.past-holders') return data.pastHolders?.[act.object] ?? null
    if (name === 'office.holder') return data.officeHolders?.[act.object] ?? null
    if (name === 'treaty.recognised-heir') return data.treatyHeirs?.[act.object] ?? null
    if (name === 'contest.victor') return data.contestVictors?.[act.object] ?? null
    if (name === 'office.regent') return data.officeRegents?.[act.object] ?? null
    const person = data.persons[act.object]
    if (name === 'person.alive') return person?.alive ?? null
    if (name === 'person.born') return person?.born ?? null
    if (name === 'person.sex') return person?.sex ?? null
    if (name === 'person.full-age') return person?.fullAge ?? null
    if (name === 'person.blemished') return person?.blemished ?? null
    if (name === 'person.prince') return person?.prince ?? null
    throw new Error(`Unexpected succession read: ${name}`)
  }
}
