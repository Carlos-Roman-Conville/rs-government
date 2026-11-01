import { describe, expect, it, vi } from 'vitest'
import { backing, chainOfCommand, evaluateAct, forceCapacity, levyBreaches, levyObligations, MILITARY_ACTIONS } from '../src/index.ts'
import type { ActFacts, CommandOffice, ForceReaders, Law, LevyFacts, MusterOutcome } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { authorityStubs } from './stubs.ts'

const subjects = ['person.a', 'person.b'].map(id => ({ id, place: 'place.manor', object: 'force.fixture' }))
const facts: LevyFacts = { subjects, actFacts: () => undefined }
function duty(slug = 'levy', action = 'muster'): Law {
  return { ...lawFixture(slug), modality: 'require', regulated: { action, object: 'any' } }
}

describe('levy obligations and host-confirmed musters', () => {
  it('one person musters and one omits: only the confirmed omission becomes an ordinary breach', () => {
    const law = duty(), rows = levyObligations([law], 10, facts)
    const outcomes = rows.map((row, i) => ({ ...row, fulfilled: i === 0 }))
    const breaches = levyBreaches([law], rows, outcomes, facts.actFacts)
    expect(rows.map(row => row.person)).toEqual(['person.a', 'person.b'])
    expect(breaches).toEqual(evaluateAct([law], { ...rows[1].act, action: 'omit:muster' }, facts.actFacts))
    expect(breaches).toHaveLength(1)
    expect(breaches[0]).toMatchObject({ stage: 'breach', known_to: [], act: { actor: 'person.b' } })
  })

  it('absent, null and omitted outcome values are unknown, never a breach', () => {
    const law = duty(), rows = levyObligations([law], 10, facts)
    expect(levyBreaches([law], rows, [], facts.actFacts)).toEqual([])
    expect(levyBreaches([law], rows, rows.map(row => ({ ...row, fulfilled: null })), facts.actFacts)).toEqual([])
    expect(levyBreaches([law], rows, [rows[0] as unknown as MusterOutcome], facts.actFacts)).toEqual([])
  })

  it.each(MILITARY_ACTIONS)('%s is an ordinary require duty, not an empower or prohibit law', action => {
    const law = duty('duty', action), rows = levyObligations([law], 10, facts)
    expect(rows).toHaveLength(2)
    expect(levyBreaches([law], rows, [{ ...rows[0], fulfilled: false }], facts.actFacts)[0].act.action)
      .toBe(`omit:${action}`)
    expect(levyObligations([{ ...law, modality: 'prohibit', regulated: { action, object: 'any' } }], 10, facts)).toEqual([])
    expect(levyObligations([{ ...law, modality: 'empower', regulated: { action, power: 'levy', object: 'any' } }], 10, facts)).toEqual([])
    expect(levyObligations([duty('civil', 'pay')], 10, facts)).toEqual([])
  })

  it('shares inclusive/exclusive dates, status, jurisdiction and condition matching', () => {
    const law = duty()
    const excluded: Law[] = [
      { ...law, status: 'suspended' }, { ...law, status: 'repealed' },
      { ...law, jurisdiction: { ...law.jurisdiction, from: 11 } },
      { ...law, jurisdiction: { ...law.jurisdiction, until: 10 } },
      { ...law, jurisdiction: { ...law.jurisdiction, places: ['elsewhere'] } },
      { ...law, jurisdiction: { ...law.jurisdiction, persons: { not: true } } },
      { ...law, modality: 'require', regulated: { action: 'muster', object: { not: true } } },
      { ...law, condition: { not: true } },
      { ...law, exceptions: [{ condition: true, reason: 'fixture exemption' }] },
    ]
    for (const candidate of excluded) expect(levyObligations([candidate], 10, facts)).toEqual([])
    expect(levyObligations([{ ...law, jurisdiction: { ...law.jurisdiction, from: 10, until: 11 } }], 10, facts)).toHaveLength(2)
    law.condition = { read: 'person.status', op: 'eq', value: 'fixture-member' }
    const read = vi.fn<ActFacts>((name, act) => name === 'person.status' && act.actor === 'person.a' ? 'fixture-member' : 'other')
    expect(levyObligations([law], 10, { subjects, actFacts: read }).map(row => row.person)).toEqual(['person.a'])
    expect(read).toHaveBeenCalledWith('person.status', { actor: 'person.a', object: 'force.fixture',
      action: 'muster', place: 'place.manor', day: 10, attempted: false, succeeded: false })
    expect(() => levyObligations([law], 10, facts)).toThrow(/undefined/)
  })

  it('retains rival obligations, isolates fulfilled duties and respects nonmilitary supersession', () => {
    const a = duty('a'), z = duty('z')
    z.jurisdiction.authority = 'authority.rival'
    z.supersedes = [a.id]
    const laws = [z, a], rows = levyObligations(laws, 10, facts)
    const outcomes = rows.map(row => ({ ...row, fulfilled: row.law === z.id }))
    expect(rows).toHaveLength(4)
    expect(levyBreaches(laws, rows, outcomes, facts.actFacts).map(breach => breach.law)).toEqual([a.id, a.id])
    expect(levyObligations([...laws].reverse(), 10, { ...facts, subjects: [...subjects].reverse() })).toEqual(rows)
    expect(levyBreaches([...laws].reverse(), [...rows].reverse(), [...outcomes].reverse(), facts.actFacts))
      .toEqual(levyBreaches(laws, rows, outcomes, facts.actFacts))
    const replacement = { ...lawFixture('replacement'), supersedes: [a.id] }
    expect(levyObligations([...laws, replacement], 10, facts).map(row => row.law)).toEqual([z.id, z.id])
    expect(levyBreaches([...laws, replacement], rows, outcomes, facts.actFacts)).toEqual([])
  })

  it('rejects duplicate or unmatched outcomes and ambiguous host subjects', () => {
    const law = duty(), rows = levyObligations([law], 10, facts), outcome = { ...rows[0], fulfilled: false }
    expect(() => levyObligations([law], NaN, facts)).toThrow(/finite/)
    expect(() => levyObligations([law], 10, { ...facts, subjects: [subjects[0], subjects[0]] })).toThrow(/Duplicate/)
    expect(() => levyBreaches([law], rows, [outcome, outcome], facts.actFacts)).toThrow(/Duplicate/)
    expect(() => levyBreaches([law], [rows[0], rows[0]], [], facts.actFacts)).toThrow(/Duplicate/)
    expect(() => levyBreaches([law], rows, [{ ...outcome, day: 11 }], facts.actFacts)).toThrow(/Unknown/)
  })
})

