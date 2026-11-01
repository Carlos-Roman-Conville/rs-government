import type { Citation } from '../law/schema.ts'

export type FactorProvenance = { kind: 'run'; runId: string } | { kind: 'citation'; citation: Citation }
export interface SanctionFactor { value: number; provenance: FactorProvenance }
export interface SanctionFactors { detect: SanctionFactor; prosecute: SanctionFactor; capacity: SanctionFactor }
export interface ExpectedSanction {
  p_s: number
  provenance: { detect: FactorProvenance; prosecute: FactorProvenance; capacity: FactorProvenance }
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

function validateFactor(factor: unknown, name: string): void {
  if (!object(factor)) throw new Error(`${name}: factor required`)
  if (typeof factor.value !== 'number' || !Number.isFinite(factor.value) || factor.value < 0 || factor.value > 1) {
    throw new Error(`${name}.value: expected finite number in [0,1]`)
  }
  const p = factor.provenance
  if (!object(p)) throw new Error(`${name}.provenance: required`)
  if (p.kind === 'run') {
    if (!nonempty(p.runId)) throw new Error(`${name}.provenance.runId: expected non-empty string`)
  } else if (p.kind === 'citation') {
    const c = p.citation
    if (!object(c) || !nonempty(c.key) || !nonempty(c.title)
      || (c.year !== null && (typeof c.year !== 'number' || !Number.isFinite(c.year)))
      || (c.locator !== null && !nonempty(c.locator))) throw new Error(`${name}.provenance.citation: expected Citation`)
  } else throw new Error(`${name}.provenance.kind: expected run|citation`)
}

/** Factors must be supplied from runs or sources; procedural justice belongs to §1.8. */
export function expectedSanction(factors: SanctionFactors): ExpectedSanction {
  if (!object(factors)) throw new Error('sanction factors required')
  for (const name of ['detect', 'prosecute', 'capacity'] as const) validateFactor(factors[name], name)
  return {
    p_s: factors.detect.value * factors.prosecute.value * factors.capacity.value,
    provenance: structuredClone({ detect: factors.detect.provenance, prosecute: factors.prosecute.provenance, capacity: factors.capacity.provenance }),
  }
}
