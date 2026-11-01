import { describe, expect, it, vi } from 'vitest'
import { applicableLaws, evaluateAct } from '../src/index.ts'
import type { Act, ActFacts, Law } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'person.subject', action: 'seize', object: 'title.field',
  place: 'place.town', day: 10, attempted: true, succeeded: true }
const facts: ActFacts = () => undefined
const ids = (laws: Law[], event = act) => evaluateAct(laws, event, facts).map(breach => breach.law)

describe('applicable laws', () => {
  it.each([-1000000, -11, -10, 0, 1000000])('no sourced start applies on day %s subject to the exclusive until bound', day => {
    const law = lawFixture()
    law.jurisdiction.from = null
    for (const until of [null, -10]) {
      law.jurisdiction.until = until
      const applies = until === null || day < until
      const event = { ...act, day }
      expect([...applicableLaws([law], event, facts).values()].flat()).toEqual(applies ? [law] : [])
      expect(ids([law], event)).toEqual(applies ? [law.id] : [])
    }
  })
  it.each([[9, false], [10, true], [19, true], [20, false]])('the in-force window includes from and excludes until on day %s', (day, applies) => {
    const law = lawFixture()
    law.jurisdiction.from = 10
    law.jurisdiction.until = 20
    expect(ids([law], { ...act, day })).toEqual(applies ? [law.id] : [])
  })
  it('a null until leaves the in-force window open', () => expect(ids([lawFixture()], { ...act, day: 1000 })).toHaveLength(1))
  it.each(['suspended', 'repealed'] as const)('%s laws do not apply', status => {
    expect(ids([{ ...lawFixture(), status }])).toEqual([])
  })
  it('an in-force successor supersedes the former law regardless of input order', () => {
    const old = lawFixture('old')
    const next = { ...lawFixture('next'), supersedes: [old.id] }
    expect(ids([old, next])).toEqual([next.id])
    expect(ids([next, old])).toEqual([next.id])
  })
  it.each(['future', 'expired', 'suspended', 'repealed'])('a %s successor cannot suppress an in-force law', state => {
    const old = lawFixture('old')
    const next = { ...lawFixture('next'), supersedes: [old.id] }
    if (state === 'future') next.jurisdiction.from = 11
    if (state === 'expired') next.jurisdiction.until = 10
    if (state === 'suspended' || state === 'repealed') next.status = state
    expect(ids([next, old])).toEqual([old.id])
  })
  it('a jurisdiction place miss produces no breach', () => {
    const law = lawFixture()
    law.jurisdiction.places = ['place.port']
    expect(ids([law])).toEqual([])
    law.jurisdiction.places.push(act.place)
    expect(ids([law])).toEqual([law.id])
  })
  it('person jurisdiction reads the actor through the host port', () => {
    const law = lawFixture()
    law.jurisdiction.persons = { read: 'person.status', op: 'eq', value: 'resident' }
    const read = vi.fn((name: string, event: Readonly<Act>) => name === 'person.status' && event.actor === act.actor ? 'resident' : 'visitor')
    expect(evaluateAct([law], act, read)).toHaveLength(1)
    expect(evaluateAct([law], { ...act, actor: 'person.visitor' }, read)).toEqual([])
    expect(read).toHaveBeenCalledWith('person.status', act)
  })
  it('rival authorities are both returned and cannot supersede one another', () => {
    const crown = lawFixture('crown')
    crown.jurisdiction.authority = 'office.crown'
    const church = lawFixture('church')
    church.jurisdiction.authority = 'office.church'
    church.supersedes = [crown.id]
    expect([...applicableLaws([crown, church], act, facts)]).toEqual([
      ['office.church', [church]], ['office.crown', [crown]],
    ])
    expect(ids([crown, church])).toEqual([church.id, crown.id])
  })
  it('laws within an authority are sorted by law id', () => {
    const a = lawFixture('a'), z = lawFixture('z')
    expect([...applicableLaws([z, a], act, facts).values()]).toEqual([[a, z]])
  })
})

