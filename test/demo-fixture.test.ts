import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkLaws, createAuthorityProvider, loadManorFixture, loadProcedures, validateLaw, validateManorFixture } from '../src/index.ts'
import type { DemoVariant, ManorFixture } from '../src/index.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const sources = readFileSync(new URL('../data/demo/SOURCES.md', import.meta.url), 'utf8')
const raw = (): ManorFixture => JSON.parse(readFileSync(new URL('../data/demo/manor.json', import.meta.url), 'utf8'))
const assignments: Record<string, string[]> = {
  'office.lord': [], 'office.reeve': ['account', 'present', 'supervise-labour'],
  'office.beadle': ['levy', 'seize'], 'office.suitors': ['judge'],
}

describe('DESIGN section 3 manor fixture', () => {
  it.each<DemoVariant>(['A', 'B'])('%s loads sorted households and laws using the existing validators', variant => {
    const fixture = loadManorFixture(root, variant)
    expect(fixture.households).toHaveLength(60)
    expect(fixture.households.every(h => h.personality === null)).toBe(true)
    expect(fixture.households.map(h => h.id)).toEqual(fixture.households.map(h => h.id).sort())
    expect(fixture.laws.map(l => l.id)).toEqual(fixture.laws.map(l => l.id).sort())
    expect(checkLaws(fixture.laws, loadProcedures(root), ['economy.harvest'])).toEqual([])
    for (const law of fixture.laws) expect(validateLaw(law)).toEqual([])
    expect(validateManorFixture(raw(), sources)).toEqual([])
    expect(fixture.parameters).toEqual({ grainYieldBushelsPerAcre: [8, 9], householdSubsistenceBushelsPerYear: [36, 40] })
  })

  it.each<DemoVariant>(['A', 'B'])('%s grants only the power table assignments and requires an order for seizure', variant => {
    const fixture = loadManorFixture(root, variant)
    expect(Object.fromEntries(fixture.offices.map(o => [o.id, [...o.powers].sort()]))).toEqual(assignments)
    const authority = (ordered: boolean) => createAuthorityProvider(fixture.laws, name => {
      if (name === 'person.place' || name === 'office.seat') return fixture.place
      if (name === 'holds.permission') return ordered ? ['court-order-seizure'] : []
      if (name === 'actor.office') return null
      if (name === 'person.status') return 'tenant'
      throw new Error(`Unexpected read ${name}`)
    }, id => fixture.offices.some(o => o.id === id) ? id : null)
    for (const [office, expected] of Object.entries(assignments)) {
      for (const power of [...Object.values(assignments).flat(), 'legislate', 'permit']) {
        expect(authority(true).may(office, power, fixture.households[0].id, 0)).toBe(expected.includes(power))
      }
    }
    expect(authority(false).may('office.beadle', 'seize', fixture.households[0].id, 0)).toBe(false)
    expect(authority(false).may('office.beadle', 'levy', fixture.households[0].id, 0)).toBe(true)
  })

  it('keeps fixed rent in A and labels B remission and granary duty as unsourced', () => {
    const a = loadManorFixture(root, 'A'), b = loadManorFixture(root, 'B')
    expect(a.laws.find(l => l.tax)?.tax?.schedule.kind).toBe('fixed')
    expect(b.laws.find(l => l.tax)?.tax?.schedule.kind).toBe('proportional-with-remission')
    expect(a.laws.some(l => l.regulated.action === 'keep-granary')).toBe(false)
    for (const law of b.variants.B) {
      expect(law.consequence.kind === 'sanctions' && law.consequence.note).toContain('(unsourced)')
    }
    const theft = a.laws.find(l => l.regulated.action === 'steal')!
    expect(theft.procedure).toBe('procedure.manorial-court-presentment-by-jurors-or-homage')
    expect(theft.consequence).toMatchObject({ sanctions: [{ kind: 'fine', amount: null }] })
  })

  it('rejects each number when its exact source or modelling label is removed', () => {
    for (const path of Object.keys(raw().provenance)) {
      const data = raw()
      const leaf = path.slice(1).split('/').reduce<unknown>((node, key) =>
        (node as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')], data)
      if (typeof leaf !== 'number') continue
      delete data.provenance[path]
      expect(validateManorFixture(data, sources)).toContain(`${path}: number needs a source slug or modelling choice label`)
    }
    const data = raw()
    data.commonLaws[0].jurisdiction.from = 1
    expect(validateManorFixture(data, sources)).toContain('/commonLaws/0/jurisdiction/from: number needs a source slug or modelling choice label')
  })

  it('rejects nonexistent source slugs, stale pointers, malformed laws and mismatched counts', () => {
    const data = raw()
    data.provenance['/householdCount'] = { source: 'data/demo/SOURCES.md#invented' }
    data.provenance['/missing'] = { label: 'modelling choice' }
    data.households.pop()
    data.variants.A[0].tax!.schedule = { kind: 'fixed', amount: -1, unit: 'bushel' }
    const failures = validateManorFixture(data, sources)
    expect(failures).toContain('/householdCount: number needs a source slug or modelling choice label')
    expect(failures).toContain('/missing: provenance must point to a number or string')
    expect(failures).toContain('householdCount: must match households')
    expect(failures.some(f => f.includes('tax.schedule.amount'))).toBe(true)
  })

  it('(p1) accepts the declared string boundary provenance without requiring labels on strings', () => {
    const data = raw()
    const path = '/variants/B/0/tax/schedule/remitBoundary'
    expect(data.provenance[path]).toEqual({ label: 'modelling choice',
      note: 'Boundary of the illustrative remission (D-demo-1); unsourced. Strictly below reproduces the pre-5579 code.' })
    expect(validateManorFixture(data, sources)).toEqual([])
    delete data.provenance[path]
    expect(validateManorFixture(data, sources)).toEqual([])
  })

  it('(p2) rejects provenance on objects, arrays, booleans, null and missing paths', () => {
    const data = { ...raw(), booleanChoice: true }
    for (const path of ['/parameters', '/households', '/booleanChoice', '/households/0/personality', '/missing']) {
      data.provenance[path] = { label: 'modelling choice' }
      expect(validateManorFixture(data, sources)).toContain(`${path}: provenance must point to a number or string`)
      delete data.provenance[path]
    }
  })
})
