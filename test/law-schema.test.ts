import { describe, expect, it } from 'vitest'
import { validateLaw } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

function changed(path: string, value: unknown): unknown {
  const law = lawFixture() as unknown as Record<string, unknown>
  const keys = path.split('.')
  let row = law
  for (const key of keys.slice(0, -1)) row = row[key] as Record<string, unknown>
  row[keys.at(-1)!] = value
  return law
}

describe('law schema', () => {
  it('accepts null enactment for a law predating the run', () => {
    expect(validateLaw({ ...lawFixture(), enactment: null })).toEqual([])
  })
  it('accepts a complete fixture law without sources', () => expect(validateLaw(lawFixture())).toEqual([]))
  it.each([null, [], true, 'law'])('requires a law object (%j)', value => expect(validateLaw(value)).toEqual(['law: expected object']))
  it.each(Object.keys(lawFixture()))('requires the %s field', key => {
    const law = lawFixture() as unknown as Record<string, unknown>
    delete law[key]
    expect(validateLaw(law).length).toBeGreaterThan(0)
  })
  it.each(['gov:law:old', 'government/law.', 'government/law.Upper', 'government/law.a/b', 'government/law.a b'])('rejects invalid law id %s', id => {
    expect(validateLaw(changed('id', id))).toEqual([expect.stringContaining('id: expected government/law.')])
  })
  it.each(['issuer', 'enactment', 'jurisdiction.authority', 'regulated.action'])('requires a non-empty %s reference', path => {
    expect(validateLaw(changed(path, ' '))).toContain(`${path}: expected non-empty string`)
  })
  it.each(['prohibit', 'require', 'permit', 'establish'])('accepts %s modality without a power', modality => expect(validateLaw(changed('modality', modality))).toEqual([]))
  it('requires power for empower', () => expect(validateLaw(changed('modality', 'empower'))).toEqual(['regulated.power: expected non-empty string']))
  it('accepts empower with a named power', () => {
    const law = { ...lawFixture(), modality: 'empower', regulated: { action: 'seize', object: 'any', power: 'seize' } }
    expect(validateLaw(law)).toEqual([])
  })
  it.each(['prohibit', 'require', 'permit', 'establish'])('forbids power for %s', modality => {
    expect(validateLaw({ ...lawFixture(), modality, regulated: { action: 'seize', object: 'any', power: 'seize' } })).toEqual(['regulated.power: allowed only for empower'])
  })
  it('rejects unknown modality', () => expect(validateLaw(changed('modality', 'modify'))).toEqual([expect.stringContaining('modality: expected')]))
  it.each(['in-force', 'suspended', 'repealed'])('accepts status %s', status => expect(validateLaw(changed('status', status))).toEqual([]))
  it('rejects unknown status', () => expect(validateLaw(changed('status', 'active'))).toEqual([expect.stringContaining('status: expected')]))
  it.each(['jurisdiction', 'regulated', 'consequence'])('requires an object for %s', path => expect(validateLaw(changed(path, []))).toContain(`${path}: expected object`))
  it('accepts a places list', () => expect(validateLaw(changed('jurisdiction.places', ['place.a']))).toEqual([]))
  it.each(['jurisdiction.places', 'enforcer'])('requires strings in %s', path => expect(validateLaw(changed(path, [2]))).toEqual([`${path}[0]: expected non-empty string`]))
  it.each(['jurisdiction.places', 'exceptions', 'enforcer', 'supersedes', 'sources'])('requires an array for %s', path => expect(validateLaw(changed(path, 3))).toContain(`${path}: expected array`))
  it.each(['jurisdiction.persons', 'regulated.object', 'condition'])('accepts executable predicates in %s', path => {
    expect(validateLaw(changed(path, { read: 'person.age', op: 'gte', value: 18 }))).toEqual([])
  })
  it.each(['jurisdiction.persons', 'regulated.object', 'condition'])('rejects prose in %s', path => {
    expect(validateLaw(changed(path, 'adult persons'))).toEqual([`${path}: expected true or a predicate object`])
  })
  it.each(['jurisdiction.from', 'jurisdiction.until'])('requires finite numeric days in %s', path => {
    for (const value of ['1', Infinity, NaN]) expect(validateLaw(changed(path, value))).toContain(`${path}: expected finite number`)
  })
  it('accepts an inclusive ordered time range', () => expect(validateLaw(changed('jurisdiction.until', 0))).toEqual([]))
  it.each([null, -10])('accepts no sourced start with until %s', until => {
    const law = lawFixture()
    law.jurisdiction = { ...law.jurisdiction, from: null, until }
    expect(validateLaw(law)).toEqual([])
  })
  it('requires from to be present even when no sourced start is allowed', () => {
    expect(validateLaw(changed('jurisdiction.from', undefined))).toEqual(['jurisdiction.from: expected finite number'])
  })
  it('rejects until before from', () => expect(validateLaw(changed('jurisdiction.until', -1))).toEqual(['jurisdiction.until: must be at least from']))
  it('requires exception objects', () => expect(validateLaw(changed('exceptions', [null]))).toEqual(['exceptions[0]: expected object']))
  it('accepts exception predicates and reasons', () => expect(validateLaw(changed('exceptions', [{ condition: { not: true }, reason: 'Permission held' }]))).toEqual([]))
  it('requires an executable exception condition', () => expect(validateLaw(changed('exceptions', [{ condition: 'allowed', reason: 'Permission held' }]))).toEqual([expect.stringContaining('exceptions[0].condition:')]))
  it('requires an exception reason', () => expect(validateLaw(changed('exceptions', [{ condition: true, reason: '' }]))).toEqual(['exceptions[0].reason: expected non-empty string']))
  it('rejects unknown consequence kinds', () => expect(validateLaw(changed('consequence', { kind: 'modifier' }))).toEqual(['consequence.kind: expected void|sanctions']))
  it('forbids sanctions on a void consequence', () => expect(validateLaw(changed('consequence', { kind: 'void', sanctions: [] }))).toEqual(['consequence.sanctions: allowed only for sanctions']))
  it('requires a sanctions array for sanctions consequence', () => expect(validateLaw(changed('consequence', { kind: 'sanctions' }))).toEqual(['consequence.sanctions: expected array']))
  it.each(['fine', 'seizure', 'detention', 'corporal', 'outlawry', 'exile'])('accepts %s sanctions with numeric or unknown amounts', kind => {
    for (const amount of [12, null]) expect(validateLaw(changed('consequence', { kind: 'sanctions', sanctions: [{ kind, amount, note: 'Fixture amount' }] }))).toEqual([])
  })
  it('requires sanction objects', () => expect(validateLaw(changed('consequence', { kind: 'sanctions', sanctions: [null] }))).toEqual(['consequence.sanctions[0]: expected object']))
  it.each([
    [{ kind: 'tax', amount: 1, note: 'Fixture' }, 'kind'],
    [{ kind: 'fine', amount: '1', note: 'Fixture' }, 'amount'],
    [{ kind: 'fine', amount: Infinity, note: 'Fixture' }, 'amount'],
    [{ kind: 'fine', note: 'Fixture' }, 'amount'],
    [{ kind: 'fine', amount: null, note: '' }, 'note'],
  ])('rejects invalid sanction %j (%s)', (sanction, field) => expect(validateLaw(changed('consequence', { kind: 'sanctions', sanctions: [sanction] }))).toEqual([expect.stringContaining(`consequence.sanctions[0].${field}:`)]))
  it('accepts a named procedure', () => expect(validateLaw(changed('procedure', 'procedure.trial'))).toEqual([]))
  it('rejects an invalid procedure reference', () => expect(validateLaw(changed('procedure', 3))).toEqual(['procedure: expected non-empty string']))
  it('requires qualified supersedes law ids', () => expect(validateLaw(changed('supersedes', ['law.old']))).toEqual([expect.stringContaining('supersedes[0]: expected government/law.')]))
  it('requires sources for non-fixture issuers', () => expect(validateLaw(changed('issuer', 'office.council'))).toEqual(['sources: at least one citation required unless issuer is fixture']))
  it('accepts a sourced law with known or unknown citation details', () => {
    for (const details of [{ year: 1351, locator: 'chapter 1' }, { year: null, locator: null }]) {
      expect(validateLaw({ ...lawFixture(), issuer: 'office.council', sources: [{ key: 'statute', title: 'Statute', ...details }] })).toEqual([])
    }
  })
  it('requires citation objects', () => expect(validateLaw(changed('sources', [null]))).toEqual(['sources[0]: expected object']))
  it.each([['key', ''], ['title', null], ['year', '1351'], ['year', Infinity], ['locator', 1]])('validates citation %s (%j)', (field, value) => {
    const citation = { key: 'source', title: 'Title', year: null, locator: null, [field as string]: value }
    expect(validateLaw(changed('sources', [citation]))).toEqual([expect.stringContaining(`sources[0].${field}:`)])
  })
  it('returns failures sorted and leaves the law unchanged', () => {
    const law = { ...lawFixture(), issuer: '', status: 'bad', id: 'bad' }
    const before = structuredClone(law)
    const errors = validateLaw(law)
    expect(errors).toEqual([...errors].sort())
    expect(law).toEqual(before)
  })
})
