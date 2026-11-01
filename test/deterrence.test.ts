import { describe, expect, it } from 'vitest'
import { expectedSanction } from '../src/index.ts'
import type { SanctionFactors } from '../src/index.ts'

const fixture = (): SanctionFactors => ({
  detect: { value: 0.5, provenance: { kind: 'run', runId: 'run.detection-sample' } },
  prosecute: { value: 0.4, provenance: { kind: 'citation', citation: { key: 'fixture', title: 'Synthetic test evidence', year: null, locator: null } } },
  capacity: { value: 0.25, provenance: { kind: 'run', runId: 'run.capacity-sample' } },
})

describe('aggregate expected sanction', () => {
  it('multiplies detection, prosecution and capacity and preserves each factor provenance', () => {
    const factors = fixture()
    const result = expectedSanction(factors)
    expect(result.p_s).toBeCloseTo(0.05)
    expect(result.provenance).toEqual({ detect: factors.detect.provenance, prosecute: factors.prosecute.provenance, capacity: factors.capacity.provenance })
    factors.detect.provenance = { kind: 'run', runId: 'replacement' }
    factors.prosecute.provenance.kind === 'citation' && (factors.prosecute.provenance.citation.title = 'changed')
    expect(result.provenance.detect).toEqual({ kind: 'run', runId: 'run.detection-sample' })
    expect(result.provenance.prosecute).toMatchObject({ citation: { title: 'Synthetic test evidence' } })
  })
  it.each(['detect', 'prosecute', 'capacity'] as const)('accepts boundary probabilities for %s', name => {
    const factors = fixture()
    for (const key of ['detect', 'prosecute', 'capacity'] as const) factors[key].value = 1
    expect(expectedSanction(factors).p_s).toBe(1)
    factors[name].value = 0
    expect(expectedSanction(factors).p_s).toBe(0)
  })
  describe.each(['detect', 'prosecute', 'capacity'] as const)('%s factor is required and evidenced', name => {
    it.each([-0.01, 1.01, NaN, Infinity, -Infinity, '0.5', null, undefined])('rejects invalid probability %s', value => {
      const factors = fixture()
      expect(() => expectedSanction({ ...factors, [name]: { ...factors[name], value } } as SanctionFactors)).toThrow(`${name}.value`)
    })
    it.each([undefined, null, {}, { kind: 'default' }, { kind: 'run' }, { kind: 'run', runId: ' ' },
      { kind: 'citation' }, { kind: 'citation', citation: '' }, { kind: 'citation', citation: {} },
      { kind: 'citation', citation: { key: 'test', title: 'Test', year: Infinity, locator: null } },
      { kind: 'citation', citation: { key: 'test', title: 'Test', year: null, locator: '' } },
    ])('rejects missing or malformed provenance (%j)', provenance => {
      const factors = fixture()
      expect(() => expectedSanction({ ...factors, [name]: { value: 0.5, provenance } } as SanctionFactors)).toThrow(`${name}.provenance`)
    })
    it('rejects an omitted factor even when another factor is zero', () => {
      const factors = fixture() as unknown as Record<string, unknown>
      delete factors[name]
      expect(() => expectedSanction(factors as unknown as SanctionFactors)).toThrow(`${name}: factor required`)
      const zero = fixture()
      zero.detect.value = 0
      expect(() => expectedSanction({ ...zero, [name]: undefined } as unknown as SanctionFactors)).toThrow(`${name}: factor required`)
    })
  })
  it('rejects an absent input instead of supplying default factors', () => {
    expect(() => expectedSanction(undefined as unknown as SanctionFactors)).toThrow('sanction factors required')
  })
})
