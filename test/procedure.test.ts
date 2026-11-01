import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkLaws, checkProcedures, loadLaws, loadProcedures, validateProcedure } from '../src/index.ts'
import type { Procedure } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import { toDay } from '../scripts/calendar.ts'

const repo = fileURLToPath(new URL('../', import.meta.url))
const historical = loadProcedures(repo)
const fixture = (): Procedure => structuredClone(historical.procedures[0])
let root: string
beforeEach(() => {
  root = mkdtempSync(join(repo, '.procedure-test-'))
  mkdirSync(join(root, 'data', 'procedures'), { recursive: true })
})
afterEach(() => {
  if (dirname(resolve(root)) !== resolve(repo) || !root.startsWith(join(repo, '.procedure-test-'))) throw new Error('Test cleanup path escaped the repo')
  rmSync(root, { recursive: true, force: true })
})
function write(name: string, value: unknown): void {
  writeFileSync(join(root, 'data', 'procedures', name), JSON.stringify(value))
}

describe('procedure data and validation', () => {
  it('loads one record per supplied source section and resolves every historical law reference', () => {
    const sections = [...readFileSync(join(repo, 'data/procedures/SOURCES.md'), 'utf8').matchAll(/^## (.+)$/gm)].map(match => match[1].trim())
    expect(sections).toHaveLength(3)
    for (const slug of sections) {
      expect(historical.procedures.filter(p => p.id === `government/procedure.${slug}`)).toHaveLength(1)
    }
    expect(historical.procedures).toHaveLength(9)
    expect(checkProcedures(historical)).toEqual([])
    expect(checkLaws(loadLaws(repo, toDay), historical)).toEqual([])
    expect(historical.procedures.map(p => p.id)).toEqual(historical.procedures.map(p => p.id).sort())
  })
  it.each(historical.procedures.map(p => [p.id, p] as const))('loads and validates %s', (_id, procedure) => {
    expect(validateProcedure(procedure)).toEqual([])
    expect(procedure.appeal).toBeNull()
    expect(procedure.sources.length).toBeGreaterThan(0)
  })
  it.each(['id', 'court', 'presidingOfficer', 'judges', 'begins', 'proof', 'appeal', 'sources', 'note'])('rejects missing required %s', field => {
    const value = { ...fixture() } as Record<string, unknown>
    delete value[field]
    expect(validateProcedure(value)).toEqual([expect.stringMatching(new RegExp(`^${field}:`))])
    write('missing.json', value)
    const loaded = loadProcedures(root)
    expect(loaded.procedures).toEqual([])
    expect(checkProcedures(loaded)).toContainEqual(expect.stringContaining(`data/procedures/missing.json: ${field}:`))
  })
  it.each([null, [], 'text'])('rejects a non-record (%j)', value => {
    expect(validateProcedure(value)).toEqual(['procedure: expected object'])
  })
  it('rejects malformed ids, empty descriptions and incomplete citations', () => {
    expect(validateProcedure({ ...fixture(), id: 'procedure.not-qualified', court: ' ', sources: [{ key: '', title: '', year: NaN }] })).toEqual([
      'court: expected null or non-empty string',
      'id: expected government/procedure.<lowercase-kebab-slug>',
      'sources[0].key: expected non-empty string',
      'sources[0].locator: expected null or non-empty string',
      'sources[0].title: expected non-empty string',
      'sources[0].year: expected null or finite number',
    ])
    expect(validateProcedure({ ...fixture(), sources: [] })).toEqual(['sources: at least one citation required'])
    expect(validateProcedure({ ...fixture(), sources: [null] })).toEqual(['sources[0]: expected object'])
  })
  it('retains explicit nulls for unstated procedural details', () => {
    const p = { ...fixture(), court: null, presidingOfficer: null, judges: null, begins: null, proof: null, appeal: null }
    expect(validateProcedure(p)).toEqual([])
    write(`${p.id.split('.')[1]}.json`, p)
    expect(loadProcedures(root).procedures).toEqual([p])
  })
})

describe('procedure loading and references', () => {
  it('reports bad JSON, duplicates and filename mismatches deterministically while retaining valid data', () => {
    write('a.json', { ...fixture(), id: 'government/procedure.z' })
    write('z.json', { ...fixture(), id: 'government/procedure.a' })
    write('duplicate.json', { ...fixture(), id: 'government/procedure.a' })
    writeFileSync(join(root, 'data/procedures/broken.json'), '{')
    const loaded = loadProcedures(root)
    expect(loaded.procedures.map(p => p.id)).toEqual(['government/procedure.a', 'government/procedure.a', 'government/procedure.z'])
    expect(checkProcedures(loaded)).toEqual([
      'data/procedures/a.json: file name must match id slug government/procedure.z',
      'data/procedures/broken.json: bad JSON',
      'data/procedures/duplicate.json: file name must match id slug government/procedure.a',
      'data/procedures/z.json: duplicate id government/procedure.a',
      'data/procedures/z.json: file name must match id slug government/procedure.a',
    ])
  })
  it('treats a missing directory as empty and ignores notes and nested directories', () => {
    expect(loadProcedures(join(root, 'missing'))).toEqual({ procedures: [], entries: [], failures: [] })
    writeFileSync(join(root, 'data/procedures/notes.md'), 'notes')
    mkdirSync(join(root, 'data/procedures/nested.json'))
    expect(checkProcedures(loadProcedures(root))).toEqual([])
  })
  it('resolves qualified and legacy local references, permits null, and rejects unknown references', () => {
    const p = fixture()
    for (const procedure of [null, p.id, p.id.slice('government/'.length)]) {
      expect(checkLaws([{ ...lawFixture(), procedure }], historical)).toEqual([])
    }
    for (const procedure of ['government/procedure.missing', 'procedure.missing', 'other/procedure.justices-quarterly']) {
      expect(checkLaws([{ ...lawFixture(), procedure }], historical)).toEqual([`laws[0]: procedure target missing: ${procedure}`])
    }
    expect(checkLaws([{ ...lawFixture(), procedure: p.id }], [])).toEqual([`laws[0]: procedure target missing: ${p.id}`])
  })
  it('reports invalid loaded procedures and does not resolve a law to an invalid record', () => {
    const p = fixture()
    write(`${p.id.split('.')[1]}.json`, { ...p, proof: 42 })
    expect(checkLaws([{ ...lawFixture(), procedure: p.id }], loadProcedures(root))).toEqual([
      `data/procedures/${p.id.split('.')[1]}.json: proof: expected null or non-empty string`,
      `laws[0]: procedure target missing: ${p.id}`,
    ])
  })
})

describe('check-procedures CLI', () => {
  function cli() {
    for (const file of ['scripts/check-procedures.ts', 'src/law/procedure.ts']) {
      const destination = join(root, file)
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(join(repo, file), destination)
    }
    writeFileSync(join(root, 'package.json'), '{"type":"module"}')
    return spawnSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/check-procedures.ts')], { cwd: repo, encoding: 'utf8' })
  }
  it('uses its own repo root and reports a valid record count', () => {
    const p = fixture()
    write(`${p.id.split('.')[1]}.json`, p)
    const result = cli()
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('procedures: 1 records, 0 failures')
  })
  it('exits one with a filename for invalid data', () => {
    writeFileSync(join(root, 'data/procedures/bad.json'), '{')
    const result = cli()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('data/procedures/bad.json: bad JSON')
    expect(result.stdout).toBe('')
  })
})
