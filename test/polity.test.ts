import { describe, expect, it } from 'vitest'
import { checkLaws, enact, evaluateAct, polities, treaties, validateLaw, validateLawData } from '../src/index.ts'
import type { ActFacts, AuthorityFormula, Law, PolityFacts } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { authorityStubs } from './stubs.ts'
import type { AuthorityStubData } from './stubs.ts'

function grant(issuer: string, recipient = issuer): Law {
  return { ...lawFixture(`${issuer}-${recipient}`), issuer, modality: 'empower',
    jurisdiction: { ...lawFixture().jurisdiction, authority: issuer },
    regulated: { action: 'levy', object: 'any', power: 'tax' },
    condition: { read: 'actor.id', op: 'eq', value: recipient },
    sources: [{ key: 'test', title: 'Synthetic test grant', year: null, locator: null }] }
}

function fixture() {
  const actors = ['king', 'lord-a', 'lord-b', 'rival']
  const laws = [...actors.map(actor => grant(actor)), grant('king', 'lord-a'), grant('king', 'lord-b')]
  const data: AuthorityStubData = {
    beliefs: {}, weights: { subject: 1 }, capacities: {}, agents: {},
    populations: { 'jurisdiction-a': ['subject'], 'jurisdiction-b': ['subject'], 'jurisdiction-rival': ['subject'] },
  }
  data.beliefs.subject = {}
  for (const actor of actors) {
    data.beliefs.subject[actor] = { tax: 1 }
    data.beliefs[`guard-${actor}`] = { [actor]: { tax: 1 } }
    data.capacities[`guard-${actor}`] = 10
    data.agents[actor] = [`guard-${actor}`]
  }
  const actFacts: ActFacts = (name, act) => {
    if (name === 'actor.id') return act.actor
    if (name === 'person.place') return 'shared-town'
    if (name === 'law.empowered-actors') {
      const law = laws.find(law => law.id === act.object)!
      return typeof law.condition === 'object' && 'value' in law.condition ? [law.condition.value] : []
    }
    throw new Error(`Unexpected fact: ${name}`)
  }
  const facts: PolityFacts = {
    jurisdictions: [
      { id: 'jurisdiction-b', authority: 'lord-b', domains: ['tax'] },
      { id: 'jurisdiction-a', authority: 'lord-a', domains: ['tax'] },
    ], readers: authorityStubs(data), actFacts,
  }
  return { laws, data, facts, run: () => polities(laws, 10, facts) }
}

