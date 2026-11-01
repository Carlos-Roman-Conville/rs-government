import { describe, expect, it } from 'vitest'
import { delegationChain, distribution } from '../src/index.ts'
import type { ActFacts, AuthorityClaimants, Law } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { authorityStubs } from './stubs.ts'

function fixture() {
  const recipients: Record<string, string[]> = {}
  const places: Record<string, string> = { subject: 'town', outsider: 'elsewhere' }
  const grant = (actor: string, issuer = actor, domain = 'tax', slug = actor): Law => {
    const law: Law = { ...lawFixture(slug), issuer, modality: 'empower',
      regulated: { action: 'levy', object: 'any', power: domain },
      condition: { read: 'actor.id', op: 'eq', value: actor } }
    recipients[law.id] = [actor]
    return law
  }
  const facts: ActFacts = (name, act) => {
    if (name === 'law.empowered-actors') return recipients[act.object!]
    if (name === 'person.place') return places[act.object!]
    if (name === 'actor.id') return act.actor
    if (name === 'subject.id') return act.object
    return undefined
  }
  const data = {
    beliefs: {
      subject: { lord: { tax: 1 }, reeve: { tax: 1 }, rebel: { tax: 1 } },
      outsider: { lord: { tax: 1 }, reeve: { tax: 1 }, rebel: { tax: 1 } },
      guard: { lord: { tax: 1 } }, bailiff: { reeve: { tax: 1 } }, fighter: { rebel: { tax: 1 } },
    },
    weights: { subject: 1, outsider: 1 }, capacities: { guard: 20, bailiff: 10, fighter: 30 },
    agents: { lord: ['guard'], reeve: ['bailiff'], rebel: ['fighter'] },
    populations: { town: ['subject'] },
  }
  const readers = authorityStubs(data)
  const run = (laws: Law[], actors = ['lord', 'reeve'], claimants?: AuthorityClaimants) =>
    distribution(laws, actors, ['tax'], 'town', 10, readers, facts, undefined, claimants)
  return { grant, facts, data, run, recipients, places }
}