const actor = 'office.captain'
const members = { actor, persons: ['person.b', 'person.a', 'person.a'] }
function readers() {
  return authorityStubs({ beliefs: { 'person.a': { [actor]: { command: 0.5 } }, 'person.b': { [actor]: { command: 1 } } },
    capacities: { 'person.a': 6, 'person.b': 4 }, weights: {}, agents: { [actor]: members.persons }, populations: {} })
}

describe('force capacity is shared backing and a separate Economy read', () => {
  it('equals backing for the same members and keeps supply separate without mutating owner state', () => {
    const ports = readers(), supply = Object.freeze({ amount: 12, unit: 'rations' })
    const readSupply = vi.fn(() => supply), before = structuredClone(members)
    const result = forceCapacity(members, { ...ports, supply: readSupply })
    expect(result).toEqual({ ...backing(actor, 'command', ports), supply, note: null })
    expect(result.C).toBe(7)
    expect(readSupply).toHaveBeenCalledWith(actor)
    expect(result.supply).not.toBe(supply)
    expect(members).toEqual(before)
  })

  it('flags missing belief while an explicit zero belief remains known', () => {
    const ports = readers()
    const missing = forceCapacity(members, { ...ports, recognition: person => person === 'person.a' ? null : 1 })
    expect(missing.C).toBe(4)
    expect(missing.flags).toEqual([{ kind: 'missing-agent-belief', actor, domain: 'command', person: 'person.a' }])
    const zero = forceCapacity(members, { ...ports, recognition: person => person === 'person.a' ? 0 : 1 })
    expect(zero.C).toBe(4)
    expect(zero.flags).toEqual([])
  })

  it('uses host members rather than an ambient roster and keeps absent supply null with a note', () => {
    const ports = readers()
    expect(forceCapacity({ actor, persons: ['person.a'] }, ports).C).toBe(3)
    for (const extra of [{}, { supply: () => null }, { supply: () => undefined }]) {
      expect(forceCapacity(members, { ...ports, ...extra })).toMatchObject({ supply: null, note: expect.stringContaining('Missing') })
    }
    expect(forceCapacity(members, { ...ports, supply: () => ({ amount: 0, unit: 'rations' }) }))
      .toMatchObject({ C: 7, supply: { amount: 0, unit: 'rations' }, note: null })
    expect(() => forceCapacity(members, { ...ports, supply: () => ({ amount: -1, unit: 'rations' }) } as ForceReaders)).toThrow(/supply/)
  })
})

describe('command uses shared empowerment and delegation', () => {
  function grant(slug: string, issuer: string, recipient: string, action = 'command'): Law {
    return { ...lawFixture(slug), issuer, modality: 'empower',
      jurisdiction: { ...lawFixture().jurisdiction, persons: { read: 'fixture.recipient', op: 'eq', value: recipient } },
      regulated: { action, power: action, object: 'any' } }
  }
  const office: CommandOffice = { id: actor, subject: { id: 'person.a', place: 'place.manor' },
    actFacts: (name, act) => name === 'fixture.recipient' ? act.actor
      : name === 'law.empowered-actors' ? act.object === 'government/law.captain' ? [actor] : ['office.general'] : undefined }

  it('resolves command through empower laws and ignores noncommand delegation', () => {
    const captain = grant('captain', 'office.general', actor)
    const general = grant('general', 'office.crown', 'office.general')
    const civil = grant('civil', 'office.civil', actor, 'tax')
    expect(chainOfCommand([captain, civil, general], office, 10))
      .toEqual({ office: actor, J: 1, chain: ['office.crown', 'office.general'] })
    expect(chainOfCommand([general, civil, captain], office, 10)).toEqual(chainOfCommand([captain, civil, general], office, 10))
    expect(chainOfCommand([captain], { ...office, id: 'office.other' }, 10).J).toBe(0)
  })

  it('keeps date bounds and noncommand supersession before selecting command grants', () => {
    const captain = grant('captain', 'office.general', actor)
    const replacement = { ...lawFixture('replacement'), issuer: captain.issuer, supersedes: [captain.id] }
    expect(chainOfCommand([captain, replacement], office, 10)).toEqual({ office: actor, J: 0, chain: [] })
    captain.jurisdiction.until = 10
    expect(chainOfCommand([captain], office, 10)).toEqual({ office: actor, J: 0, chain: [] })
    expect(chainOfCommand([captain], office, 9).J).toBe(1)
    expect(() => chainOfCommand([captain], { ...office, actFacts: () => undefined }, 9)).toThrow(/empowered-actors|undefined/)
  })
})
