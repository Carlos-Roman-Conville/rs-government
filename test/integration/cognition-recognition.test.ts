import { describe, expect, it } from 'vitest'
import { categorical, createBeliefStore, createRecognitionReader, setBelief } from '@rex/cognition'
import type { BeliefStore } from '@rex/cognition'
import { legitimacyRead } from '../../src/legitimacy/aggregate.ts'

// All people, handles and probabilities below are test fiction.
function believing(handle: string, domain: string, p: number): BeliefStore {
  return setBelief(createBeliefStore(), handle, 'ought_obey:' + domain,
    categorical(['false', 'true'], [1 - p, p]))
}

describe('Cognition recognition port as Government BeliefReader', () => {
  const minds: Record<string, BeliefStore> = {
    ann: believing('crown-h', 'tax', 0.75),
    bob: believing('crown-h', 'tax', 0.25),
    cat: believing('crown-h', 'justice', 0.9), // no tax belief
    dan: believing('crown-h', 'tax', 0.5),     // handle unmapped below
  }
  const reader = createRecognitionReader({
    beliefs: person => minds[person],
    handle: (person, actor) => person !== 'dan' && actor === 'crown' ? 'crown-h' : undefined,
  })

  it("passes a mind's P(true) through to the read", () => {
    const read = legitimacyRead('crown', 'tax', 1, ['ann'], reader)
    expect(read.R).toBeCloseTo(0.75, 12)
    expect(read.missingCount).toBe(0)
  })

  it('excludes missing and unmapped minds from R instead of reading them as 0', () => {
    const read = legitimacyRead('crown', 'tax', 1, ['ann', 'bob', 'cat', 'dan', 'eve'], reader)
    expect(read.populationSize).toBe(5)
    expect(read.missingCount).toBe(3)
    expect([...read.missingSubjects].sort()).toEqual(['cat', 'dan', 'eve'])
    expect(read.R).toBeCloseTo(0.5, 12)
    expect(read.shareBelieving).toBeCloseTo(0.5, 12)
  })

  it('reads a domain nobody holds a belief about as null, never 0', () => {
    const read = legitimacyRead('crown', 'tax', 1, ['cat', 'dan'], reader)
    expect(read.R).toBeNull()
    expect(read.missingCount).toBe(2)
  })
})
