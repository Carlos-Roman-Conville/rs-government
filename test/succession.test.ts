import { describe, expect, it, vi } from 'vitest'
import { Runner, defaultConfig, initialState, stubProviders } from '@rex/settlement'
import { resolveSuccession, successionClaimants, validateLaw, validateLawData } from '../src/index.ts'
import type { ActFacts, Law, SuccessionRule } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { successionStubs } from './stubs.ts'

const office = { id: 'office.crown', place: 'place.seat' }
const holder = 'parent'
const day = 100
const recognises = () => true
function law(succession: SuccessionRule = { rule: 'primogeniture', prefer: 'none' }, slug = 'succession'): Law {
  return { ...lawFixture(slug), modality: 'establish',
    regulated: { action: 'succeed', object: { read: 'object.kind', op: 'eq', value: office.id } }, succession }
}
function family() {
  const data = {
    children: { parent: ['son', 'dead', 'daughter'] },
    persons: {
      dead: { alive: false, born: 1, sex: 'male' },
      daughter: { alive: true, born: 2, sex: 'female' },
      son: { alive: true, born: 3, sex: 'male' },
    },
  }
  const reads = successionStubs(data)
  const facts: ActFacts = (name, act) => name === 'object.kind' ? act.object : reads(name, act)
  return { data, facts }
}
const query = (laws: Law[], facts = family().facts) => successionClaimants(laws, office, holder, day, facts)
const resolve = (laws: Law[], host = { recognises }, facts = family().facts) =>
  resolveSuccession(laws, office, holder, day, facts, host)

describe('succession law schema', () => {
  it.each(['primogeniture', 'appointment', 'election', 'open-contest'] as const)('accepts the %s rule at runtime and in dated data', rule => {
    const value = law({ rule, prefer: 'none', superior: 'office.king', body: 'body.council' })
    expect(validateLaw(value)).toEqual([])
    expect(validateLawData({ ...value, jurisdiction: { ...value.jurisdiction, from: { year: 1200, calendar: 'julian' } } })).toEqual([])
  })

  it('allows an omitted succession field without inventing a rule', () => {
    const { succession: _, ...value } = law()
    expect(validateLaw(value)).toEqual([])
    expect(query([value])).toEqual({ kind: 'unresolved', reason: `succession rule not stated: ${value.id}` })
  })

  it.each([
    ['modality', { modality: 'permit' }, 'succession'],
    ['action', { regulated: { action: 'appoint', object: true } }, 'succession'],
    ['office predicate', { regulated: { action: 'succeed', object: 'any' } }, 'regulated.object'],
    ['rule', { succession: { rule: 'tanistry' } }, 'succession.rule'],
    ['preference', { succession: { rule: 'primogeniture', prefer: 'female' } }, 'succession.prefer'],
    ['superior', { succession: { rule: 'appointment', superior: '' } }, 'succession.superior'],
    ['body', { succession: { rule: 'election', body: null } }, 'succession.body'],
    ['unknown field', { succession: { rule: 'election', winner: 'chosen' } }, 'succession.winner'],
  ])('rejects an invalid %s', (_, fields, path) => {
    expect(validateLaw({ ...law(), ...fields })).toEqual(expect.arrayContaining([expect.stringContaining(`${path}:`)]))
  })
})

