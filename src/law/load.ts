import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { validateLaw, validateLawData } from './schema.ts'
import type { Law, LawData } from './schema.ts'
import { normalizeCalendarPoint } from './calendar.ts'
import type { ToDay } from './calendar.ts'

/** Entries retain invalid parsed data so the checker can report every file. */
export interface LoadedLaw { file: string; law: unknown; failures?: string[] }
export interface LoadedLaws { laws: Law[]; entries: LoadedLaw[]; failures: string[] }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
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
      const jurisdiction = { ...data.jurisdiction, from: NaN, until: null as number | null }
      for (const key of ['from', 'until'] as const) {
        if (key === 'until' && data.jurisdiction[key] === null) continue
        try { jurisdiction[key] = toDay(normalizeCalendarPoint(data.jurisdiction[key])) }
        catch (error) { errors.push(`jurisdiction.${key}: toDay failed: ${error instanceof Error ? error.message : String(error)}`) }
      }
      if (!errors.length) {
        law = { ...data, jurisdiction }
        errors.push(...validateLaw(law))
      }
    }
    entries.push(errors.length ? { file, law, failures: errors } : { file, law })
  }
  entries.sort((a, b) => compare(recordId(a.law) ?? '', recordId(b.law) ?? '') || compare(a.file, b.file))
  return { laws: entries.filter(entry => !entry.failures?.length).map(entry => entry.law as Law), entries, failures: failures.sort() }
}

/** Check loaded files (including parse failures), or an in-memory collection. */
export function checkLaws(input: LoadedLaws | readonly unknown[]): string[] {
  const loaded = !Array.isArray(input) ? input as LoadedLaws : undefined
  const entries: LoadedLaw[] = loaded?.entries ?? (input as readonly unknown[]).map((law, i) => ({ file: `laws[${i}]`, law }))
  const failures = [...(loaded?.failures ?? [])]
  const ids = new Set(entries.map(entry => recordId(entry.law)).filter((id): id is string => id !== undefined))
  const seen = new Set<string>()
  for (const { file, law, failures: errors } of entries) {
    failures.push(...(errors ?? validateLaw(law)).map(failure => `${file}: ${failure}`))
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
