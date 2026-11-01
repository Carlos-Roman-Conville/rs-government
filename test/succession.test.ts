import { describe, expect, it, vi } from 'vitest'
import { Runner, defaultConfig, initialState, stubProviders } from '@rex/settlement'
import { resolveSuccession, successionClaimants, validateLaw, validateLawData } from '../src/index.ts'
import type { ActFacts, Law, SuccessionRule, SuccessionHost } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { successionStubs } from './stubs.ts'
import type { SuccessionStubData } from './stubs.ts'

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

function tree() {
  const data: SuccessionStubData = { children: {}, persons: {}, parents: {},
    firstPurchasers: { [office.id]: holder }, pastHolders: {}, officeHolders: {} }
  function add(id: string, sex: string, born: number, alive: boolean, father: string | null = null, mother: string | null = null) {
    data.persons[id] = { sex, born, alive, fullAge: true, blemished: false, prince: true }
    data.children[id] = []
    data.parents![id] = { father, mother }
    for (const parent of [father, mother]) if (parent !== null) {
      data.children[parent] = [...data.children[parent]!, id]
    }
  }
  const read = successionStubs(data)
  const facts: ActFacts = (name, act) => name === 'object.kind' ? act.object : read(name, act)
  const claim = (basis: SuccessionRule) => query([law(basis)], facts)
  const decide = (basis: SuccessionRule, choice?: SuccessionHost['choice'], at = office) => {
    const value = law(basis)
    value.regulated.object = true
    return resolveSuccession([value], at, holder, day, facts, { recognises, choice })
  }
  return { data, add, facts, claim, decide }
}

function descentFamily() {
  const t = tree()
  t.add('pgf', 'male', -90, false)
  t.add('pgm', 'female', -89, false)
  t.add('mgf', 'male', -88, false)
  t.add('mgm', 'female', -87, false)
  t.add('father', 'male', -60, false, 'pgf', 'pgm')
  t.add('mother', 'female', -59, false, 'mgf', 'mgm')
  t.add(holder, 'male', -30, false, 'father', 'mother')
  return t
}
const english: SuccessionRule = { rule: 'english-descent' }

describe('5076 succession schema', () => {
  // (5076)
  it.each<SuccessionRule>([english, { rule: 'tanistry', kin: 'derbfine', line: 'male' },
    { rule: 'tanistry', kin: 'gelfhine', line: 'any' }, { rule: 'tanistry', kin: null, line: null },
    { rule: 'rotation', ladder: [office.id, 'office.lower'] }, { rule: 'rotation', ladder: null },
    { rule: 'designation' }])('accepts designed runtime and dated fields: %j', basis => {
    const value = law(basis)
    expect(validateLaw(value)).toEqual([])
    expect(validateLawData({ ...value, jurisdiction: { ...value.jurisdiction, from: null, until: null } })).toEqual([])
  })
  // (5076)
  it.each([
    ['kin', 'clan'], ['line', 'female'], ['ladder', []], ['ladder', ['same', 'same']],
    ['ladder', ['']], ['ladder', 'office'], ['ladder', [null]], ['winner', 'chosen'],
  ])('rejects malformed or unknown succession.%s: %j', (field, value) => {
    expect(validateLaw({ ...law(), succession: { rule: 'rotation', [field]: value } }))
      .toEqual(expect.arrayContaining([expect.stringContaining(`succession.${field}`)]))
  })
})