describe('authority rivals and places', () => {
  it('an undated delegation is active before day zero until its exclusive end', () => {
    const { grant, facts } = fixture()
    const law = grant('reeve', 'lord')
    law.jurisdiction.from = null
    law.jurisdiction.until = -10
    expect(delegationChain([law], 'lord', -1000, facts)).toEqual(['reeve'])
    expect(delegationChain([law], 'lord', -11, facts)).toEqual(['reeve'])
    expect(delegationChain([law], 'lord', -10, facts)).toEqual([])
    law.jurisdiction.until = null
    expect(delegationChain([law], 'lord', -1000, facts)).toEqual(['reeve'])
  })
  it('a lord and the reeve he empowered exclude each other from rival backing', () => {
    const { grant, run, facts } = fixture()
    const laws = [grant('lord'), grant('reeve', 'lord')]
    expect(delegationChain(laws, 'lord', 10, facts)).toEqual(['reeve'])
    expect(delegationChain(laws, 'reeve', 10, facts)).toEqual(['lord'])
    expect(run(laws).map(row => [row.actor, row.J, row.C_opp])).toEqual([
      ['lord', 1, 0], ['reeve', 1, 0],
    ])
    expect(run(laws, undefined, { tax: ['reeve', 'lord'] }).map(row => row.C_opp)).toEqual([0, 0])
  })

  it('independent claimants of the same domain over the same person are rivals', () => {
    const { grant, run } = fixture()
    const rows = run([grant('lord'), grant('reeve')])
    expect(rows.map(row => [row.actor, row.C_opp])).toEqual([['lord', 10], ['reeve', 20]])
  })

  it('a host-named claimant without a grant counts even when absent from output actors', () => {
    const { grant, run } = fixture()
    const laws = [grant('lord'), grant('reeve')]
    expect(run(laws, ['lord'], { tax: ['rebel', 'rebel', 'lord'] })[0]).toMatchObject({ J: 1, C_opp: 30 })
    expect(run(laws, ['lord'], { arms: ['rebel'] })[0].C_opp).toBe(0)
  })

  it('a person outside a law\'s places has J = 0 even when the jurisdiction ID matches', () => {
    const { grant, run, data } = fixture()
    data.populations.town = ['subject', 'outsider']
    const law = grant('lord')
    law.jurisdiction.places = ['town']
    expect(run([law], ['lord']).map(row => [row.person, row.J])).toEqual([
      ['outsider', 0], ['subject', 1],
    ])
  })

  it('supplied actors without a grant for the same domain and person are not rivals', () => {
    const { grant, run, data } = fixture()
    data.populations.town = ['subject', 'outsider']
    const lord = grant('lord'), reeve = grant('reeve'), rebel = grant('rebel', 'rebel', 'arms')
    reeve.regulated.object = { read: 'subject.id', op: 'eq', value: 'subject' }
    const rows = run([lord, reeve, rebel], ['lord', 'reeve', 'rebel']).filter(row => row.actor === 'lord')
    expect(rows.map(row => [row.person, row.C_opp])).toEqual([['outsider', 0], ['subject', 10]])
    expect(run([lord], ['lord', 'reeve', 'rebel'])[0].C_opp).toBe(0)
  })

  it('rival backing is the maximum among eligible claimants, not their sum', () => {
    const { grant, run } = fixture()
    expect(run([grant('lord'), grant('reeve'), grant('rebel')], ['rebel', 'reeve', 'lord'])[0].C_opp).toBe(30)
  })

  it('delegation is transitive, bidirectional, sorted and cycle-safe through actors absent from rows', () => {
    const { grant, facts, run } = fixture()
    const laws = [grant('lord', 'king'), grant('reeve', 'lord'), grant('king', 'reeve')]
    expect(delegationChain(laws, 'reeve', 10, facts)).toEqual(['king', 'lord'])
    expect(delegationChain([...laws].reverse(), 'king', 10, facts)).toEqual(['lord', 'reeve'])
    expect(run(laws).map(row => row.C_opp)).toEqual([0, 0])
    expect(delegationChain(laws, 'unrelated', 10, facts)).toEqual([])
  })

  it('delegation observes force dates, status and non-empower supersession', () => {
    const { grant, facts } = fixture()
    const law = grant('reeve', 'lord')
    law.jurisdiction.from = 10
    law.jurisdiction.until = 20
    expect(delegationChain([law], 'lord', 9, facts)).toEqual([])
    expect(delegationChain([law], 'lord', 10, facts)).toEqual(['reeve'])
    expect(delegationChain([law], 'lord', 20, facts)).toEqual([])
    for (const status of ['suspended', 'repealed'] as const) {
      expect(delegationChain([{ ...law, status }], 'lord', 10, facts)).toEqual([])
    }
    const replacement = { ...lawFixture('replacement'), issuer: law.issuer, supersedes: [law.id] }
    expect(delegationChain([law, replacement], 'lord', 10, facts)).toEqual([])
    expect(delegationChain([law, { ...replacement, issuer: 'other' }], 'lord', 10, facts)).toEqual(['reeve'])
  })

  it('delegation resolves host-owned recipients without inferring IDs from office predicates', () => {
    const { grant, facts, recipients } = fixture()
    const law = grant('reeve', 'lord')
    law.condition = { read: 'actor.office', op: 'eq', value: 'office.reeve' }
    recipients[law.id] = ['holder-b', 'holder-a', 'holder-a']
    const contexts: unknown[] = []
    expect(delegationChain([law], 'lord', 10, (name, act) => {
      contexts.push([name, { ...act }])
      return facts(name, act)
    })).toEqual(['holder-a', 'holder-b'])
    expect(contexts).toEqual([['law.empowered-actors', { actor: 'lord', object: law.id,
      action: 'levy', place: '', day: 10, attempted: false, succeeded: false }]])
  })

  it('missing places and unresolved delegation recipients fail explicitly', () => {
    const { grant, run, recipients, places } = fixture()
    const law = grant('lord')
    delete places.subject
    expect(() => run([law], ['lord'])).toThrow(/person.place/)
    delete recipients[law.id]
    expect(() => run([law], ['lord'])).toThrow(/law.empowered-actors/)
  })
})