describe('breach evaluation', () => {
  it('a new breach exists without an observer and leaves inputs unchanged', () => {
    const law = lawFixture()
    const before = structuredClone({ law, act })
    const result = evaluateAct([law], act, facts)
    expect(result).toEqual([{ law: law.id, act, stage: 'breach', known_to: [], sanction: null, reason: null }])
    expect({ law, act }).toEqual(before)
    expect(result).toEqual(evaluateAct([law], act, facts))
    expect(result[0].act).not.toBe(act)
  })
  it('a prohibition requires the regulated action to match', () => {
    expect(ids([lawFixture()], { ...act, action: 'speak' })).toEqual([])
  })
  it('an object predicate must match the act object through its owner read', () => {
    const law = lawFixture()
    law.regulated.object = { read: 'object.kind', op: 'eq', value: 'land' }
    const read: ActFacts = (_, event) => event.object === 'title.field' ? 'land' : 'goods'
    expect(evaluateAct([law], act, read)).toHaveLength(1)
    expect(evaluateAct([law], { ...act, object: 'goods.bread' }, read)).toEqual([])
  })
  it('a false condition produces no breach', () => {
    expect(ids([{ ...lawFixture(), condition: { not: true } }])).toEqual([])
  })
  it('any exception that holds prevents a breach', () => {
    const law = lawFixture()
    law.exceptions = [
      { condition: { not: true }, reason: 'Inapplicable exception' },
      { condition: { read: 'holds.permission', op: 'eq', value: true }, reason: 'Permission held' },
    ]
    expect(evaluateAct([law], act, () => true)).toEqual([])
    expect(evaluateAct([law], act, () => false)).toHaveLength(1)
  })
  it('a requirement is breached only by a host-supplied matching omission', () => {
    const law: Law = { ...lawFixture(), modality: 'require', regulated: { action: 'pay', object: 'any' } }
    expect(ids([law], { ...act, action: 'omit:pay' })).toEqual([law.id])
    expect(ids([law], { ...act, action: 'pay' })).toEqual([])
    expect(ids([law], { ...act, action: 'omit:serve' })).toEqual([])
    expect(ids([law])).toEqual([])
  })
  it.each(['permit', 'empower', 'establish'] as const)('%s never produces a breach', modality => {
    const law: Law = modality === 'empower'
      ? { ...lawFixture(), modality, regulated: { action: act.action, object: 'any', power: 'seize' } }
      : { ...lawFixture(), modality, regulated: { action: act.action, object: 'any' } }
    expect(ids([law])).toEqual([])
    expect(applicableLaws([law], act, facts).size).toBe(1)
  })
  it('a rival permit does not cancel another authority prohibition', () => {
    const prohibition = lawFixture('prohibition')
    const permit: Law = { ...lawFixture('permit'), modality: 'permit', regulated: { action: act.action, object: 'any' } }
    permit.jurisdiction.authority = 'office.rival'
    expect(applicableLaws([permit, prohibition], act, facts).size).toBe(2)
    expect(ids([permit, prohibition])).toEqual([prohibition.id])
  })
  it('an uncovered act is lawful with no default prohibition', () => expect(ids([])).toEqual([]))
  it('attempt and success are host facts, with no automatic success requirement', () => {
    const law = lawFixture()
    const attempted = { ...act, succeeded: false }
    expect(ids([law], attempted)).toEqual([law.id])
    law.condition = { read: 'act.succeeded', op: 'eq', value: true }
    expect(evaluateAct([law], attempted, (_, event) => event.succeeded)).toEqual([])
    expect(evaluateAct([law], act, (_, event) => event.succeeded)).toHaveLength(1)
  })
  it('missing owner reads throw instead of inventing facts', () => {
    const law = { ...lawFixture(), condition: { read: 'missing.port', op: 'eq', value: true } } as Law
    expect(() => evaluateAct([law], act, facts)).toThrow(/missing.port.*undefined/)
  })
  it('prescribed sanctions are copied as data without applying them', () => {
    const law = lawFixture()
    law.consequence = { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: null, note: 'Amount unspecified' }] }
    const [breach] = evaluateAct([law], act, facts)
    expect(breach.sanction).toEqual(law.consequence.sanctions)
    breach.sanction![0].note = 'Changed copy'
    expect(law.consequence.sanctions[0].note).toBe('Amount unspecified')
  })
})
