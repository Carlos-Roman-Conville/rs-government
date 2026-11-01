import { describe, expect, it } from 'vitest'
import { jurisdictionSets } from '../src/index.ts'
import type { Act, ActFacts, Law } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'person.subject', action: 'seize', object: 'title.field',
  place: 'place.town', day: 10, attempted: true, succeeded: true }
const facts: ActFacts = () => undefined

describe('competing jurisdiction', () => {
  it('a crown permit and church prohibition both apply, with only a church breach', () => {
    const crown: Law = { ...lawFixture('crown'), modality: 'permit', regulated: { action: act.action, object: 'any' } }
    crown.jurisdiction.authority = 'authority.crown'
    const church = lawFixture('church')
    church.jurisdiction.authority = 'authority.church'
    const sets = jurisdictionSets([crown, church], act, facts)
    expect(sets.map(set => [set.authority, set.laws.map(law => law.id), set.breaches.map(b => b.law)]))
      .toEqual([
        ['authority.church', [church.id], [church.id]],
        ['authority.crown', [crown.id], []],
      ])
    expect(jurisdictionSets([church, crown], act, facts)).toEqual(sets)
  })

  it('a town charter and lord over one place both retain their law sets', () => {
    const town = lawFixture('town'), lord = lawFixture('lord')
    town.jurisdiction = { ...town.jurisdiction, authority: 'authority.town', places: [act.place] }
    lord.jurisdiction = { ...lord.jurisdiction, authority: 'authority.lord', places: [act.place] }
    lord.supersedes = [town.id]
    expect(jurisdictionSets([town, lord], act, facts).map(set => [set.authority, set.laws]))
      .toEqual([['authority.lord', [lord]], ['authority.town', [town]]])
    expect(jurisdictionSets([town, lord], { ...act, place: 'place.elsewhere' }, facts)).toEqual([])
  })

  it('unsourced authorities retain separate unstated law sets', () => {
    const a = lawFixture('a'), b = lawFixture('b')
    a.jurisdiction.authority = b.jurisdiction.authority = null
    expect(jurisdictionSets([b, a], act, facts).map(set => set.authority))
      .toEqual([`unstated:${a.id}`, `unstated:${b.id}`])
  })
})
