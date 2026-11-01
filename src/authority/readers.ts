/** Pure provider reads; the host supplies one consistent snapshot per computation. */
export interface BeliefReader {
  /** government.port.recognition: Cognition P(true) of ought_obey:<domain>.
   * The host maps actor IDs to each mind's own handles. null means no belief formed.
   */
  recognition(person: string, actor: string, domain: string): number | null
}

export interface WeightReader {
  /** Nonnegative resources commanded: Settlement holdings, Economy goods, Society followers. */
  weight(person: string): number
}

export interface CapacityReader {
  /** Nonnegative Life functional capacity multiplied by equipment. */
  capacity(agent: string): number
}

export interface AgentsReader {
  /** Persons acting for the actor, resolved from Settlement posts and delegation. */
  agents(actor: string): readonly string[]
}

export interface PopulationReader {
  persons(jurisdiction: string): readonly string[]
}

export interface AuthorityReaders extends BeliefReader, WeightReader, CapacityReader, AgentsReader, PopulationReader {}