describe('polity structure is a read of the authority graph', () => {
  it('two lords empowered by one king resolve to one polity', () => {
    const { run } = fixture()
    expect(run().polities).toEqual([{ apex: 'king', jurisdictions: ['jurisdiction-a', 'jurisdiction-b'],
      territory: ['shared-town'] }])
    expect(run().unresolved).toEqual([])
  })

  it('removing the empower law splits the polity on the next read', () => {
    const { laws, run } = fixture()
    laws.splice(laws.findIndex(law => law.id === 'government/law.king-lord-a'), 1)
    expect(run().polities.map(({ apex, jurisdictions }) => ({ apex, jurisdictions }))).toEqual([
      { apex: 'king', jurisdictions: ['jurisdiction-b'] },
      { apex: 'lord-a', jurisdictions: ['jurisdiction-a'] },
    ])
  })

  it('territorial ties list both apexes without an ID-based winner', () => {
    const { facts, run } = fixture()
    facts.jurisdictions = [...facts.jurisdictions,
      { id: 'jurisdiction-rival', authority: 'rival', domains: ['tax'] }]
    const read = run()
    expect(read.polities.map(p => [p.apex, p.territory])).toEqual([
      ['king', ['shared-town']], ['rival', ['shared-town']],
    ])
    expect(read.territory.every(row => row.apexes?.join(',') === 'king,rival')).toBe(true)
  })

  it('changing recognition changes territory without a polity event or stored value', () => {
    const { data, facts, run } = fixture()
    facts.jurisdictions = [...facts.jurisdictions,
      { id: 'jurisdiction-rival', authority: 'rival', domains: ['tax'] }]
    data.beliefs.subject.king.tax = 0.2
    expect(run().polities.map(p => [p.apex, p.territory])).toEqual([
      ['king', []], ['rival', ['shared-town']],
    ])
    data.beliefs.subject.rival.tax = 0.1
    expect(run().polities[0].territory).toEqual(['shared-town'])
  })

  it('unknown authority leaves the territorial maximum unassigned with a note', () => {
    const { data, facts, run } = fixture()
    facts.jurisdictions = [...facts.jurisdictions,
      { id: 'jurisdiction-rival', authority: 'rival', domains: ['tax'] }]
    data.beliefs.subject.rival.tax = null
    expect(run().polities.every(p => p.territory.length === 0)).toBe(true)
    expect(run().territory.every(row => row.apexes === null && row.note !== null)).toBe(true)
  })

  it('territory uses deJure applicability, not just recognition and backing', () => {
    const { laws, data, facts, run } = fixture()
    facts.jurisdictions = [...facts.jurisdictions,
      { id: 'jurisdiction-rival', authority: 'rival', domains: ['tax'] }]
    data.beliefs.subject.rival.tax = 0.5
    expect(run().territory[0].apexes).toEqual(['king'])
    const grant = laws.find(law => law.id === 'government/law.king-king')!
    grant.jurisdiction.places = ['elsewhere']
    expect(run().territory[0].apexes).toEqual(['rival'])
    grant.jurisdiction.places = 'all'
    const formula: AuthorityFormula = Object.assign(({ J, R }: { J: 0 | 1; R: number | null }) => J * (1 - R!),
      { id: 'test.alternative', provisional: true })
    facts.formula = formula
    expect(run().territory[0].apexes).toEqual(['rival'])
  })

  it('keeps different domain winners at the same place without averaging authority', () => {
    const { laws, data, facts, run } = fixture()
    facts.jurisdictions = [...facts.jurisdictions,
      { id: 'jurisdiction-rival', authority: 'rival', domains: ['tax'] }]
      .map(j => ({ ...j, domains: ['tax', 'arms'] }))
    for (const actor of ['king', 'rival']) {
      const law = grant(actor)
      laws.push({ ...law, id: `government/law.${actor}-arms`, modality: 'empower',
        regulated: { action: 'muster', object: 'any', power: 'arms' } })
      data.beliefs.subject[actor].arms = actor === 'king' ? 0.2 : 1
      data.beliefs[`guard-${actor}`][actor].arms = 1
    }
    data.beliefs.subject.rival.tax = 0.5
    expect(run().territory.slice(0, 2).map(row => [row.domain, row.apexes])).toEqual([
      ['arms', ['rival']], ['tax', ['king']],
    ])
    expect(run().polities.map(p => p.territory)).toEqual([['shared-town'], ['shared-town']])
  })

  it('compares explicitly named rival claimants even without their own supplied jurisdiction', () => {
    const { facts, data, run } = fixture()
    facts.claimants = { tax: ['rival'] }
    data.beliefs.subject.king.tax = 0.2
    expect(run().territory[0].apexes).toEqual(['rival'])
    expect(run().polities[0].territory).toEqual([])
  })

  it('expired, suspended, superseded and unrecognised grants no longer connect jurisdictions', () => {
    for (const change of ['expired', 'suspended', 'superseded', 'unrecognised'] as const) {
      const { laws, facts, run } = fixture()
      const law = laws.find(law => law.id === 'government/law.king-lord-a')!
      if (change === 'expired') law.jurisdiction.until = 10
      if (change === 'suspended') law.status = 'suspended'
      if (change === 'superseded') laws.push({ ...lawFixture('replacement'), issuer: law.issuer,
        jurisdiction: { ...law.jurisdiction }, supersedes: [law.id] })
      if (change === 'unrecognised') {
        const original = facts.actFacts
        facts.actFacts = (name, act) => name === 'law.empowered-actors' && act.object === law.id
          ? [] : original(name, act)
      }
      expect(run().polities.map(p => p.apex), change).toEqual(['king', 'lord-a'])
    }
  })

  it('cycles and multiple principals stay unresolved instead of choosing an apex', () => {
    const { laws, facts } = fixture()
    laws.push(grant('lord-a', 'king'))
    expect(polities(laws, 10, { ...facts, jurisdictions: facts.jurisdictions.map(j => ({ ...j, domains: [] })) })
      .unresolved.map(j => j.apexes)).toEqual([[], []])
    laws.pop()
    laws.push(grant('rival', 'lord-a'))
    const read = polities(laws, 10, facts)
    expect(read.unresolved).toEqual([{ jurisdiction: 'jurisdiction-a', apexes: ['king', 'rival'],
      note: 'Empowerment has multiple apexes.' }])
  })

  it('missing local authorities remain explicit and empty populations invent no places', () => {
    const { facts, data, run } = fixture()
    data.populations['jurisdiction-a'] = []
    data.populations['jurisdiction-b'] = []
    expect(run().territory).toEqual([])
    facts.jurisdictions = [{ id: 'jurisdiction-a', authority: null, domains: [] }]
    expect(run().unresolved).toEqual([{ jurisdiction: 'jurisdiction-a', apexes: [], note: 'Authority is unstated.' }])
  })

  it('reads are deterministic, sorted and detached from inputs and earlier outputs', () => {
    const { laws, data, facts, run } = fixture()
    const before = structuredClone({ laws, data, jurisdictions: facts.jurisdictions })
    const first = run(), expected = run()
    first.polities[0].territory.push('invented')
    first.territory[0].apexes!.push('invented')
    expect(run()).toEqual(expected)
    expect({ laws, data, jurisdictions: facts.jurisdictions }).toEqual(before)
    expect(polities([...laws].reverse(), 10, { ...facts, jurisdictions: [...facts.jurisdictions].reverse() }))
      .toEqual(expected)
  })
})

