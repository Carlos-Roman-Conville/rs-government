import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLaws } from '../law/load.ts'
import { loadProcedures } from '../law/procedure.ts'
import type { LoadedProcedures } from '../law/procedure.ts'
import type { Law } from '../law/schema.ts'

export type DemoVariant = 'A' | 'B'
export interface DemoHousehold { id: string; place: string; status: string; personality: null }
export interface DemoOffice { id: string; name: string; powers: string[] }
export interface ManorFixture {
  id: string
  place: string
  householdCount: number
  households: DemoHousehold[]
  offices: DemoOffice[]
  parameters: { grainYieldBushelsPerAcre: [number, number]; householdSubsistenceBushelsPerYear: [number, number] }
  commonLaws: Law[]
  variants: Record<DemoVariant, Law[]>
  /** Exact JSON pointers keep provenance outside the existing executable law schema. */
  provenance: Record<string, { source?: string; label?: 'modelling choice'; note?: string }>
}
export interface LoadedManorFixture extends ManorFixture { variant: DemoVariant; laws: Law[] }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Validate fixture structure/provenance; all law validation belongs to checkLaws. */
export function validateManorFixture(value: unknown, sources: string, procedures?: LoadedProcedures): string[] {
  if (!object(value)) return ['fixture: expected object']
  const failures: string[] = []
  const slugs = new Set([...sources.matchAll(/^## ([a-z0-9-]+)\s*$/gm)].map(match => `data/demo/SOURCES.md#${match[1]}`))
  const provenance = object(value.provenance) ? value.provenance : {}
  const numbers = new Set<string>()
  function visit(node: unknown, path: string): void {
    if (typeof node === 'number') {
      numbers.add(path)
      const evidence = provenance[path]
      if (!Number.isFinite(node)) failures.push(`${path}: expected finite number`)
      if (!object(evidence) || !(evidence.label === 'modelling choice'
        || (typeof evidence.source === 'string' && slugs.has(evidence.source)))) {
        failures.push(`${path}: number needs a source slug or modelling choice label`)
      }
    } else if (Array.isArray(node)) node.forEach((item, i) => visit(item, `${path}/${i}`))
    else if (object(node)) for (const [key, item] of Object.entries(node)) {
      visit(item, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)
    }
  }
  visit(value, '')
  for (const path of Object.keys(provenance)) if (!numbers.has(path)) failures.push(`${path}: provenance must point to a number`)
  for (const field of ['id', 'place']) if (typeof value[field] !== 'string' || !value[field]) failures.push(`${field}: expected identifier`)
  for (const field of ['households', 'offices'] as const) {
    const rows = value[field]
    if (!Array.isArray(rows)) { failures.push(`${field}: expected array`); continue }
    const ids = new Set<string>()
    for (const row of rows) {
      if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
        failures.push(`${field}: expected unique identifiers`); continue
      }
      ids.add(row.id)
      if (field === 'households' && (row.place !== value.place || typeof row.status !== 'string' || row.personality !== null)) failures.push(`${row.id}: invalid household`)
      if (field === 'offices' && (typeof row.name !== 'string' || !Array.isArray(row.powers) || !row.powers.every(p => typeof p === 'string'))) failures.push(`${row.id}: invalid office`)
    }
  }
  if (!Number.isInteger(value.householdCount) || (value.householdCount as number) <= 0
    || !Array.isArray(value.households) || value.householdCount !== value.households.length) failures.push('householdCount: must match households')
  for (const key of ['grainYieldBushelsPerAcre', 'householdSubsistenceBushelsPerYear']) {
    const range = object(value.parameters) ? value.parameters[key] : undefined
    if (!Array.isArray(range) || range.length !== 2 || !range.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
      || range[0] > range[1]) failures.push(`parameters.${key}: expected positive ordered range`)
  }
  for (const variant of ['A', 'B']) {
    const laws = object(value.variants) ? value.variants[variant] : undefined
    if (!Array.isArray(value.commonLaws) || !Array.isArray(laws)) failures.push(`${variant}: expected law arrays`)
    else failures.push(...checkLaws([...value.commonLaws, ...laws], procedures).map(error => `${variant}: ${error}`))
  }
  return failures.sort()
}

/** Read initial fixture data only; no owner ports are called or owner state written. */
export function loadManorFixture(root: string, variant: DemoVariant): LoadedManorFixture {
  if (variant !== 'A' && variant !== 'B') throw new Error('variant: expected A or B')
  const data: unknown = JSON.parse(readFileSync(join(root, 'data/demo/manor.json'), 'utf8'))
  const failures = validateManorFixture(data, readFileSync(join(root, 'data/demo/SOURCES.md'), 'utf8'), loadProcedures(root))
  if (failures.length) throw new Error(failures.join('\n'))
  const fixture = data as ManorFixture
  return { ...fixture, variant, households: [...fixture.households].sort(byId), offices: [...fixture.offices].sort(byId),
    laws: [...fixture.commonLaws, ...fixture.variants[variant]].sort(byId) }
}
