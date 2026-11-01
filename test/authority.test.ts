import { describe, expect, it } from 'vitest'
import { backing, deJure, distribution, effectiveAuthority, provisionalF, recognition, strongestRival } from '../src/index.ts'
import type { ActFacts, AuthorityFormula, AuthorityInputs, Law } from '../src/index.ts'
import { authorityStubs } from './stubs.ts'
import type { AuthorityStubData } from './stubs.ts'
import { lawFixture } from './law-fixture.ts'

function grant(actor = 'crown', domain = 'tax', slug = actor): Law {
  return { ...lawFixture(slug), issuer: actor, modality: 'empower',
    regulated: { action: 'levy', object: 'any', power: domain },
    condition: { read: 'actor.id', op: 'eq', value: actor } }
}
const facts: ActFacts = (name, act) => {
  if (name === 'person.place') return 'town'
  if (name === 'law.empowered-actors') return [act.actor]
  if (name === 'actor.id') return act.actor
  if (name === 'subject.id') return act.object
  if (name === 'actor.is-office-holder') return act.actor === 'crown'
  return undefined
}
function fixture() {
  const data: AuthorityStubData = {
    beliefs: {
      subject: { crown: { tax: 0.8 }, rival: { tax: 0.4 } },
      guard: { crown: { tax: 1 } },
      opponent: { rival: { tax: 1 } },
    },
    weights: { subject: 1 }, capacities: { guard: 20, opponent: 10 },
    agents: { crown: ['guard'], rival: ['opponent'] }, populations: { town: ['subject'] },
  }
  const readers = authorityStubs(data)
  const laws = [grant(), grant('rival')]
  const run = (f?: AuthorityFormula) => distribution(laws, ['rival', 'crown'], ['tax'], 'town', 10, readers, facts, f)
  return { data, readers, laws, run }
}

