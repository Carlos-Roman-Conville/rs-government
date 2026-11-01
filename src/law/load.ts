import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { validateLaw, validateLawData } from './schema.ts'
import type { Law, LawData } from './schema.ts'
import { normalizeCalendarPoint } from './calendar.ts'
import type { ToDay } from './calendar.ts'
import { checkProcedures } from './procedure.ts'
import type { LoadedProcedures, Procedure } from './procedure.ts'

/** Entries retain invalid parsed data so the checker can report every file. */
export interface LoadedLaw { file: string; law: unknown; failures?: string[] }
export interface LoadedLaws { laws: Law[]; entries: LoadedLaw[]; failures: string[] }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const authorityId = /^authority\.[a-z0-9]+(?:-[a-z0-9]+)*$/
// Existing schema/loader and Settlement integration fixture IDs are explicit exceptions.
const fixtureIds: readonly string[] = ['fixture', 'office.council', 'fixture-council']
function recordId(value: unknown): string | undefined {
  return value !== null && typeof value === 'object' && 'id' in value && typeof value.id === 'string' ? value.id : undefined
}

/** Read only data/laws/*.json; a missing directory is an empty law set. */
export function loadLaws(root: string, toDay: ToDay): LoadedLaws {
  const dir = join(root, 'data', 'laws')
  let files: string[]
  try { files = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name).sort() }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { laws: [], entries: [], failures: [] }
    throw error
  }
  const entries: LoadedLaw[] = [], failures: string[] = []
  for (const name of files) {
    const file = `data/laws/${name}`
    const contents = readFileSync(join(dir, name), 'utf8')
    let law: unknown
    try { law = JSON.parse(contents) as unknown }
    catch { failures.push(`${file}: bad JSON`); continue }
    const errors = validateLawData(law)
    if (!errors.length) {
      const data = law as LawData
      const jurisdiction = { ...data.jurisdiction, from: null as number | null, until: null as number | null }
      for (const key of ['from', 'until'] as const) {
        if (data.jurisdiction[key] === null) continue
        try {
          const day = toDay(normalizeCalendarPoint(data.jurisdiction[key]))
          if (typeof day !== 'number' || !Number.isFinite(day)) errors.push(`jurisdiction.${key}: expected finite number`)
          else jurisdiction[key] = day
        }
        catch (error) { errors.push(`jurisdiction.${key}: toDay failed: ${error instanceof Error ? error.message : String(error)}`) }
      }
      if (!errors.length) {
        law = { ...data, enactment: data.enactment ?? null, jurisdiction }
        errors.push(...validateLaw(law))
      }
    }
    entries.push(errors.length ? { file, law, failures: errors } : { file, law })
  }
  entries.sort((a, b) => compare(recordId(a.law) ?? '', recordId(b.law) ?? '') || compare(a.file, b.file))
  return { laws: entries.filter(entry => !entry.failures?.length).map(entry => entry.law as Law), entries, failures: failures.sort() }
}

/** Check loaded files (including parse failures), or an in-memory collection. */
export function checkLaws(input: LoadedLaws | readonly unknown[], procedures?: LoadedProcedures | readonly Procedure[], declaredReads?: readonly string[]): string[] {
  const loaded = !Array.isArray(input) ? input as LoadedLaws : undefined
  const entries: LoadedLaw[] = loaded?.entries ?? (input as readonly unknown[]).map((law, i) => ({ file: `laws[${i}]`, law }))
  const failures = [...(loaded?.failures ?? []), ...(procedures ? checkProcedures(procedures) : [])]
  const procedureIds = procedures === undefined ? undefined : new Set(
    (Array.isArray(procedures) ? procedures as readonly Procedure[] : (procedures as LoadedProcedures).procedures).map(procedure => procedure.id))
  const ids = new Set(entries.map(entry => recordId(entry.law)).filter((id): id is string => id !== undefined))
  const seen = new Set<string>()
  for (const { file, law, failures: errors } of entries) {
    failures.push(...(errors ?? validateLaw(law)).map(failure => `${file}: ${failure}`))
    if (law !== null && typeof law === 'object') {
      const row = law as Record<string, unknown>
      if (declaredReads && row.tax !== null && typeof row.tax === 'object' && 'base' in row.tax
        && typeof row.tax.base === 'string' && !declaredReads.includes(row.tax.base)) {
        failures.push(`${file}: tax.base: undeclared read ${row.tax.base}`)
      }
      // Existing law fixtures use local procedure.* references; records carry the engine prefix.
      if (procedureIds && typeof row.procedure === 'string') {
        const target = row.procedure.startsWith('procedure.') ? `government/${row.procedure}` : row.procedure
        if (!procedureIds.has(target as Procedure['id'])) failures.push(`${file}: procedure target missing: ${row.procedure}`)
      }
      const jurisdiction = row.jurisdiction
      const authority = jurisdiction !== null && typeof jurisdiction === 'object'
        ? (jurisdiction as Record<string, unknown>).authority : undefined
      for (const [path, value] of [['issuer', row.issuer], ['jurisdiction.authority', authority]] as const) {
        if (typeof value === 'string' && !fixtureIds.includes(value) && !authorityId.test(value)) {
          failures.push(`${file}: ${path}: expected null, authority.<lowercase-kebab-slug>, or fixture ID (fixture, office.council, fixture-council)`)
        }
      }
    }
    const id = recordId(law)
    if (id !== undefined) {
      if (seen.has(id)) failures.push(`${file}: duplicate id ${id}`)
      seen.add(id)
      if (loaded && basename(file, '.json') !== id.slice('government/law.'.length)) failures.push(`${file}: file name must match id slug ${id}`)
    }
    if (law !== null && typeof law === 'object' && 'supersedes' in law && Array.isArray(law.supersedes)) {
      for (const target of law.supersedes) {
        if (typeof target === 'string' && !ids.has(target)) failures.push(`${file}: supersedes target missing: ${target}`)
      }
    }
  }
  return failures.sort()
}