describe('5076 English descent and representation', () => {
  // (5076)
  it('eldest son precedes a younger son and elder daughter without reading the purchaser', () => {
    const t = descentFamily()
    t.add('daughter', 'female', 1, true, holder)
    t.add('eldest', 'male', 2, true, holder)
    t.add('younger', 'male', 3, true, holder)
    const facts: ActFacts = (name, act) => {
      if (name === 'estate.first-purchaser') throw new Error('unneeded purchaser read')
      return t.facts(name, act)
    }
    expect(query([law(english)], facts)).toMatchObject({ claimants: [{ person: 'eldest' }] })
  })
  // (5076)
  it('a dead eldest son is represented by his son before the living younger brother', () => {
    const t = descentFamily()
    t.add('eldest', 'male', 1, false, holder)
    t.add('younger', 'male', 2, true, holder)
    t.add('grandson', 'male', 20, true, 'eldest')
    expect(t.claim(english)).toEqual({ kind: 'claimants', claimants: [
      { person: 'grandson', through: ['eldest'], law: law().id, basis: english },
    ] })
    expect(t.decide(english)).toMatchObject({ type: 'government.succession_event', successor: 'grandson' })
  })
  // (5076)
  it('representation keeps every dead ancestor nearest the holder first', () => {
    const t = descentFamily()
    t.add('son', 'male', 1, false, holder)
    t.add('grandson', 'male', 20, false, 'son')
    t.add('great-grandson', 'male', 40, true, 'grandson')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'great-grandson', through: ['son', 'grandson'] }] })
  })
  // (5076)
  it('a dead eldest son leaves coparcener daughters ahead of the younger brother', () => {
    const t = descentFamily()
    t.add('eldest', 'male', 1, false, holder)
    t.add('younger', 'male', 2, true, holder)
    t.add('a', 'female', 20, true, 'eldest')
    t.add('b', 'female', 21, true, 'eldest')
    expect(t.claim(english)).toMatchObject({ claimants: [
      { person: 'a', through: ['eldest'], coparcener: true }, { person: 'b', through: ['eldest'], coparcener: true },
    ] })
    expect(t.decide(english)).toEqual({ kind: 'unresolved', reason: 'coparceners: joint holding of one office not stated' })
  })
  // (5076)
  it('daughters take together with a dead daughter represented by her son per stirpes', () => {
    const t = descentFamily()
    t.add('daughter', 'female', 1, true, holder)
    t.add('dead-daughter', 'female', 2, false, holder)
    t.add('grandson', 'male', 20, true, 'dead-daughter')
    expect(t.claim(english)).toMatchObject({ claimants: [
      { person: 'daughter', coparcener: true }, { person: 'grandson', through: ['dead-daughter'], coparcener: true },
    ] })
  })
  // (5076)
  it('skips a dead son with a known empty family', () => {
    const t = descentFamily()
    t.add('eldest', 'male', 1, false, holder)
    t.add('younger', 'male', 2, true, holder)
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'younger' }] })
  })
  // (5076)
  it('twin sons stay rival claims, sorted independently of duplicate provider order', () => {
    const t = descentFamily()
    t.add('z', 'male', 1, true, holder)
    t.add('a', 'male', 1, true, holder)
    t.data.children[holder] = ['z', 'a', 'z']
    expect(t.decide(english)).toMatchObject({ kind: 'contested', claimants: [{ person: 'a' }, { person: 'z' }] })
  })
  // (5076)
  it.each(['kin.children', 'person.born', 'person.sex'])('unknown or unsupported %s leaves descent unresolved', missing => {
    const t = descentFamily()
    t.add('son', 'male', 1, false, holder)
    if (missing === 'kin.children') t.data.children.son = null
    if (missing === 'person.born') t.data.persons.son.born = null
    if (missing === 'person.sex') t.data.persons.son.sex = 'other'
    expect(t.claim(english)).toMatchObject({ kind: 'unresolved', reason: expect.stringContaining(`${missing}: son`) })
  })
  // (5076)
  it('a whole brother precedes an older half-brother', () => {
    const t = descentFamily()
    t.add('other-mother', 'female', -59, false)
    t.add('half', 'male', -40, true, 'father', 'other-mother')
    t.add('whole', 'male', -20, true, 'father', 'mother')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'whole' }] })
  })
  // (5076)
  it('the dead elder whole brother is represented by his son before the younger brother', () => {
    const t = descentFamily()
    t.add('elder', 'male', -40, false, 'father', 'mother')
    t.add('younger', 'male', -20, true, 'father', 'mother')
    t.add('nephew', 'male', 10, true, 'elder')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'nephew', through: ['elder'] }] })
  })
  // (5076)
  it('paternal uncle precedes maternal uncle', () => {
    const t = descentFamily()
    t.add('paternal', 'male', -50, true, 'pgf', 'pgm')
    t.add('maternal', 'male', -70, true, 'mgf', 'mgm')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'paternal' }] })
  })
  // (5076)
  it('a maternal purchaser confines collateral descent to that blood', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'mgm'
    t.add('paternal', 'male', -50, true, 'pgf', 'pgm')
    t.add('maternal', 'male', -70, true, 'mgf', 'mgm')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'maternal' }] })
  })
  // (5076)
  it('no claimant with purchaser=father and no siblings escheats and emits only vacate', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'father'
    expect(t.claim(english)).toEqual({ kind: 'claimants', claimants: [] })
    expect(t.decide(english)).toEqual({ type: 'settlement.vacate', office: office.id })
  })
  // (5076)
  it('a fully exhausted grandparent purchaser stock escheats', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'pgf'
    expect(t.decide(english)).toEqual({ type: 'settlement.vacate', office: office.id })
  })
  // (5079) Source: 5078, Blackstone canon 6: half blood is excluded absolutely.
  it('purchaser=father with only a living half-brother escheats and emits vacate', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'father'
    t.add('other-mother', 'female', -59, false)
    t.add('half', 'male', -40, true, 'father', 'other-mother')
    expect(t.claim(english)).toEqual({ kind: 'claimants', claimants: [] })
    expect(t.decide(english)).toEqual({ type: 'settlement.vacate', office: office.id })
  })
  // (5079) Source: 5078, Blackstone canon 6: remoter whole blood takes before half blood.
  it('skips a living half-brother for a whole-blood paternal uncle son with purchaser=grandfather', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'pgf'
    t.add('other-mother', 'female', -59, false)
    t.add('half', 'male', -40, true, 'father', 'other-mother')
    t.add('uncle', 'male', -50, false, 'pgf', 'pgm')
    t.add('cousin', 'male', -10, true, 'uncle')
    expect(t.claim(english)).toEqual({ kind: 'claimants', claimants: [
      { person: 'cousin', through: ['uncle'], law: law().id, basis: english },
    ] })
    expect(t.decide(english)).toMatchObject({ type: 'government.succession_event', successor: 'cousin' })
  })
  // (5079) Source: 5078, Blackstone canon 6: half-blood stocks are excluded.
  it('skips an older half-uncle for a whole-blood uncle', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = 'pgf'
    t.add('other-grandmother', 'female', -89, false)
    t.add('half-uncle', 'male', -70, true, 'pgf', 'other-grandmother')
    t.add('uncle', 'male', -50, true, 'pgf', 'pgm')
    expect(t.claim(english)).toEqual({ kind: 'claimants', claimants: [
      { person: 'uncle', law: law().id, basis: english },
    ] })
  })
  // (5079) Source: 5078 excludes half blood; remoter stocks remain unsourced in 5076.
  it('purchaser=holder with only a half-brother leaves collateral stocks beyond grandparents unresolved', () => {
    const t = descentFamily()
    t.add('other-mother', 'female', -59, false)
    t.add('half', 'male', -40, true, 'father', 'other-mother')
    const expected = { kind: 'unresolved', reason: 'collateral stocks beyond grandparents: succession not stated' }
    expect(t.claim(english)).toEqual(expected)
    expect(t.decide(english)).toEqual(expected)
  })
  // (5076)
  it('whole-blood paternal uncle precedes a nearer half-brother', () => {
    const t = descentFamily()
    t.add('other-mother', 'female', -59, false)
    t.add('half', 'male', -40, true, 'father', 'other-mother')
    t.add('uncle', 'male', -50, true, 'pgf', 'pgm')
    expect(t.claim(english)).toMatchObject({ claimants: [{ person: 'uncle' }] })
  })
  // (5076)
  it.each(['remote-purchaser', holder])('no kin with purchaser=%s leaves remoter stocks unresolved', purchaser => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = purchaser
    expect(t.decide(english)).toMatchObject({ kind: 'unresolved', reason: expect.stringContaining('beyond grandparents') })
  })
  // (5076)
  it('unknown estate.first-purchaser leaves extinct issue unresolved', () => {
    const t = descentFamily()
    t.data.firstPurchasers![office.id] = null
    expect(t.decide(english)).toEqual({ kind: 'unresolved', reason: `missing estate.first-purchaser: ${office.id}` })
  })
})