describe('computed authority', () => {
  it('occupation with low recognition and high backing retains positive authority', () => {
    const { data, run } = fixture()
    data.beliefs.subject.crown.tax = 0.05
    data.capacities.guard = 1000
    const [row] = run()
    expect(row.R).toBe(0.05)
    expect(row.C).toBe(1000)
    expect(row.A).toBeCloseTo(0.05 * 1000 / 1010)
    expect(row.A).toBeGreaterThan(0)
  })
  it('a respected but powerless actor has zero authority', () => {
    const { data, run } = fixture()
    data.beliefs.subject.crown.tax = 1
    data.capacities.guard = 0
    expect(run()[0]).toMatchObject({ R: 1, C: 0, A: 0 })
  })
  it('conquest raising backing above the strongest rival raises authority with recognition unchanged', () => {
    const { data, run } = fixture()
    data.capacities.guard = 5
    const before = run()[0]
    data.capacities.guard = 30
    const after = run()[0]
    expect(before.C).toBeLessThan(before.C_opp)
    expect(after.C).toBeGreaterThan(after.C_opp)
    expect(after.R).toBe(before.R)
    expect(after.A).toBeGreaterThan(before.A!)
  })
  it('resource weights let a small armed coalition outweigh an unarmed majority', () => {
    const { data, readers } = fixture()
    data.weights.guard = 100
    const persons = ['guard']
    for (let i = 0; i < 10; i++) {
      const person = `civilian-${i}`
      persons.push(person)
      data.beliefs[person] = { crown: { tax: 0 } }
      data.weights[person] = 1
    }
    expect(recognition('crown', 'tax', persons, readers).R).toBeCloseTo(100 / 110)
  })
  it('no empower law means zero authority despite recognition and backing', () => {
    const { laws, run } = fixture()
    laws.splice(0, 1)
    expect(run()[0]).toMatchObject({ J: 0, A: 0, R: 0.8, C: 20 })
  })
  it('persons with no belief are excluded from recognition rather than counted as zero', () => {
    const { data, run } = fixture()
    data.populations.town = ['unknown', 'subject']
    data.weights.unknown = 10000
    expect(run().filter(row => row.actor === 'crown').map(row => row.R)).toEqual([0.8, 0.8])
  })
  it('no beliefs at all yields null recognition and authority with an explicit flag', () => {
    const { data, run } = fixture()
    data.beliefs = {}
    const [row] = run()
    expect(row).toMatchObject({ R: null, A: null })
    expect(row.flags).toContainEqual({ kind: 'no-weighted-belief', actor: 'crown', domain: 'tax' })
  })
  it('renaming an actor and its display label changes no causal result', () => {
    const { data, laws, readers, run } = fixture()
    const actor = { id: 'crown', label: 'King' }
    const before = run()[0]
    actor.id = 'assembly'
    actor.label = 'Republic'
    for (const beliefs of Object.values(data.beliefs)) {
      if (beliefs.crown) { beliefs[actor.id] = beliefs.crown; delete beliefs.crown }
    }
    data.agents[actor.id] = data.agents.crown
    delete data.agents.crown
    laws[0] = grant(actor.id)
    const after = distribution(laws, [actor.id, 'rival'], ['tax'], 'town', 10, readers, facts)[0]
    expect(after).toEqual({ ...before, actor: actor.id })
  })
  it('swapping the provisional hypothesis changes only authority and the formula id', () => {
    const { run } = fixture()
    const alternative: AuthorityFormula = Object.assign(({ J, R }: Readonly<AuthorityInputs>) => J * R!, { id: 'test.recognition-only', provisional: true })
    const before = run(), after = run(alternative)
    expect(provisionalF.provisional).toBe(true)
    expect(after[0].A).not.toBe(before[0].A)
    expect(after.map(({ A, f, ...inputs }) => inputs)).toEqual(before.map(({ A, f, ...inputs }) => inputs))
    expect(after[0].f).toBe(alternative.id)
  })
  it('two calls are equal, mutate no inputs, and retain neither results nor provider values', () => {
    const { data, laws, run } = fixture()
    const snapshot = structuredClone({ data, laws })
    const first = run(), second = run()
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect({ data, laws }).toEqual(snapshot)
    first[0].A = 999
    first[0].flags.push({ kind: 'no-weighted-belief', actor: 'fake', domain: 'fake' })
    expect(run()).toEqual(second)
    data.beliefs.subject.crown.tax = 0.2
    expect(run()[0].R).toBe(0.2)
    expect(run()[0].A).not.toBe(second[0].A)
  })
  it('zero total backing yields zero authority without division by zero', () => {
    expect(effectiveAuthority({ J: 1, R: 1, C: 0, C_opp: 0 })).toBe(0)
  })
  it('zero-weight beliefs are flagged as no weighted belief, while a real zero belief is retained', () => {
    const { data, readers } = fixture()
    data.weights.subject = 0
    expect(recognition('crown', 'tax', ['subject'], readers)).toMatchObject({ R: null, flags: [{ kind: 'no-weighted-belief' }] })
    data.weights.subject = 1
    data.beliefs.subject.crown.tax = 0
    expect(recognition('crown', 'tax', ['subject'], readers)).toEqual({ R: 0, flags: [] })
  })
  it('agent backing uses their own loyalty and lists each missing belief', () => {
    const { data, readers, run } = fixture()
    data.agents.crown = ['unknown', 'guard', 'guard']
    data.beliefs.guard.crown.tax = 0.25
    expect(backing('crown', 'tax', readers)).toEqual({ C: 5, flags: [
      { kind: 'missing-agent-belief', actor: 'crown', domain: 'tax', person: 'unknown' },
    ] })
    expect(run()[1].flags).toContainEqual({ kind: 'missing-agent-belief', actor: 'crown', domain: 'tax', person: 'unknown' })
  })
  it('the strongest rival is the maximum backing, excludes self, and defaults to zero for no rivals', () => {
    const { data, readers } = fixture()
    data.agents.other = ['third']
    data.capacities.third = 8
    data.beliefs.third = { other: { tax: 1 } }
    expect(strongestRival('crown', 'tax', ['crown', 'other', 'rival', 'rival'], readers)).toBe(10)
    expect(strongestRival('crown', 'tax', ['crown'], readers)).toBe(0)
  })
  it('rows are sorted by actor, domain, then subject and duplicate provider IDs never double count', () => {
    const { data, readers, laws } = fixture()
    data.populations.town = ['z', 'subject', 'z']
    const rows = distribution(laws, ['rival', 'crown', 'crown'], ['tax', 'arms', 'tax'], 'town', 10, readers, facts)
    expect(rows.map(row => `${row.actor}/${row.domain}/${row.person}`)).toEqual([
      'crown/arms/subject', 'crown/arms/z', 'crown/tax/subject', 'crown/tax/z',
      'rival/arms/subject', 'rival/arms/z', 'rival/tax/subject', 'rival/tax/z',
    ])
    expect(recognition('crown', 'tax', ['subject', 'subject'], readers).R).toBe(0.8)
  })
  it('empty populations yield no subject relations and standalone recognition is unknown', () => {
    const { data, readers, run } = fixture()
    data.populations.town = []
    expect(run()).toEqual([])
    expect(recognition('crown', 'tax', [], readers).R).toBeNull()
  })
  it.each([-1, 1.1, NaN, Infinity])('invalid provider probability %s is rejected', value => {
    const { data, run } = fixture()
    data.beliefs.subject.crown.tax = value
    expect(run).toThrow(/recognition/)
  })
  it.each([-1, NaN, Infinity])('invalid provider resource or capacity %s is rejected', value => {
    const { data, run } = fixture()
    data.weights.subject = value
    expect(run).toThrow(/weight/)
    data.weights.subject = 1
    data.capacities.guard = value
    expect(run).toThrow(/capacity/)
  })
})

