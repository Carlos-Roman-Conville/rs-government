import type { AuthorityReaders } from '../src/authority/readers.ts'

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
