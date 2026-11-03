import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { assessAct, assessByAuthority, checkLaws, evaluateAct, loadLaws } from '../src/index.ts'
import type { Act, ActFacts, Law, Predicate } from '../src/index.ts'
import { toDay } from '../scripts/calendar.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'person.actor', action: 'seize', object: 'goods.grain', place: 'place.manor',
  day: 10, attempted: true, succeeded: true }
const noReads: ActFacts = name => { throw new Error(`Unexpected read: ${name}`) }
const predicate = (read: string): Predicate => ({ read, op: 'eq', value: true })
const row = (law: Law, day = act.day) => assessAct([law], { ...act, day }, noReads)[0]

describe('three-valued applicability and breach assessment', () => {
  it('(a1) enactment is inclusive, repeal exclusive, and inactive statuses dominate missing starts', () => {
    const law = lawFixture()
    law.jurisdiction.from = 10
    law.jurisdiction.until = 20
    expect(row(law, 9)).toMatchObject({ result: 'no-breach', reads: [], breach: null })
    expect(row(law, 10).result).toBe('breach')
    expect(row(law, 19).result).toBe('breach')
    expect(row(law, 20).result).toBe('no-breach')
    law.jurisdiction.from = null
    expect(row(law, 20).result).toBe('no-breach')
    for (const status of ['suspended', 'repealed'] as const) {
      expect(row({ ...law, status }).result).toBe('no-breach')
    }
  })

  it('(a2) an unsourced start is unknown unless the scenario explicitly assumes it in force', () => {
    const law = lawFixture()
    law.jurisdiction.from = null
    expect(row(law)).toMatchObject({ result: 'unknown', reads: [`law.from:${law.id}`], breach: null })
    // Declared scenario assumption, not a historical start date.
    expect(assessAct([law], act, noReads, { unsourcedStart: 'in-force' })[0].result).toBe('breach')
    expect(assessAct([law], act, noReads, { unsourcedStart: 'unknown' })[0]).toEqual(row(law))
    expect(law.jurisdiction.from).toBeNull()
  })

  it('(a3) an unknown exception leaves the breach unresolved; a known exception dominates it', () => {
    const law = lawFixture()
    law.exceptions = [{ condition: predicate('grant'), reason: 'Granted leave' }]
    expect(assessAct([law], act, () => null)[0]).toMatchObject({ result: 'unknown', reads: ['grant'], breach: null })
    law.exceptions.push({ condition: true, reason: 'Known exemption' }, { condition: predicate('skipped'), reason: '' })
    const read = vi.fn(() => null)
    expect(assessAct([law], act, read)[0]).toMatchObject({ result: 'no-breach', reads: [], breach: null })
    expect(read.mock.calls).toHaveLength(1)
  })

  it('(a4) missing person and object facts are unknown, while known place exclusion dominates', () => {
    const law = lawFixture()
    law.jurisdiction.persons = predicate('person.resident')
    expect(assessAct([law], act, () => null)[0]).toMatchObject({ result: 'unknown', reads: ['person.resident'] })
    law.regulated.object = predicate('object.covered')
    expect(assessAct([law], act, () => null)[0].reads).toEqual(['object.covered', 'person.resident'])
    law.jurisdiction.places = ['place.elsewhere']
    expect(row(law)).toMatchObject({ result: 'no-breach', reads: [], breach: null })
  })

  it('(a5) conflicting authorities retain their prohibition and requirement under separate keys', () => {
    const prohibition = lawFixture('prohibition')
    const requirement: Law = { ...lawFixture('requirement'), modality: 'require',
      regulated: { action: 'seize', object: 'any' } }
    requirement.jurisdiction.authority = 'office.rival'
    requirement.supersedes = [prohibition.id]
    const laws = [requirement, prohibition]
    // Requirements match the omission, so assess both sides of the conflicting duty.
    const performed = assessAct(laws, act, noReads)
    const omitted = assessAct(laws, { ...act, action: 'omit:seize' }, noReads)
    expect(performed.map(r => r.law)).toEqual([prohibition.id])
    expect(omitted.map(r => r.law)).toEqual([requirement.id])
    const groups = assessByAuthority([...omitted, ...performed])
    expect([...groups.keys()]).toEqual(['office.council', 'office.rival'])
    expect([...groups.values()].flat().map(r => r.result)).toEqual(['breach', 'breach'])
    // A prohibition on the omission and a requirement both match the same act.
    prohibition.regulated.action = 'omit:seize'
    expect(assessByAuthority(assessAct(laws, { ...act, action: 'omit:seize' }, noReads)).size).toBe(2)
  })

  it('(a6) complete inline facts give identical breaches for three loaded historical laws', () => {
    const loaded = loadLaws(fileURLToPath(new URL('../', import.meta.url)), toDay)
    expect(checkLaws(loaded)).toEqual([])
    const cases = [
      { slug: 'merchet', action: 'omit:pay-merchet', place: 'place.manor',
        facts: { 'person.status': 'villein-tenant', 'tenant.unfree': true, 'daughter.marries': true } },
      { slug: 'forest-charter-1217-venison', action: 'take-venison', place: 'place.royal-forest',
        facts: { 'object.kind': 'deer', 'holds.permission': '' } },
      { slug: 'ordinance-of-labourers-1349-almsgiving', action: 'give-alms', place: 'place.england',
        facts: { 'person.able-bodied': true, 'gift.colour-of-pity': true } },
    ]
    const laws = cases.map(c => loaded.laws.find(law => law.id === `government/law.${c.slug}`)!)
    expect(laws.every(Boolean)).toBe(true)
    for (const example of cases) {
      const event = { ...act, action: example.action, place: example.place,
        day: toDay({ year: 1400, calendar: 'julian' }) }
      const values: Record<string, unknown> = { ...example.facts }
      const facts: ActFacts = name => values[name]
      // Explicit scenario assumption makes the unsourced merchet start comparable to the old path.
      const rows = assessAct(laws, event, facts, { unsourcedStart: 'in-force' })
      const breaches = rows.flatMap(r => r.breach ? [r.breach] : [])
      expect(breaches).toHaveLength(1)
      expect(breaches).toEqual(evaluateAct(laws, event, facts))
      const elsewhere = { ...event, place: 'place.elsewhere' }
      expect(assessAct(laws, elsewhere, facts).flatMap(r => r.breach ? [r.breach] : []))
        .toEqual(evaluateAct(laws, elsewhere, facts))
    }
  })

  it('(a7) a false condition dominates unknowns and skips subsequent reads', () => {
    const law = lawFixture()
    law.jurisdiction.from = null
    law.condition = { all: [{ not: true }, predicate('missing.condition')] }
    law.exceptions = [{ condition: predicate('missing.exception'), reason: '' }]
    const read = vi.fn(() => null)
    expect(assessAct([law], act, read)[0]).toMatchObject({ result: 'no-breach', reads: [], breach: null })
    expect(read).not.toHaveBeenCalled()
  })

  it('(a8) results are deterministic and sorted, inputs unchanged, and breaches copy sanctions and acts', () => {
    const a = lawFixture('a'), z = lawFixture('z')
    z.jurisdiction.authority = null
    a.consequence = { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: null, note: 'Unspecified' }] }
    const laws = [z, a], options = { unsourcedStart: 'unknown' as const }
    const before = structuredClone({ laws, act, options })
    const rows = assessAct(laws, act, noReads, options)
    expect(rows).toEqual(assessAct(laws, act, noReads, options))
    expect(rows.map(r => r.law)).toEqual([a.id, z.id])
    expect([...assessByAuthority(rows).keys()]).toEqual(['office.council', `unstated:${z.id}`])
    expect(rows[0].breach).toEqual(evaluateAct([a], act, noReads)[0])
    rows[0].breach!.sanction![0].note = 'Changed output'
    rows[0].breach!.act.actor = 'Changed output'
    expect({ laws, act, options }).toEqual(before)
  })

  it('supersession follows existing issuer, authority, bilateral scope and temporal rules', () => {
    const old = lawFixture('old'), replacement = lawFixture('replacement')
    replacement.supersedes = [old.id]
    replacement.jurisdiction.from = 11
    const results = () => assessAct([old, replacement], act, noReads).map(r => r.result)
    expect(results()).toEqual(['breach', 'no-breach'])
    replacement.jurisdiction.from = 10
    expect(results()).toEqual(['no-breach', 'breach'])
    replacement.jurisdiction.from = null
    expect(results()).toEqual(['no-breach', 'unknown'])
    replacement.jurisdiction.from = 10
    replacement.issuer = 'other'
    expect(results()).toEqual(['breach', 'breach'])
    replacement.issuer = old.issuer
    replacement.jurisdiction.authorities = ['office.a', 'office.b']
    expect(results()).toEqual(['breach', 'breach'])
    old.jurisdiction.authorities = ['office.b', 'office.a']
    expect(results()).toEqual(['no-breach', 'breach'])
  })

  it('unmatched actions and non-breaching modalities are omitted without reading facts', () => {
    const law = lawFixture()
    law.condition = predicate('unread')
    for (const modality of ['permit', 'establish'] as const) {
      expect(assessAct([{ ...law, modality, regulated: { action: 'seize', object: 'any' } }], act, noReads)).toEqual([])
    }
    expect(assessAct([{ ...law, modality: 'empower', regulated: { ...law.regulated, power: 'seize' } }], act, noReads)).toEqual([])
    expect(assessAct([law], { ...act, action: 'unmatched' }, noReads)).toEqual([])
    expect(assessByAuthority([])).toEqual(new Map())
  })

  const takeLaw = (): Law => ({ ...lawFixture('take'), modality: 'prohibit', regulated: { action: 'take', object: 'any' },
    exceptions: [{ condition: predicate('authority.grant'), reason: 'Actor holds a grant' }] })

  it('(f1) an unauthorised successful take produces exactly one objective breach', () => {
    const law = takeLaw(), event = { ...act, action: 'take', succeeded: true }
    const rows = assessAct([law], event, () => false)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ result: 'breach', reads: [], breach: { stage: 'breach', known_to: [] } })
    expect(rows[0].breach).toEqual(evaluateAct([law], event, () => false)[0])
  })

  it('(f3) an unknown grant leaves the take unresolved, never breached or lawful', () => {
    expect(assessAct([takeLaw()], { ...act, action: 'take' }, () => null)).toEqual([
      { law: 'government/law.take', authority: 'office.council', result: 'unknown', reads: ['authority.grant'], breach: null },
    ])
  })
})