describe('de jure authority', () => {
  const subject = { id: 'subject', place: 'town' }
  const read = (laws: Law[], actor = 'crown', domain = 'tax', day = 10) => deJure(laws, actor, domain, subject, day, facts)
  it('empower predicates identify the beneficiary rather than automatically granting power to the issuer', () => {
    expect(read([grant()])).toBe(1)
    expect(read([grant()], 'rival')).toBe(0)
    expect(read([grant()], 'fixture')).toBe(0)
    expect(read([grant()], 'crown', 'arms')).toBe(0)
    expect(read([lawFixture()])).toBe(0)
  })
  it('force dates, place, person predicates and law status govern legal authority', () => {
    const law = grant()
    law.jurisdiction = { ...law.jurisdiction, from: 10, until: 20, places: ['town'],
      persons: { read: 'actor.is-office-holder', op: 'eq', value: true } }
    expect(read([law], 'crown', 'tax', 9)).toBe(0)
    expect(read([law])).toBe(1)
    expect(read([law], 'crown', 'tax', 20)).toBe(0)
    expect(read([law], 'rival')).toBe(0)
    law.jurisdiction.places = ['elsewhere']
    expect(read([law])).toBe(0)
    law.jurisdiction.places = 'all'
    for (const status of ['suspended', 'repealed'] as const) expect(read([{ ...law, status }])).toBe(0)
  })
  it('superseding laws are considered even when they are not empowerment laws', () => {
    const law = grant(), replacement = { ...lawFixture('replacement'), issuer: law.issuer }
    replacement.supersedes = [law.id]
    expect(read([law, replacement])).toBe(0)
    expect(read([replacement, law])).toBe(0)
  })
  it('object conditions and exceptions restrict empowerment over a specific subject', () => {
    const { laws, data, run } = fixture()
    laws[0].regulated.object = { read: 'subject.id', op: 'eq', value: 'subject' }
    data.populations.town = ['subject', 'outsider']
    expect(run().filter(row => row.actor === 'crown').map(row => [row.person, row.J])).toEqual([
      ['outsider', 0], ['subject', 1],
    ])
    laws[0].exceptions = [{ condition: true, reason: 'Fixture exemption' }]
    expect(read(laws)).toBe(0)
  })
  it('missing law facts fail explicitly rather than inventing legal authority', () => {
    expect(() => deJure([grant()], 'crown', 'tax', subject, 10, () => undefined)).toThrow(/actor.id.*undefined/)
  })
  it('jurisdiction and conditions read the same hypothetical exercise of the named power', () => {
    const law = grant()
    law.jurisdiction.persons = { read: 'act.action', op: 'eq', value: 'levy' }
    const contexts: unknown[] = []
    const readFacts: ActFacts = (name, act) => {
      contexts.push({ ...act })
      return name === 'act.action' ? act.action : facts(name, act)
    }
    expect(deJure([law], 'crown', 'tax', subject, 10, readFacts)).toBe(1)
    expect(contexts).toEqual(Array(2).fill({ actor: 'crown', action: 'levy', object: 'subject',
      place: 'town', day: 10, attempted: false, succeeded: false }))
  })
})