function tanistFamily() {
  const t = tree()
  t.add('great', 'male', -90, false)
  t.add('grand', 'male', -60, false, 'great')
  t.add('father', 'male', -30, false, 'grand')
  t.add(holder, 'male', 0, false, 'father')
  t.add('uncle', 'male', -20, false, 'grand')
  t.add('tanist', 'male', 10, true, 'uncle')
  t.add('great-uncle', 'male', -50, false, 'great')
  t.add('distant', 'male', 10, true, 'great-uncle')
  t.add('aunt', 'female', -20, false, 'grand')
  t.add('female-line', 'male', 10, true, null, 'aunt')
  return t
}
const tanistryRule: SuccessionRule = { rule: 'tanistry', kin: 'gelfhine', line: 'male' }

describe('5076 tanistry', () => {
  // (5076)
  it('a recorded eligible elected tanist emits a succession event', () => {
    const t = tanistFamily()
    expect(t.decide(tanistryRule, () => ['tanist'])).toMatchObject({ type: 'government.succession_event', successor: 'tanist' })
    expect(t.claim(tanistryRule)).toMatchObject({ kind: 'unresolved' })
  })
  // (5076)
  it.each(['kin', 'line'] as const)('null and omitted %s never invent a tanistry rule', field => {
    const t = tanistFamily()
    for (const value of [null, undefined]) {
      expect(t.decide({ ...tanistryRule, [field]: value }, () => ['tanist']))
        .toEqual({ kind: 'unresolved', reason: `${field} not stated: ${law().id}` })
    }
  })
  // (5076)
  it.each([null, []])('missing or empty recorded election %j is unresolved', selection => {
    expect(tanistFamily().decide(tanistryRule, () => selection)).toMatchObject({ kind: 'unresolved' })
  })
  // (5076)
  it('gelfhine excludes the great-grandfather other line that derbfine admits', () => {
    const t = tanistFamily()
    expect(t.decide(tanistryRule, () => ['distant'])).toMatchObject({ kind: 'unresolved' })
    expect(t.decide({ ...tanistryRule, kin: 'derbfine' }, () => ['distant']))
      .toMatchObject({ type: 'government.succession_event', successor: 'distant' })
  })
  // (5076)
  it('male line excludes a daughter son whom any line admits', () => {
    const t = tanistFamily()
    expect(t.decide(tanistryRule, () => ['female-line'])).toMatchObject({ kind: 'unresolved' })
    expect(t.decide({ ...tanistryRule, line: 'any' }, () => ['female-line']))
      .toMatchObject({ type: 'government.succession_event', successor: 'female-line' })
  })
  // (5076)
  it.each([['sex', 'female'], ['fullAge', false], ['blemished', true], ['alive', false]] as const)(
    'a chosen tanist with %s=%s is unresolved', (field, value) => {
      const t = tanistFamily()
      Object.assign(t.data.persons.tanist, { [field]: value })
      expect(t.decide(tanistryRule, () => ['tanist'])).toMatchObject({ kind: 'unresolved' })
    })
  // (5076)
  it('an outside choice is unresolved and a disputed eligible election preserves rivals', () => {
    const t = tanistFamily()
    expect(t.decide(tanistryRule, () => ['outsider'])).toMatchObject({ kind: 'unresolved' })
    expect(t.decide({ ...tanistryRule, kin: 'derbfine' }, () => ['tanist', 'distant', 'tanist']))
      .toMatchObject({ kind: 'contested', claimants: [{ person: 'distant' }, { person: 'tanist' }] })
  })
})

