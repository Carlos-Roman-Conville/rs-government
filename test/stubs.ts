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
  persons: Record<string, { alive: boolean | null; born: number | null; sex: string | null }>
}

/** Society/Life provider stubs; absent data stays unknown, never an empty family. */
export function successionStubs(data: SuccessionStubData): ActFacts {
  return (name, act) => {
    if (act.object === null) throw new Error('Succession reads require a subject')
    if (name === 'kin.children') return data.children[act.object] ?? null
    const person = data.persons[act.object]
    if (name === 'person.alive') return person?.alive ?? null
    if (name === 'person.born') return person?.born ?? null
    if (name === 'person.sex') return person?.sex ?? null
    throw new Error(`Unexpected succession read: ${name}`)
  }
}
