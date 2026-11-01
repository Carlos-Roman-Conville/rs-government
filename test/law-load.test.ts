import { mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadLaws, checkLaws } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const repo = fileURLToPath(new URL('../', import.meta.url))
let root: string
function write(name: string, law: unknown): void { writeFileSync(join(root, 'data', 'laws', name), JSON.stringify(law)) }
beforeEach(() => {
  root = mkdtempSync(join(repo, '.law-test-'))
  mkdirSync(join(root, 'data', 'laws'), { recursive: true })
})
afterEach(() => {
  if (dirname(resolve(root)) !== resolve(repo) || !root.startsWith(join(repo, '.law-test-'))) throw new Error('Test cleanup path escaped the repo')
  rmSync(root, { recursive: true, force: true })
})

describe('law loading and checks', () => {
  it('accepts an empty data/laws directory', () => {
    expect(loadLaws(root)).toEqual({ laws: [], entries: [], failures: [] })
    expect(checkLaws(loadLaws(root))).toEqual([])
  })
  it('accepts a missing data/laws directory', () => expect(checkLaws(loadLaws(join(root, 'missing')))).toEqual([]))
  it('reads every JSON law and sorts by id rather than filename', () => {
    write('a.json', lawFixture('z'))
    write('z.json', lawFixture('a'))
    expect(loadLaws(root).laws.map(law => law.id)).toEqual(['government/law.a', 'government/law.z'])
  })
  it('ignores non-JSON files and nested directories', () => {
    writeFileSync(join(root, 'data', 'laws', 'notes.txt'), 'notes')
    mkdirSync(join(root, 'data', 'laws', 'nested.json'))
    writeFileSync(join(root, 'data', 'laws', 'nested.json', 'bad.json'), '{')
    expect(checkLaws(loadLaws(root))).toEqual([])
  })
  it('reports bad JSON with its filename and continues loading', () => {
    writeFileSync(join(root, 'data', 'laws', 'broken.json'), '{')
    write('fixture.json', lawFixture())
    const loaded = loadLaws(root)
    expect(loaded.laws).toHaveLength(1)
    expect(checkLaws(loaded)).toEqual(['data/laws/broken.json: bad JSON'])
  })
  it('reports schema failures with filenames and excludes invalid laws from the typed collection', () => {
    write('fixture.json', { ...lawFixture(), condition: 'free text' })
    const loaded = loadLaws(root)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: condition: expected true or a predicate object'])
  })
  it('rejects multiple law records in one file', () => {
    write('fixture.json', [lawFixture()])
    expect(checkLaws(loadLaws(root))).toEqual(['data/laws/fixture.json: law: expected object'])
  })
  it('reports duplicate ids', () => {
    write('fixture.json', lawFixture())
    write('duplicate.json', lawFixture())
    expect(checkLaws(loadLaws(root))).toContain('data/laws/fixture.json: duplicate id government/law.fixture')
  })
  it('requires a file name matching the id slug', () => {
    write('wrong.json', lawFixture())
    expect(checkLaws(loadLaws(root))).toEqual(['data/laws/wrong.json: file name must match id slug government/law.fixture'])
  })
  it('reports missing supersedes targets', () => {
    write('fixture.json', { ...lawFixture(), supersedes: ['government/law.missing'] })
    expect(checkLaws(loadLaws(root))).toEqual(['data/laws/fixture.json: supersedes target missing: government/law.missing'])
  })
  it('resolves supersedes across files regardless of load order', () => {
    write('a.json', { ...lawFixture('a'), supersedes: ['government/law.z'] })
    write('z.json', lawFixture('z'))
    expect(checkLaws(loadLaws(root))).toEqual([])
  })
  it('validates in-memory laws and their duplicate and supersedes relationships', () => {
    expect(checkLaws([lawFixture()])).toEqual([])
    expect(checkLaws([lawFixture(), { ...lawFixture(), supersedes: ['government/law.missing'] }])).toEqual([
      'laws[1]: duplicate id government/law.fixture', 'laws[1]: supersedes target missing: government/law.missing',
    ])
    expect(checkLaws([null])).toEqual(['laws[0]: law: expected object'])
  })
  it('returns deterministic sorted failures from mixed file errors', () => {
    write('z.json', null)
    writeFileSync(join(root, 'data', 'laws', 'a.json'), '{')
    const errors = checkLaws(loadLaws(root))
    expect(errors).toEqual(['data/laws/a.json: bad JSON', 'data/laws/z.json: law: expected object'])
    expect(checkLaws(loadLaws(root))).toEqual(errors)
  })
})

describe('check-laws CLI', () => {
  function cli() {
    for (const file of ['scripts/check-laws.ts', 'src/law/load.ts', 'src/law/schema.ts', 'src/law/predicate.ts']) {
      const destination = join(root, file)
      mkdirSync(join(destination, '..'), { recursive: true })
      copyFileSync(join(repo, file), destination)
    }
    writeFileSync(join(root, 'package.json'), '{"type":"module"}')
    return spawnSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts', 'check-laws.ts')], { cwd: repo, encoding: 'utf8' })
  }
  it('prints the empty-law summary and exits zero using its repo rather than cwd', () => {
    const result = cli()
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('laws: 0 records, 0 failures')
  })
  it('prints the loaded law count on success', () => {
    write('fixture.json', lawFixture())
    const result = cli()
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('laws: 1 records, 0 failures')
  })
  it('prints failures and exits one for invalid law files', () => {
    writeFileSync(join(root, 'data', 'laws', 'bad.json'), '{')
    const result = cli()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('data/laws/bad.json: bad JSON')
    expect(result.stdout).toBe('')
  })
})
