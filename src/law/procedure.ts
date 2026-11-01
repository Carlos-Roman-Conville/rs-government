import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Citation } from './schema.ts'

export type ProcedureId = `government/procedure.${string}`
/** Descriptive evidence for the judge's mind; no text here is executed. */
export interface Procedure {
  id: ProcedureId
  court: string | null
  presidingOfficer: string | null
  judges: string | null
  begins: string | null
  proof: string | null
  appeal: string | null
  sources: Citation[]
  note: string
}
export interface LoadedProcedure { file: string; procedure: unknown }
export interface LoadedProcedures { procedures: Procedure[]; entries: LoadedProcedure[]; failures: string[] }
const procedureId = /^government\/procedure\.[a-z0-9]+(?:-[a-z0-9]+)*$/
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

/** Every field is required; null records a detail not stated in the source. */
export function validateProcedure(value: unknown): string[] {
  if (!object(value)) return ['procedure: expected object']
  const failures: string[] = []
  if (typeof value.id !== 'string' || !procedureId.test(value.id)) failures.push('id: expected government/procedure.<lowercase-kebab-slug>')
  for (const field of ['court', 'presidingOfficer', 'judges', 'begins', 'proof', 'appeal']) {
    if (value[field] !== null && !nonempty(value[field])) failures.push(`${field}: expected null or non-empty string`)
  }
  if (!nonempty(value.note)) failures.push('note: expected non-empty string')
  if (!Array.isArray(value.sources) || !value.sources.length) failures.push('sources: at least one citation required')
  else value.sources.forEach((source: unknown, i) => {
    const path = `sources[${i}]`
    if (!object(source)) { failures.push(`${path}: expected object`); return }
    for (const field of ['key', 'title']) {
      if (!nonempty(source[field])) failures.push(`${path}.${field}: expected non-empty string`)
    }
    if (source.year !== null && (typeof source.year !== 'number' || !Number.isFinite(source.year))) failures.push(`${path}.year: expected null or finite number`)
    if (source.locator !== null && !nonempty(source.locator)) failures.push(`${path}.locator: expected null or non-empty string`)
  })
  return failures.sort()
}

function recordId(value: unknown): string {
  return object(value) && typeof value.id === 'string' ? value.id : ''
}

/** Like loadLaws, an absent directory is an empty set; invalid files remain reportable. */
export function loadProcedures(root: string): LoadedProcedures {
  const dir = join(root, 'data', 'procedures')
  let files: string[]
  try { files = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort() }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { procedures: [], entries: [], failures: [] }
    throw error
  }
  const entries: LoadedProcedure[] = [], failures: string[] = []
  for (const name of files) {
    const file = `data/procedures/${name}`
    const contents = readFileSync(join(dir, name), 'utf8')
    let procedure: unknown
    try { procedure = JSON.parse(contents) as unknown }
    catch { failures.push(`${file}: bad JSON`); continue }
    entries.push({ file, procedure })
  }
  entries.sort((a, b) => compare(recordId(a.procedure), recordId(b.procedure)) || compare(a.file, b.file))
  return { procedures: entries.filter(entry => !validateProcedure(entry.procedure).length).map(entry => entry.procedure as Procedure), entries, failures: failures.sort() }
}

export function checkProcedures(input: LoadedProcedures | readonly unknown[]): string[] {
  const loaded = !Array.isArray(input) ? input as LoadedProcedures : undefined
  const entries = loaded?.entries ?? (input as readonly unknown[]).map((procedure, i) => ({ file: `procedures[${i}]`, procedure }))
  const failures = [...(loaded?.failures ?? [])], seen = new Set<string>()
  for (const { file, procedure } of entries) {
    failures.push(...validateProcedure(procedure).map(failure => `${file}: ${failure}`))
    const id = recordId(procedure)
    if (!id) continue
    if (seen.has(id)) failures.push(`${file}: duplicate id ${id}`)
    seen.add(id)
    if (loaded && basename(file, '.json') !== id.slice('government/procedure.'.length)) failures.push(`${file}: file name must match id slug ${id}`)
  }
  return failures.sort()
}