function rotaFamily() {
  const t = tree()
  t.add('father', 'male', -30, false)
  t.add(holder, 'male', 0, false, 'father')
  t.add('next', 'male', 10, true, 'father')
  t.add('youngest', 'male', 20, true, 'father')
  t.add('son', 'male', 30, true, holder)
  t.add('younger-son', 'male', 40, true, holder)
  t.data.pastHolders![office.id] = ['father', holder]
  t.data.officeHolders!['office.bottom'] = 'son'
  return t
}
const rota: SuccessionRule = { rule: 'rotation', ladder: [office.id, 'office.middle', 'office.bottom'] }

describe('5076 rota rotation', () => {
  // (5076)
  it('the next eligible brother is selected by birth', () => {
    expect(rotaFamily().decide(rota)).toMatchObject({ type: 'government.succession_event', successor: 'next' })
  })
  // (5076)
  it('with no living brother the eldest living son of the eldest reigning brother succeeds', () => {
    const t = rotaFamily()
    t.data.persons.next.alive = false
    t.data.persons.youngest.alive = false
    t.add('nephew', 'male', 25, true, 'next')
    t.data.pastHolders![office.id] = ['father', holder, 'next']
    expect(t.decide(rota)).toMatchObject({ type: 'government.succession_event', successor: 'son' })
  })
  // (5076)
  it('an izgoi son is excluded from the next generation and lower rungs', () => {
    const t = rotaFamily()
    t.add('izgoi', 'male', -10, false, 'father')
    t.add('excluded', 'male', 5, true, 'izgoi')
    t.data.persons.next.alive = false
    t.data.persons.youngest.alive = false
    expect(t.decide(rota)).toMatchObject({ type: 'government.succession_event', successor: 'son' })
    t.data.officeHolders!['office.bottom'] = 'excluded'
    expect(t.decide(rota, undefined, { ...office, id: 'office.middle' })).toMatchObject({ kind: 'unresolved' })
  })
  // (5076)
  it('rung k receives the eligible current holder of rung k+1', () => {
    expect(rotaFamily().decide(rota, undefined, { ...office, id: 'office.middle' }))
      .toMatchObject({ type: 'government.succession_event', office: 'office.middle', successor: 'son' })
  })
  // (5076)
  it('the lowest rung remains unresolved', () => {
    expect(rotaFamily().decide(rota, undefined, { ...office, id: 'office.bottom' }))
      .toMatchObject({ kind: 'unresolved', reason: expect.stringContaining('lowest rung') })
  })
  // (5076)
  it.each([null, undefined])('a missing ladder %s remains unresolved', ladder => {
    expect(rotaFamily().decide({ rule: 'rotation', ladder })).toEqual({ kind: 'unresolved', reason: `ladder not stated: ${law().id}` })
  })
  // (5076)
  it('an office outside the ladder remains unresolved', () => {
    expect(rotaFamily().decide(rota, undefined, { ...office, id: 'office.other' }))
      .toEqual({ kind: 'unresolved', reason: 'office not on ladder: office.other' })
  })
  // (5076)
  it('no eligible son after the brothers and a vacant next rung never imply vacancy', () => {
    const t = rotaFamily()
    for (const person of ['next', 'youngest', 'son', 'younger-son']) t.data.persons[person].alive = false
    expect(t.decide(rota)).toMatchObject({ kind: 'unresolved' })
    t.data.officeHolders!['office.bottom'] = ''
    expect(t.decide(rota, undefined, { ...office, id: 'office.middle' })).toMatchObject({ kind: 'unresolved' })
  })
})

