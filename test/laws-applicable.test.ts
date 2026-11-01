import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applicableLaws, checkLaws, loadLaws } from '../src/index.ts'
import type { Act, CalendarPoint } from '../src/index.ts'
import { toDay } from '../scripts/calendar.ts'

const loaded = loadLaws(fileURLToPath(new URL('../', import.meta.url)), toDay)
const day1300 = toDay({ year: 1300, month: 6, day: 1, calendar: 'julian' })
// SOURCES.md dates outside 1300, by source section slug. Full dates are shared
// by clauses of the same ordinance; 1321 is an attestation, not an enactment.
const later: Record<string, CalendarPoint> = {
  'forestalling-regrating': { year: 1321, calendar: 'julian' }, // recognised by 1321
  'ordinance-of-labourers-1349-service': { year: 1349, month: 6, day: 18, calendar: 'julian' },
  'ordinance-of-labourers-1349-almsgiving': { year: 1349, month: 6, day: 18, calendar: 'julian' },
  'statute-of-labourers-1351-wages': { year: 1351, calendar: 'julian' },
  'statute-of-labourers-1351-oath-and-stocks': { year: 1351, calendar: 'julian' },
  'treason-1351': { year: 1351, calendar: 'julian' },
  'diet-and-apparel-1363-yeomen-and-servants': { year: 1363, calendar: 'julian' },
}
// Independent subject examples for the fixture's status/permission jurisdictions.
const statuses: Record<string, string> = {
  'assize-of-bread-and-ale-c1266': 'baker',
  'diet-and-apparel-1363-yeomen-and-servants': 'yeoman',
  'forestalling-regrating': 'trader',
  'heriot': 'manorial-tenant-heir',
  'merchet': 'villein-tenant',
  'merton-1235-c4-approvement-of-commons': 'lord-manor',
  'mortmain-1279-de-viris-religiosis': 'religious-house-or-person',
  'statute-of-labourers-1351-wages': 'labourer',
  'suit-of-mill': 'manorial-tenant',
  'westminster-2-1285-c46-approvement': 'lord-manor',
  'winchester-1285-highways': 'roadside-landholder',
}

describe('historical fixture applicability in 1300', () => {
  it('includes every file and resolves every explicitly dated exclusion', () => {
    expect(checkLaws(loaded)).toEqual([])
    expect(loaded.laws).toHaveLength(24)
    expect(loaded.laws).toHaveLength(loaded.entries.length)
    for (const slug of Object.keys(later)) expect(loaded.laws.some(law => law.id === `government/law.${slug}`)).toBe(true)
  })
  for (const law of loaded.laws) {
    const slug = law.id.slice('government/law.'.length)
    const facts: Record<string, unknown> = {
      'person.status': statuses[slug] ?? 'resident', 'person.age': 30, 'person.in-tithing': true,
      'person.able-bodied': true, 'person.independent-means': false,
      'person.sworn-to-wage-rates': true, 'holds.permission': 'fee-simple',
    }
    const act: Act = { actor: 'person.fixture', action: law.regulated.action, object: null,
      place: law.jurisdiction.places === 'all' ? 'place.england' : law.jurisdiction.places[0],
      day: day1300, attempted: true, succeeded: true }
    const returned = (day: number) => [...applicableLaws(loaded.laws, { ...act, day }, name => facts[name]).values()]
      .flat().map(row => row.id)
    it(`${slug} ${later[slug] ? 'is excluded in 1300 by its SOURCES.md date' : 'is returned in 1300 for a covered person and place'}`, () => {
      // Only this law is tested against its subject; overlapping laws may read
      // other statuses, but all fixture jurisdiction ports have explicit values.
      expect(returned(day1300).includes(law.id)).toBe(!later[slug])
      if (later[slug]) {
        expect(law.jurisdiction.from).toBe(toDay(later[slug]))
        expect(returned(toDay(later[slug]))).toContain(law.id)
        expect(returned(toDay(later[slug]) - 1)).not.toContain(law.id)
      }
    })
    if (law.jurisdiction.until !== null) {
      it(`${slug} applies before the repeal bound and excludes its first day`, () => {
        expect(returned(law.jurisdiction.until! - 1)).toContain(law.id)
        expect(returned(law.jurisdiction.until!)).not.toContain(law.id)
      })
    }
    if (['frankpledge-tithing-duty', 'heriot', 'merchet', 'suit-of-mill', 'gleaning-bylaw', 'assize-of-bread-and-ale-c1266'].includes(slug)) {
      it(`${slug} has no sourced start and applies before 1215`, () => {
        expect(law.jurisdiction.from).toBeNull()
        expect(returned(toDay({ year: 1200, calendar: 'julian' }))).toContain(law.id)
      })
    }
  }
})
