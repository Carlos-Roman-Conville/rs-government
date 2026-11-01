import { describe, expect, it, vi } from 'vitest'
import { legitimacyRead, recognition } from '../src/index.ts'
import { authorityStubs } from './stubs.ts'

function fixture() {
  const data = {
    beliefs: { a: { court: { tax: 0.2 } }, b: { court: { tax: 0.8 } } },
    weights: { a: 1, b: 3 }, capacities: {}, agents: {}, populations: {},
  }
  const reader = authorityStubs(data)
  return { data, reader }
}

describe('legitimacy as a fresh aggregate of beliefs', () => {
  it('resource-weighted R reuses authority recognition; unweighted share averages probabilities', () => {
    const { reader } = fixture()
    const result = legitimacyRead('court', 'tax', 10, ['b', 'a'], reader, reader)
    expect(result.R).toBeCloseTo(0.65)
    expect(result.R).toBe(recognition('court', 'tax', ['a', 'b'], reader).R)
    expect(result.shareBelieving).toBe(0.5)
    expect(result).toMatchObject({ institution: 'court', domain: 'tax', day: 10, populationSize: 2 })
    expect(legitimacyRead('court', 'tax', 10, ['a', 'b'], reader).R).toBe(0.5)
  })

  it('null beliefs are excluded from both means, reported sorted, and never require weights', () => {
    const { reader } = fixture()
    const read = vi.spyOn(reader, 'recognition')
    expect(legitimacyRead('court', 'tax', 10, ['z', 'a', 'missing', 'a'], reader, reader))
      .toMatchObject({ R: 0.2, shareBelieving: 0.2, populationSize: 3,
        missingCount: 2, missingSubjects: ['missing', 'z'] })
    expect(read.mock.calls).toEqual([
      ['a', 'court', 'tax'], ['missing', 'court', 'tax'], ['z', 'court', 'tax'],
    ])
  })

  it.each([['unknown'], []])('all-null or empty populations yield null, never zero (%j)', (...subjects) => {
    const { reader } = fixture()
    expect(legitimacyRead('court', 'tax', 10, subjects, reader, reader))
      .toMatchObject({ R: null, shareBelieving: null, populationSize: subjects.length,
        missingCount: subjects.length, missingSubjects: subjects })
  })

  it('zero weights leave unweighted beliefs intact and genuine zero beliefs remain zero', () => {
    const { data, reader } = fixture()
    data.weights.a = 0
    expect(legitimacyRead('court', 'tax', 10, ['a'], reader, reader))
      .toMatchObject({ R: null, shareBelieving: 0.2, missingCount: 0 })
    data.beliefs.a.court.tax = 0
    expect(legitimacyRead('court', 'tax', 10, ['a'], reader))
      .toMatchObject({ R: 0, shareBelieving: 0, missingCount: 0 })
  })

  it('changed provider beliefs change a second read with no Government writes or retained results', () => {
    const { data, reader } = fixture()
    const subjects = Object.freeze(['a', 'b'])
    const snapshot = structuredClone(data)
    const first = legitimacyRead('court', 'tax', 10, subjects, reader, reader)
    expect(data).toEqual(snapshot)
    data.beliefs.a.court.tax = 1
    const changed = structuredClone(data)
    const second = legitimacyRead('court', 'tax', 10, subjects, reader, reader)
    expect(second.R).toBeCloseTo(0.85)
    expect(second.shareBelieving).toBe(0.9)
    expect(first.R).toBeCloseTo(0.65)
    expect(data).toEqual(changed)
    second.missingSubjects.push('fake')
    expect(legitimacyRead('court', 'tax', 10, subjects, reader, reader).missingSubjects).toEqual([])
  })

  it('invalid beliefs and weights retain the authority port validation', () => {
    const { data, reader } = fixture()
    data.beliefs.a.court.tax = NaN
    expect(() => legitimacyRead('court', 'tax', 10, ['a'], reader)).toThrow(/recognition/)
    data.beliefs.a.court.tax = 0.2
    data.weights.a = -1
    expect(() => legitimacyRead('court', 'tax', 10, ['a'], reader, reader)).toThrow(/weight/)
  })
})
