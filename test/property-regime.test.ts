import { describe, expect, it } from 'vitest'
import { propertyRegime, titleCommandLawful, transferable, evaluateAct } from '../src/index.ts'
import type { ActFacts, Law, TitleCommand, TransferTitle } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

// Fictional open-field fixture: test mechanics only, not a historical rule or reconstruction.
const title: TransferTitle = { id: 'title.fixture-common', actor: 'person.fixture',
  place: 'place.fixture-field', attempted: true, succeeded: false }
const command = (action: TitleCommand['action']): TitleCommand => ({
  actor: title.actor, place: title.place, attempted: title.attempted,
  succeeded: title.succeeded, object: title.id, action,
})
const facts: ActFacts = (name, act) => {
  if (name === 'fixture.commons-access') return act.object === title.id
  return undefined
}
function openField(): Exclude<Law, { modality: 'empower' }> {
  return { ...lawFixture('fixture-open-field'), modality: 'prohibit', regulated: { action: 'enclose', object: 'any' },
    condition: { read: 'fixture.commons-access', op: 'eq', value: true } }
}
function sale(): Exclude<Law, { modality: 'empower' }> {
  return { ...lawFixture('fixture-sale'), modality: 'prohibit', regulated: { action: 'transfer', object: 'any' } }
}

describe('property regime (fictional fixtures only)', () => {
  it('commons access holds and makes enclosure void in the open-field fixture', () => {
    const law = openField()
    expect(facts('fixture.commons-access', { ...command('enclose'), day: 10 })).toBe(true)
    expect(titleCommandLawful([law], command('enclose'), 10, facts))
      .toEqual({ lawful: false, void: [law.id] })
    expect(evaluateAct([law], { ...command('enclose'), day: 10 }, facts)[0].sanction).toBeNull()
  })
  it('the same fixture permits enclosure when an enclosure law supersedes the restriction', () => {
    const old = openField()
    const enclosure: Law = { ...lawFixture('fixture-enclosure'), modality: 'permit',
      regulated: { action: 'enclose', object: 'any' }, supersedes: [old.id] }
    expect(titleCommandLawful([old, enclosure], command('enclose'), 10, facts)).toEqual({ lawful: true })
    expect(propertyRegime([old, enclosure], command('enclose'), 10, facts)).toEqual([enclosure])
  })
  it('a transfer prohibition voids a sale and makes the title nontransferable', () => {
    const law = sale()
    const before = structuredClone({ law, title })
    expect(titleCommandLawful([law], command('transfer'), 10, facts)).toEqual({ lawful: false, void: [law.id] })
    expect(transferable([law], title, 10, facts)).toBe(false)
    expect({ law, title }).toEqual(before)
  })
  it('no speaking law returns null so the host retains its Settlement field', () => {
    expect(transferable([], title, 10, facts)).toBeNull()
    expect(transferable([openField()], title, 10, facts)).toBeNull()
    expect(titleCommandLawful([], command('transfer'), 10, facts)).toEqual({ lawful: true })
  })
  it('a matching permit returns true, while sanctions alone do not void a transfer', () => {
    const permit: Law = { ...sale(), modality: 'permit' }
    expect(transferable([permit], title, 10, facts)).toBe(true)
    const fine: Law = { ...sale(), consequence: { kind: 'sanctions', sanctions: [] } }
    expect(titleCommandLawful([fine], command('transfer'), 10, facts)).toEqual({ lawful: true })
    expect(transferable([fine], title, 10, facts)).toBe(true)
  })
  it.each(['future', 'expired', 'suspended', 'repealed', 'place', 'person', 'object', 'condition', 'exception'])(
    'a %s mismatch leaves no speaking transfer law', mismatch => {
      const law = sale()
      if (mismatch === 'future') law.jurisdiction.from = 11
      if (mismatch === 'expired') law.jurisdiction.until = 10
      if (mismatch === 'suspended' || mismatch === 'repealed') law.status = mismatch
      if (mismatch === 'place') law.jurisdiction.places = ['place.elsewhere']
      if (mismatch === 'person') law.jurisdiction.persons = { not: true }
      if (mismatch === 'object') law.regulated.object = { not: true }
      if (mismatch === 'condition') law.condition = { not: true }
      if (mismatch === 'exception') law.exceptions = [{ condition: true, reason: 'Fictional exception' }]
      expect(transferable([law], title, 10, facts)).toBeNull()
      expect(titleCommandLawful([law], command('transfer'), 10, facts)).toEqual({ lawful: true })
    })
  it('non-property replacements still supersede and rival permits do not cancel void laws', () => {
    const law = sale()
    const replacement = { ...lawFixture('fixture-replacement'), supersedes: [law.id] }
    expect(transferable([law, replacement], title, 10, facts)).toBeNull()
    const rival: Law = { ...sale(), id: 'government/law.fixture-rival', modality: 'permit',
      jurisdiction: { ...law.jurisdiction, authority: 'office.rival' }, supersedes: [law.id] }
    expect(transferable([law, rival], title, 10, facts)).toBe(false)
  })
  it('void law IDs are sorted across authorities and each title command uses the evaluator', () => {
    for (const action of ['transfer', 'inherit', 'lease', 'seize', 'enclose'] as const) {
      const z = { ...lawFixture('z'), modality: 'prohibit' as const, regulated: { action, object: 'any' as const } }
      const a = { ...lawFixture('a'), modality: 'prohibit' as const, regulated: { action, object: 'any' as const },
        jurisdiction: { ...z.jurisdiction, authority: 'office.rival' } }
      expect(titleCommandLawful([z, a], command(action), 10, facts))
        .toEqual({ lawful: false, void: [a.id, z.id] })
    }
  })
  it('missing predicate reads throw and host outcome facts are preserved', () => {
    const law = { ...sale(), condition: { read: 'act.succeeded', op: 'eq' as const, value: true } }
    expect(() => transferable([law], title, 10, facts)).toThrow(/act.succeeded/)
    const outcomes: ActFacts = (_, act) => act.succeeded
    expect(transferable([law], title, 10, outcomes)).toBeNull()
    expect(transferable([law], { ...title, succeeded: true }, 10, outcomes)).toBe(false)
  })
})