function truce(): Law {
  return { ...lawFixture('truce'), modality: 'prohibit', jurisdiction: { ...lawFixture().jurisdiction,
    authorities: ['authority.west', 'authority.east'], from: 10, until: 20,
    persons: { read: 'actor.authority', op: 'in', value: ['authority.east', 'authority.west'] } },
    regulated: { action: 'attack', object: 'any' }, enforcer: ['authority.east', 'authority.west'] }
}

describe('treaties are executable bilateral laws', () => {
  it('lists a two-party truce and finds a party breach through the existing evaluator', () => {
    const law = truce()
    expect(validateLaw(law)).toEqual([])
    expect(treaties([law], 10)).toEqual([{ law: law.id, parties: ['authority.east', 'authority.west'], obligations: law }])
    const act = { actor: 'authority.west', action: 'attack', object: 'authority.east', place: 'border',
      day: 10, attempted: true, succeeded: false }
    const facts: ActFacts = (name, act) => name === 'actor.authority' ? act.actor : undefined
    expect(evaluateAct([law], act, facts)).toMatchObject([{ law: law.id, stage: 'breach', act: { actor: 'authority.west' } }])
    expect(evaluateAct([law], { ...act, actor: 'outsider' }, facts)).toEqual([])
    law.exceptions = [{ condition: true, reason: 'Test exemption' }]
    expect(evaluateAct([law], act, facts)).toEqual([])
  })

  it('uses inclusive from, exclusive until, status and same-scope supersession', () => {
    const law = truce()
    expect(treaties([law], 9)).toEqual([])
    expect(treaties([law], 19)).toHaveLength(1)
    expect(treaties([law], 20)).toEqual([])
    expect(treaties([{ ...law, status: 'suspended' }], 10)).toEqual([])
    const replacement = { ...law, id: 'government/law.new-truce' as const, supersedes: [law.id] }
    replacement.jurisdiction = { ...law.jurisdiction, authorities: ['authority.east', 'authority.west'] }
    expect(treaties([law, replacement], 10).map(t => t.law)).toEqual([replacement.id])
    delete replacement.jurisdiction.authorities
    expect(treaties([law, replacement], 10).map(t => t.law)).toEqual([law.id])
    expect(enact([law], { ...replacement, place: 'border' }, { kind: 'decree' }, 'event.new', 10,
      () => undefined)).toMatchObject({ ineffective: [law.id] })
  })

  it('does not infer treaties from two enforcers or treaty-like text', () => {
    const law = truce()
    delete law.jurisdiction.authorities
    expect(treaties([law], 10)).toEqual([])
  })

  it('validates two distinct parties and either both party enforcers or none', () => {
    const law = truce()
    expect(validateLaw({ ...law, enforcer: [] })).toEqual([])
    for (const authorities of [['authority.east'], ['authority.east', 'authority.east'], ['', 'authority.west']]) {
      expect(validateLaw({ ...law, jurisdiction: { ...law.jurisdiction, authorities } }).length).toBeGreaterThan(0)
    }
    expect(validateLaw({ ...law, enforcer: ['world-enforcer'] })).toContain(
      'enforcer: bilateral law requires both parties or no enforcer')
    expect(validateLawData({ ...law, jurisdiction: { ...law.jurisdiction, from: null, until: null } })).toEqual([])
    expect(checkLaws([law])).toEqual([])
    expect(checkLaws([{ ...law, enforcer: [], jurisdiction: { ...law.jurisdiction, authorities: ['bad-id', 'authority.west'] } }]))
      .toEqual([expect.stringContaining('jurisdiction.authorities[0]')])
  })

  it('returns sorted fresh obligations and supports treaties with no world enforcer', () => {
    const law = truce()
    law.enforcer = []
    const other = { ...law, id: 'government/law.alliance' as const }
    const read = treaties([law, other], 10)
    expect(read.map(t => t.law)).toEqual([other.id, law.id])
    read[1].obligations.exceptions.push({ condition: true, reason: 'Mutation' })
    read[1].parties.reverse()
    expect(treaties([law], 10)[0].obligations.exceptions).toEqual([])
    expect(treaties([law], 10)[0].parties).toEqual(['authority.east', 'authority.west'])
  })
})
