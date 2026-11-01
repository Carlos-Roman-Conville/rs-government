import { describe, expect, it } from 'vitest'
import { createAuthorityProvider, defaultAuthorityProvider } from '../src/index.ts'
import type { ActFacts, Law } from '../src/index.ts'
import kernel from '../kernel.json'
import { lawFixture } from './law-fixture.ts'

function grant(office = 'reeve', power = 'seize', slug = `${office}-${power}`): Law {
  return {
    ...lawFixture(slug), modality: 'empower',
    jurisdiction: { authority: 'council', places: ['town'], persons: 'all', from: 5, until: 15 },
    regulated: { action: `exercise:${power}`, object: 'any', power },
    condition: { read: 'actor.office', op: 'eq', value: `office.${office}` },
  }
}

function fixture(laws: Law[] = [grant()]) {
  const data = {
    offices: {
      reeve: { seat: 'town', grantId: 'office.reeve', holder: null as string | null, powers: ['seize'] },
      council: { seat: 'town', grantId: 'office.council', holder: 'mayor', powers: ['public-title', 'permit'] },
      clerk: { seat: 'town', grantId: 'office.clerk', holder: null, powers: [] },
    },
    places: { resident: 'town', outsider: 'forest' },
    exempt: false,
  }
  const facts: ActFacts = (name, act) => {
    if (name === 'office.seat') return data.offices[act.actor as keyof typeof data.offices]?.seat
    if (name === 'person.place') return data.places[act.object as keyof typeof data.places]
    if (name === 'subject.id') return act.object
    if (name === 'subject.is-null') return act.object === null
    if (name === 'subject.exempt') return data.exempt
    if (name === 'act.action') return act.action
    if (name === 'act.place') return act.place
    if (name === 'act.attempted') return act.attempted
    if (name === 'act.succeeded') return act.succeeded
    throw new Error(`Unexpected fact read: ${name}`)
  }
  const officeOf = (office: string) => data.offices[office as keyof typeof data.offices]?.grantId ?? null
  return { laws, data, facts, officeOf, provider: createAuthorityProvider(laws, facts, officeOf) }
}