function designationFamily() {
  const t = tree()
  t.add(holder, 'male', -30, false)
  t.add('queen', 'female', -29, true)
  t.add('firstborn', 'male', 0, true, holder, 'queen')
  t.add('chosen', 'male', 10, true, holder, 'queen')
  t.add('rival', 'male', 20, true, holder, 'queen')
  t.data.pastHolders![office.id] = [holder]
  return t
}
const designationRule: SuccessionRule = { rule: 'designation' }

describe('5076 Buganda designation', () => {
  // (5076)
  it('the revealed eligible designee emits a succession event', () => {
    expect(designationFamily().decide(designationRule, () => ['chosen']))
      .toMatchObject({ type: 'government.succession_event', successor: 'chosen' })
  })
  // (5076)
  it('a firstborn prince remains ineligible without inventing the 1888 exception', () => {
    expect(designationFamily().decide(designationRule, () => ['firstborn']))
      .toEqual({ kind: 'unresolved', reason: 'firstborn prince: firstborn' })
  })
  // (5076)
  it('a non-prince designee is unresolved', () => {
    const t = designationFamily()
    t.data.persons.chosen.prince = false
    expect(t.decide(designationRule, () => ['chosen'])).toMatchObject({ kind: 'unresolved' })
  })
  // (5076)
  it.each([null, []])('unknown or empty designation %j remains unresolved', choice => {
    expect(designationFamily().decide(designationRule, () => choice)).toMatchObject({ kind: 'unresolved' })
  })
  // (5076)
  it('two eligible designees stay rival claims in ID order', () => {
    expect(designationFamily().decide(designationRule, () => ['rival', 'chosen', 'chosen']))
      .toMatchObject({ kind: 'contested', claimants: [{ person: 'chosen' }, { person: 'rival' }] })
  })
})