describe('direct-child primogeniture', () => {
  it.each([['none', 'daughter'], ['male', 'son']] as const)('uses prefer=%s from the law and skips the dead eldest child', (prefer, person) => {
    const rule = law({ rule: 'primogeniture', prefer })
    expect(query([rule])).toEqual({ kind: 'claimants', claimants: [{ person, law: rule.id, basis: rule.succession }] })
  })

  it('male preference falls back to the eldest living daughter when no living son exists', () => {
    const { data, facts } = family()
    data.persons.son.alive = false
    expect(query([law({ rule: 'primogeniture', prefer: 'male' })], facts)).toMatchObject({ claimants: [{ person: 'daughter' }] })
  })

  it('prefer=none does not read sex', () => {
    const { facts } = family()
    expect(query([law()], (name, act) => {
      if (name === 'person.sex') throw new Error('unneeded sex read')
      return facts(name, act)
    })).toMatchObject({ claimants: [{ person: 'daughter' }] })
  })

  it('missing preference remains unresolved', () => {
    expect(query([law({ rule: 'primogeniture' })])).toMatchObject({ kind: 'unresolved', reason: expect.stringContaining('preference not stated') })
  })

  it.each([{ children: [] }, { children: ['dead'] }])('no living direct child is unresolved rather than vacant ($children)', ({ children }) => {
    const { data, facts } = family()
    data.children.parent = children
    const expected = { kind: 'unresolved', reason: 'no direct heir: representation and collateral heirs not built' }
    expect(query([law()], facts)).toEqual(expected)
    expect(resolve([law()], { recognises }, facts)).toEqual(expected)
  })

  it.each(['kin.children', 'person.alive', 'person.born', 'person.sex'])('unknown %s does not silently select an heir', missing => {
    const { facts } = family()
    expect(query([law({ rule: 'primogeniture', prefer: 'male' })], (name, act) => name === missing ? null : facts(name, act)))
      .toMatchObject({ kind: 'unresolved', reason: expect.stringContaining(missing) })
  })

  it.each([['kin.children', 3], ['person.alive', 'yes'], ['person.born', NaN], ['person.born', 101], ['person.sex', false]])(
    'rejects malformed %s facts', (badRead, value) => {
      const { facts } = family()
      expect(() => query([law({ rule: 'primogeniture', prefer: 'male' })], (name, act) => name === badRead ? value : facts(name, act))).toThrow(badRead)
    })

  it('birth ties retain every claimant in ID order, independent of input order and duplicates', () => {
    const { data, facts } = family()
    data.persons.son.born = data.persons.daughter.born
    data.children.parent.push('daughter')
    const result = query([law()], facts)
    expect(result).toMatchObject({ claimants: [{ person: 'daughter' }, { person: 'son' }] })
    data.children.parent.reverse()
    expect(query([law()], facts)).toEqual(result)
    expect(resolve([law()], { recognises }, facts)).toEqual({ kind: 'contested', office: office.id,
      claimants: result.kind === 'claimants' ? result.claimants : [] })
  })
})

