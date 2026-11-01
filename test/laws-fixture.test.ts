import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkLaws, loadLaws } from '../src/index.ts'
const root = fileURLToPath(new URL('../', import.meta.url))

describe('historical law fixture', () => {
  const loaded = loadLaws(root)
  const laws = loaded.laws

  it('loads every data/laws record with no check failures', () => {
    expect(loaded.entries.length).toBeGreaterThanOrEqual(20)
    expect(checkLaws(loaded)).toEqual([])
  })

  it('includes at least one prohibit, require, empower and void consequence', () => {
    const modalities = new Set(laws.map(law => law.modality))
    expect(modalities.has('prohibit')).toBe(true)
    expect(modalities.has('require')).toBe(true)
    expect(modalities.has('empower')).toBe(true)
    expect(laws.some(law => law.consequence.kind === 'void')).toBe(true)
  })

  it('cites a source on every record', () => {
    for (const law of laws) {
      expect(law.sources.length).toBeGreaterThan(0)
      expect(law.sources[0].key.length).toBeGreaterThan(0)
      expect(law.sources[0].title.length).toBeGreaterThan(0)
    }
  })

  it('validates each loaded law individually', () => {
    expect(laws.length).toBe(loaded.entries.length)
    for (const law of laws) expect(law.id.startsWith('government/law.')).toBe(true)
  })
})