describe('5076 provider boundaries and pure decisions', () => {
  const cases: { name: string; setup: () => ReturnType<typeof tree>; basis: SuccessionRule;
    subject: string; choice?: SuccessionHost['choice']; officeId?: string }[] = [
    { name: 'kin.parents', setup: tanistFamily, basis: tanistryRule, subject: holder, choice: () => ['tanist'] },
    { name: 'estate.first-purchaser', setup: descentFamily, basis: english, subject: office.id },
    { name: 'office.past-holders', setup: rotaFamily, basis: rota, subject: office.id },
    { name: 'office.holder', setup: rotaFamily, basis: rota, subject: 'office.bottom', officeId: 'office.middle' },
    { name: 'person.full-age', setup: tanistFamily, basis: tanistryRule, subject: 'tanist', choice: () => ['tanist'] },
    { name: 'person.blemished', setup: tanistFamily, basis: tanistryRule, subject: 'tanist', choice: () => ['tanist'] },
    { name: 'person.prince', setup: designationFamily, basis: designationRule, subject: 'chosen', choice: () => ['chosen'] },
  ]
  // (5076)
  it.each(cases)('missing $name remains unresolved with the queried subject', scenario => {
    const t = scenario.setup(), value = law(scenario.basis)
    value.regulated.object = true
    for (const missing of [null, undefined]) {
      const facts: ActFacts = (name, act) => name === scenario.name && act.object === scenario.subject
        ? missing : t.facts(name, act)
      expect(resolveSuccession([value], { ...office, id: scenario.officeId ?? office.id }, holder, day,
        facts, { recognises, choice: scenario.choice }))
        .toEqual({ kind: 'unresolved', reason: `missing ${scenario.name}: ${scenario.subject}` })
    }
  })
  // (5076)
  it.each(cases)('$name carries the outgoing holder, subject, place and query day', scenario => {
    const t = scenario.setup(), value = law(scenario.basis)
    value.regulated.object = true
    const facts = vi.fn(t.facts)
    resolveSuccession([value], { ...office, id: scenario.officeId ?? office.id }, holder, day,
      facts, { recognises, choice: scenario.choice })
    expect(facts).toHaveBeenCalledWith(scenario.name, { actor: holder, action: 'succeed',
      object: scenario.subject, place: office.place, day, attempted: false, succeeded: false })
  })
  // (5076)
  it.each(cases)('malformed $name is rejected explicitly', scenario => {
    const t = scenario.setup(), value = law(scenario.basis)
    value.regulated.object = true
    const facts: ActFacts = (name, act) => name === scenario.name ? 42 : t.facts(name, act)
    expect(() => resolveSuccession([value], { ...office, id: scenario.officeId ?? office.id }, holder, day,
      facts, { recognises, choice: scenario.choice })).toThrow(scenario.name)
  })
  // (5076)
  it.each([
    { setup: descentFamily, basis: english, choice: undefined },
    { setup: tanistFamily, basis: tanistryRule, choice: () => ['tanist'] },
    { setup: rotaFamily, basis: rota, choice: undefined },
    { setup: designationFamily, basis: designationRule, choice: () => ['chosen'] },
  ])('$basis.rule does not write Settlement, law or provider state', ({ setup, basis, choice }) => {
    const t = setup()
    if (basis.rule === 'english-descent') t.add('son', 'male', 10, true, holder)
    const runner = new Runner(initialState('stl.succession-new', 'test'), defaultConfig(), stubProviders())
    const id = runner.run<string>({ type: 'createOffice', name: 'Crown', powers: [] })
    runner.run({ type: 'appoint', office: id, holder })
    const value = law(basis)
    const before = structuredClone({ state: runner.state, log: runner.log, events: runner.events, value, data: t.data })
    expect(resolveSuccession([value], office, holder, day, t.facts, { recognises, choice }))
      .toMatchObject({ type: 'government.succession_event' })
    expect({ state: runner.state, log: runner.log, events: runner.events, value, data: t.data }).toEqual(before)
  })
  // (5076)
  it('claimant and event ladder arrays are deep copies, including between rival claimants', () => {
    const t = rotaFamily(), value = law(structuredClone(rota))
    t.data.persons.youngest.born = t.data.persons.next.born
    const claim = query([value], t.facts)
    expect(claim.kind).toBe('claimants')
    if (claim.kind === 'claimants') {
      claim.claimants[0].basis.ladder![0] = 'changed'
      expect(claim.claimants[1].basis.ladder).toEqual(rota.ladder)
      expect(value.succession!.ladder).toEqual(rota.ladder)
    }
    t.data.persons.youngest.born = 20
    const event = resolveSuccession([value], office, holder, day, t.facts, { recognises })
    expect(event).toMatchObject({ type: 'government.succession_event' })
    if ('type' in event && event.type === 'government.succession_event') event.basis.ladder![0] = 'changed'
    expect(value.succession!.ladder).toEqual(rota.ladder)
  })
  // (5076)
  it('cyclic descent fails explicitly instead of recursing indefinitely', () => {
    const t = descentFamily()
    t.add('dead', 'male', 1, false, holder)
    t.data.children.dead = [holder]
    expect(() => t.claim(english)).toThrow('kin.children: cyclic descent')
  })
})

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
    ['rule', { succession: { rule: 'unsupported' } }, 'succession.rule'],
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
    const expected = { kind: 'unresolved', reason: 'no direct heir: primogeniture does not specify representation or collateral heirs' }
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