describe('succession applicability and resolution', () => {
  it('one recognised claimant emits a succession event with its law and basis', () => {
    const rule = law()
    expect(resolve([rule])).toEqual({ type: 'government.succession_event', office: office.id,
      successor: 'daughter', basis: rule.succession, law: rule.id })
  })

  it('rejected recognition returns every claimant with no winner or command', () => {
    const rule = law()
    expect(resolve([rule], { recognises: () => false })).toEqual({ kind: 'contested', office: office.id,
      claimants: [{ person: 'daughter', basis: rule.succession, law: rule.id }] })
  })

  it('unknown recognition returns unresolved', () => {
    expect(resolveSuccession([law()], office, holder, day, family().facts, { recognises: () => null }))
      .toEqual({ kind: 'unresolved', reason: 'recognition not supplied' })
  })

  it.each(['appointment', 'election'] as const)('%s uses the host choice without choosing a person itself', rule => {
    const value = law({ rule, superior: 'office.superior', body: 'body.electors' })
    const choice = vi.fn(() => ['chosen'])
    expect(resolveSuccession([value], office, holder, day, family().facts, { recognises, choice }))
      .toEqual({ type: 'government.succession_event', office: office.id, successor: 'chosen', basis: value.succession, law: value.id })
    expect(choice).toHaveBeenCalledWith(value)
    expect(query([value])).toMatchObject({ kind: 'unresolved' })
    expect(resolveSuccession([value], office, holder, day, family().facts, { recognises, choice: () => null }))
      .toMatchObject({ kind: 'unresolved' })
  })

  it('an election with explicitly no candidates emits a vacate command', () => {
    expect(resolveSuccession([law({ rule: 'election' })], office, holder, day, family().facts, { recognises, choice: () => [] }))
      .toEqual({ type: 'settlement.vacate', office: office.id })
  })

  it('a disputed election keeps all host candidates, sorted and unique', () => {
    const rule = law({ rule: 'election' })
    expect(resolveSuccession([rule], office, holder, day, family().facts,
      { recognises, choice: () => ['z', 'a', 'z'] })).toEqual({ kind: 'contested', office: office.id,
      claimants: ['a', 'z'].map(person => ({ person, basis: rule.succession, law: rule.id })) })
  })

  it('open contest remains unresolved without inventing a winner or vacancy', () => {
    expect(resolve([law({ rule: 'open-contest' })])).toMatchObject({ kind: 'unresolved', reason: expect.stringContaining('open contest') })
  })

  it('competing laws preserve every rival claimant and recognition is read per law', () => {
    const a = law({ rule: 'primogeniture', prefer: 'none' }, 'a')
    const b = law({ rule: 'primogeniture', prefer: 'male' }, 'b')
    b.jurisdiction.authority = 'authority.rival'
    b.supersedes = [a.id]
    const recognition = vi.fn(() => true)
    const result = resolve([b, a], { recognises: recognition })
    expect(result).toEqual({ kind: 'contested', office: office.id, claimants: [
      { person: 'daughter', law: a.id, basis: a.succession }, { person: 'son', law: b.id, basis: b.succession },
    ] })
    expect(recognition.mock.calls).toEqual([[a], [b]])
    expect(resolve([a, b])).toEqual(result)
  })

  it('multiple laws supporting the same person do not create a rival', () => {
    expect(resolve([law(undefined, 'z'), law(undefined, 'a')])).toMatchObject({ type: 'government.succession_event', law: 'government/law.a' })
  })

  it.each(['status', 'from', 'until', 'place', 'person', 'object', 'condition', 'exception', 'action'])(
    'filters laws by %s and does not vacate when no rule applies', field => {
      const value = law()
      if (field === 'status') value.status = 'suspended'
      if (field === 'from') value.jurisdiction.from = day + 1
      if (field === 'until') value.jurisdiction.until = day
      if (field === 'place') value.jurisdiction.places = ['elsewhere']
      if (field === 'person') value.jurisdiction.persons = { not: true }
      if (field === 'object') value.regulated.object = { not: true }
      if (field === 'condition') value.condition = { not: true }
      if (field === 'exception') value.exceptions = [{ condition: true, reason: 'fixture' }]
      if (field === 'action') value.regulated.action = 'other'
      expect(resolve([value])).toEqual({ kind: 'unresolved', reason: 'no applicable succession law' })
    })

  it('a same-authority replacement of any modality suppresses the old succession law', () => {
    const old = law()
    const replacement = lawFixture('replacement')
    replacement.supersedes = [old.id]
    expect(query([old, replacement])).toEqual({ kind: 'unresolved', reason: 'no applicable succession law' })
  })

  it('predicate and kinship reads identify their subjects and query day', () => {
    const { facts } = family()
    const read = vi.fn(facts)
    query([law()], read)
    expect(read).toHaveBeenCalledWith('object.kind', { actor: holder, action: 'succeed', object: office.id,
      place: office.place, day, attempted: false, succeeded: false })
    expect(read).toHaveBeenCalledWith('kin.children', expect.objectContaining({ object: holder, day }))
    expect(read).toHaveBeenCalledWith('person.alive', expect.objectContaining({ object: 'dead', day }))
    expect(read).not.toHaveBeenCalledWith('person.born', expect.objectContaining({ object: 'dead' }))
  })

  it('leaves Settlement state, laws and provider data unchanged until the host executes appoint', () => {
    const runner = new Runner(initialState('stl.succession', 'test'), defaultConfig(), stubProviders())
    const id = runner.run<string>({ type: 'createOffice', name: 'Crown', powers: [] })
    runner.run({ type: 'appoint', office: id, holder })
    const { data, facts } = family()
    const value = law()
    value.regulated.object = true
    const before = structuredClone({ state: runner.state, log: runner.log, events: runner.events, value, data })
    const result = resolveSuccession([value], { id, place: office.place }, holder, day, facts, { recognises })
    expect({ state: runner.state, log: runner.log, events: runner.events, value, data }).toEqual(before)
    expect(result).toMatchObject({ type: 'government.succession_event' })
    if ('type' in result && result.type === 'government.succession_event') {
      result.basis.prefer = 'male'
      expect(value).toEqual(before.value)
      runner.run({ type: 'appoint', office: result.office, holder: result.successor })
      expect(runner.state.offices[id].holder).toBe('daughter')
    }
  })
})
