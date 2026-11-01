import { describe, expect, it } from 'vitest'
import { decide, enact } from '../src/index.ts'
import type { Ballot, CollectiveProcedure } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const members = ['a', 'b', 'c']
const facts = { read: (_name: string, member: string) => member !== 'c' }
const majority: CollectiveProcedure = {
  id: 'choice.fixture', eligible: true, quorum: { fraction: 1 },
  threshold: { fraction: 0.5 }, tie: 'fails',
}
const votes = (...choices: (boolean | null)[]): Ballot[] =>
  choices.map((vote, i) => ({ member: members[i], vote }))

describe('collective choice', () => {
  it('simple majority is anonymous and neutral for all three-voter profiles (May 1952)', () => {
    for (let mask = 0; mask < 8; mask++) {
      const ballots = votes(...members.map((_, i) => !!(mask & (1 << i))))
      const result = decide(majority, members, ballots, facts)
      const swapped = ballots.map((ballot, i) => ({ ...ballot, member: members[2 - i] }))
      expect(decide(majority, members, swapped, facts)).toEqual(result)
      expect(decide(majority, [...members].reverse(), [...ballots].reverse(), facts)).toEqual(result)
      expect(decide(majority, members, ballots.map(b => ({ ...b, vote: !b.vote })), facts).adopted)
        .toBe(!result.adopted)
      expect(result.adopted).toBe(ballots.filter(b => b.vote).length >= 2)
    }
  })
  it('quorum failure prevents an otherwise unanimous decision', () => {
    expect(decide(majority, members, votes(true, true), facts))
      .toMatchObject({ quorate: false, adopted: false, tally: { present: 2 } })
  })
  it('weights affect the threshold while quorum still counts members', () => {
    expect(decide({ ...majority, weights: { a: 4, b: 1, c: 1 } }, members, votes(true, false, false), facts))
      .toMatchObject({ quorate: true, adopted: true, tally: { yes: 4, no: 2 } })
  })
  it.each([
    ['fails', undefined, false, null],
    [null, undefined, false, 'tie'],
    ['chair', true, true, null],
    ['chair', false, false, null],
    ['chair', undefined, false, 'chair-choice-missing'],
  ] as const)('tie rule %s with chair choice %s is explicit', (tie, chairVote, adopted, unresolved) => {
    expect(decide({ ...majority, tie }, members.slice(0, 2), votes(true, false), { ...facts, chairVote }))
      .toMatchObject({ quorate: true, adopted, unresolved })
  })
  it('a chair cannot bypass a supermajority threshold', () => {
    expect(decide({ ...majority, tie: 'chair', threshold: { fraction: 2 / 3 } },
      members.slice(0, 2), votes(true, false), { ...facts, chairVote: true }).adopted).toBe(false)
  })
  it('ineligible and nonmember ballots are ignored and listed by id', () => {
    const procedure = { ...majority, eligible: { read: 'member.allowed', op: 'eq', value: true } } as const
    expect(decide(procedure, members, [...votes(true, true, false), { member: 'outsider', vote: false }], facts))
      .toMatchObject({ adopted: true, tally: { eligible: 2, present: 2, yes: 2, no: 0, ignored: ['c', 'outsider'] } })
  })
  it('count minima are inclusive and abstentions count only toward quorum', () => {
    const procedure = { ...majority, quorum: { count: 3 }, threshold: { count: 2 } }
    expect(decide(procedure, members, votes(true, true, null), facts))
      .toMatchObject({ adopted: true, tally: { yes: 2, abstain: 1 } })
    expect(decide(procedure, members, votes(true, null, null), facts).adopted).toBe(false)
  })
  it('empty and abstention-only decisions never adopt', () => {
    const procedure = { ...majority, quorum: { count: 0 }, threshold: { count: 0 } }
    expect(decide(procedure, [], [], facts).adopted).toBe(false)
    expect(decide(procedure, members, votes(null, null, null), facts).adopted).toBe(false)
  })
  it('duplicate members, duplicate ballots and missing weights cannot create extra votes', () => {
    expect(() => decide(majority, ['a', 'a'], [], facts)).toThrow('Duplicate member')
    expect(() => decide(majority, members, [...votes(true), ...votes(false)], facts)).toThrow('Duplicate ballot')
    expect(() => decide({ ...majority, weights: { a: 1 } }, members, [], facts)).toThrow('weight')
    expect(() => decide({ ...majority, threshold: { fraction: 2 } }, members, [], facts)).toThrow('minimum')
  })
  it('an adopted decide result goes directly through enact to create a law without mutation', () => {
    const ballots = votes(true, true, false)
    const before = structuredClone({ majority, members, ballots })
    const decision = decide(majority, members, ballots, facts)
    expect(enact([], { ...lawFixture(), place: 'place.fixture' }, decision, 'event.vote', 10, () => undefined))
      .toMatchObject({ failure: null, law: { enactment: 'event.vote' } })
    expect({ majority, members, ballots }).toEqual(before)
    const unresolved = decide({ ...majority, tie: null }, members.slice(0, 2), votes(true, false), facts)
    expect(enact([], { ...lawFixture(), place: 'place.fixture' }, unresolved, 'event.tie', 10, () => undefined))
      .toEqual({ law: null, failure: 'not-adopted' })
  })
})
