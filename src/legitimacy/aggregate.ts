import { recognitionAggregate } from '../authority/distribution.ts'
import type { BeliefReader, WeightReader } from '../authority/readers.ts'

export interface LegitimacyRead {
  institution: string
  domain: string
  day: number
  R: number | null
  /** Mean P(true) among known beliefs, without a threshold or resource weighting. */
  shareBelieving: number | null
  /** Unique requested subjects, including those with no belief. */
  populationSize: number
  missingCount: number
  missingSubjects: string[]
}

/** Fresh individual-resolution read. The host supplies a consistent snapshot for
 * day: the recognition port itself has no temporal argument. Optional weights
 * are host resource reads; omitting them explicitly selects equal weighting.
 * Null beliefs are excluded from both means; zero total weight yields null R.
 */
export function legitimacyRead(institution: string, domain: string, day: number,
  subjects: readonly string[], reader: BeliefReader, weights?: WeightReader): LegitimacyRead {
  const { flags: _flags, ...aggregate } = recognitionAggregate(institution, domain, subjects, {
    recognition: (person, actor, scope) => reader.recognition(person, actor, scope),
    weight: person => weights ? weights.weight(person) : 1,
  })
  return { institution, domain, day, ...aggregate }
}
