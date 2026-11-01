import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkLaws, loadLaws } from '../src/index.ts'
import { toDay } from '../scripts/calendar.ts'
const root = fileURLToPath(new URL('../', import.meta.url))

describe('historical law fixture', () => {
  const loaded = loadLaws(root, toDay)
  const laws = loaded.laws

  it('loads every data/laws record with no check failures', () => {
    expect(loaded.entries.length).toBeGreaterThanOrEqual(20)
    expect(checkLaws(loaded)).toEqual([])
  })

  it('includes at least one prohibit, require, permit and void consequence', () => {
    const modalities = new Set(laws.map(law => law.modality))
    expect(modalities.has('prohibit')).toBe(true)
    expect(modalities.has('require')).toBe(true)
    expect(modalities.has('permit')).toBe(true)
    expect(laws.some(law => law.consequence.kind === 'void')).toBe(true)
  })

  it('cites a source on every record', () => {
    for (const law of laws) {
      expect(law.sources.length).toBeGreaterThan(0)
      expect(law.sources[0].key.length).toBeGreaterThan(0)
      expect(law.sources[0].title.length).toBeGreaterThan(0)
    }
  })

  it('keeps historical repeals in date bounds and Merton as a permit without a power or fine', () => {
    expect(laws.every(law => law.status === 'in-force')).toBe(true)
    const merton = laws.find(law => law.id === 'government/law.merton-1235-c4-approvement-of-commons')!
    expect(merton.modality).toBe('permit')
    expect(merton.regulated).not.toHaveProperty('power')
    expect(merton.consequence).toEqual({ kind: 'sanctions', sanctions: [], note: expect.stringContaining('tenants may complain by writ') })
    expect(JSON.stringify(merton.consequence).toLowerCase()).not.toContain('fine')
    const repeals: Record<string, number> = {
      'merton-1235-c4-approvement-of-commons': 2006,
      'westminster-2-1285-c46-approvement': 2006,
      'assize-of-bread-and-ale-c1266': 1863,
      'forestalling-regrating': 1844,
      'diet-and-apparel-1363-yeomen-and-servants': 1863,
    }
    for (const law of laws) {
      const year = repeals[law.id.slice('government/law.'.length)]
      expect(law.jurisdiction.until).toBe(year ? toDay({ year, calendar: 'gregorian' }) : null)
    }
  })

  it('validates each loaded law individually', () => {
    expect(laws.length).toBe(loaded.entries.length)
    for (const law of laws) expect(law.id.startsWith('government/law.')).toBe(true)
  })
})