describe('Settlement authority provider', () => {
  it('an empower grant confers its power on the named office', () => {
    const { provider } = fixture()
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
    expect(provider.may('council', 'seize', 'resident', 10)).toBe(false)
    expect(provider.may('reeve', 'permit', 'resident', 10)).toBe(false)
  })

  it('no law grants no power', () => {
    expect(fixture([]).provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('a permit law does not confer an office power', () => {
    const law: Law = { ...lawFixture(), modality: 'permit', regulated: { action: 'seize', object: 'any' } }
    expect(fixture([law]).provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('the in-force window includes from and excludes until', () => {
    const { provider } = fixture()
    for (const [day, expected] of [[4, false], [5, true], [14, true], [15, false]] as const) {
      expect(provider.may('reeve', 'seize', 'resident', day)).toBe(expected)
    }
  })

  it.each(['repealed', 'suspended'] as const)('a %s grant confers no power', status => {
    expect(fixture([{ ...grant(), status }]).provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('an active non-empower replacement supersedes a grant', () => {
    const law = grant()
    const replacement: Law = { ...lawFixture('replacement'), jurisdiction: { ...law.jurisdiction },
      supersedes: [law.id] }
    const { provider } = fixture([law, replacement])
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
    replacement.status = 'repealed'
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
  })

  it('a rival jurisdiction cannot supersede the granting authority', () => {
    const law = grant()
    const rival: Law = { ...lawFixture('rival'), supersedes: [law.id] }
    expect(fixture([law, rival]).provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
  })

  it('jurisdiction is checked at the subject place even when the office seat is covered', () => {
    expect(fixture().provider.may('reeve', 'seize', 'outsider', 10)).toBe(false)
  })

  it('a null subject is checked at the office seat and stays null in predicates', () => {
    const law = grant()
    law.regulated.object = { read: 'subject.is-null', op: 'eq', value: true }
    const { provider, data } = fixture([law])
    expect(provider.may('reeve', 'seize', null, 10)).toBe(true)
    data.offices.reeve.seat = 'forest'
    expect(provider.may('reeve', 'seize', null, 10)).toBe(false)
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('a subject in the jurisdiction can be covered when the office seat is outside it', () => {
    const { provider, data } = fixture()
    data.offices.reeve.seat = 'forest'
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
  })

  it('personal jurisdiction can exclude an otherwise covered subject', () => {
    const law = grant()
    law.jurisdiction.persons = { read: 'subject.id', op: 'eq', value: 'other-person' }
    expect(fixture([law]).provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('a false condition prevents the grant', () => {
    const law = grant()
    law.condition = { all: [law.condition, { not: true }] }
    expect(fixture([law]).provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('a holding exception prevents the grant', () => {
    const law = grant()
    law.exceptions = [{ condition: { read: 'subject.exempt', op: 'eq', value: true }, reason: 'Fixture exemption' }]
    const { provider, data } = fixture([law])
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
    data.exempt = true
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(false)
  })

  it('one applicable grant suffices even when another grant has an exception', () => {
    const excepted = grant('reeve', 'seize', 'excepted')
    excepted.exceptions = [{ condition: true, reason: 'Fixture exception' }]
    expect(fixture([excepted, grant()]).provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
  })

  it('facts see a hypothetical exercise of the grant action at the resolved place', () => {
    const law = grant()
    law.condition = { all: [law.condition,
      { read: 'act.action', op: 'eq', value: 'exercise:seize' },
      { read: 'act.place', op: 'eq', value: 'town' },
      { read: 'act.attempted', op: 'eq', value: false },
      { read: 'act.succeeded', op: 'eq', value: false },
    ] }
    expect(fixture([law]).provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
  })

  it('vacancy and the holder do not affect an office grant', () => {
    const { provider, data } = fixture()
    expect(data.offices.reeve.holder).toBeNull()
    expect(provider.may('reeve', 'seize', null, 10)).toBe(true)
    data.offices.reeve.holder = 'new-reeve'
    expect(provider.may('reeve', 'seize', null, 10)).toBe(true)
  })

  it('an unknown office has no grant and requires no holder or location read', () => {
    expect(fixture().provider.may('unknown', 'seize', null, 10)).toBe(false)
  })

  it('the same call twice returns the same answer and changes no law or owner state', () => {
    const { provider, laws, data } = fixture()
    const before = structuredClone({ laws, data })
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
    expect(provider.may('reeve', 'seize', 'resident', 10)).toBe(true)
    expect({ laws, data }).toEqual(before)
  })

  it.each([null, 'resident'])('missing location reads for subject %s fail explicitly', subject => {
    const provider = createAuthorityProvider([grant()], () => undefined, office => office)
    expect(() => provider.may('reeve', 'seize', subject, 10)).toThrow(subject === null ? /office.seat/ : /person.place/)
  })

  it('missing predicate reads fail explicitly', () => {
    const law = grant()
    law.condition = { read: 'missing.read', op: 'eq', value: true }
    const provider = createAuthorityProvider([law], name => name === 'person.place' ? 'town' : undefined, office => office)
    expect(() => provider.may('reeve', 'seize', 'resident', 10)).toThrow(/missing.read.*undefined/)
  })

  it('the setup default and matching grants agree on every office and Settlement power', () => {
    const offices = [
      { id: 'reeve', powers: ['seize'] },
      { id: 'council', powers: ['public-title', 'permit'] },
      { id: 'clerk', powers: [] },
    ]
    const laws = offices.flatMap(office => office.powers.map(power => grant(office.id, power)))
    const { provider } = fixture(laws)
    const fallback = defaultAuthorityProvider(offices)
    const before = structuredClone(offices)
    for (const office of offices) {
      for (const power of ['public-title', 'seize', 'permit', 'not-granted']) {
        const expected = office.powers.includes(power)
        expect(provider.may(office.id, power, 'resident', 10)).toBe(expected)
        expect(fallback.may(office.id, power, 'resident', 10)).toBe(expected)
        expect(fallback.may(office.id, power, null, -100)).toBe(expected)
      }
    }
    expect(fallback.may('unknown', 'seize', null, 10)).toBe(false)
    expect(offices).toEqual(before)
  })

  it('declares office_may as the acquisition and delegation output with unit 1', () => {
    expect(kernel.ports).toContainEqual({ mechanism: 'government.authority.acquisition_delegation',
      quantity: 'government.office_may', unit: '1', direction: 'out' })
  })
})
