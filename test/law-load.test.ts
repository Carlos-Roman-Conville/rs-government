import { mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadLaws, checkLaws } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'
import type { LawData } from '../src/index.ts'
import { toDay } from '../scripts/calendar.ts'

function dataFixture(slug = 'fixture'): LawData {
  const law = lawFixture(slug)
  return { ...law, jurisdiction: { ...law.jurisdiction, from: { year: 1235, calendar: 'julian' }, until: null } }
}

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
  it('loads a missing historical enactment as null without changing the source file', () => {
    const law = dataFixture()
    delete law.enactment
    write('fixture.json', law)
    const loaded = loadLaws(root, toDay)
    expect(checkLaws(loaded)).toEqual([])
    expect(loaded.laws[0].enactment).toBeNull()
    expect(JSON.parse(readFileSync(join(root, 'data', 'laws', 'fixture.json'), 'utf8'))).not.toHaveProperty('enactment')
  })
  it.each([null, { year: 1953, month: 12, day: 18, calendar: 'gregorian' } as const])('preserves no sourced start and converts only a non-null until (%j)', until => {
    const law = dataFixture()
    law.jurisdiction = { ...law.jurisdiction, from: null, until }
    write('fixture.json', law)
    const hostCalendar = vi.fn(toDay)
    const loaded = loadLaws(root, hostCalendar)
    expect(checkLaws(loaded)).toEqual([])
    expect(loaded.laws[0].jurisdiction).toMatchObject({ from: null, until: until === null ? null : toDay(until) })
    expect(hostCalendar.mock.calls).toEqual(until === null ? [] : [[until]])
  })
  it('normalizes year-only from and until to January 1 through the caller calendar', () => {
    const law = dataFixture()
    law.jurisdiction.until = { year: 2006, calendar: 'gregorian' }
    write('fixture.json', law)
    const hostCalendar = vi.fn(() => 0).mockReturnValueOnce(17).mockReturnValueOnce(300)
    const loaded = loadLaws(root, hostCalendar)
    expect(hostCalendar.mock.calls).toEqual([
      [{ year: 1235, month: 1, day: 1, calendar: 'julian' }],
      [{ year: 2006, month: 1, day: 1, calendar: 'gregorian' }],
    ])
    expect(checkLaws(loaded)).toEqual([])
    expect(loaded.laws[0].jurisdiction).toMatchObject({ from: 17, until: 300 })
  })
  it('preserves precise dates and normalizes a month-only bound to its first day', () => {
    const law = dataFixture()
    law.jurisdiction.from = { year: 1217, month: 11, day: 6, calendar: 'julian' }
    law.jurisdiction.until = { year: 2006, month: 7, calendar: 'gregorian' }
    write('fixture.json', law)
    const hostCalendar = vi.fn(toDay)
    const loaded = loadLaws(root, hostCalendar)
    expect(checkLaws(loaded)).toEqual([])
    expect(hostCalendar.mock.calls).toEqual([
      [law.jurisdiction.from], [{ year: 2006, month: 7, day: 1, calendar: 'gregorian' }],
    ])
  })
  it('keeps null until open without asking the host to convert it', () => {
    write('fixture.json', dataFixture())
    const hostCalendar = vi.fn(toDay)
    expect(loadLaws(root, hostCalendar).laws[0].jurisdiction.until).toBeNull()
    expect(hostCalendar).toHaveBeenCalledTimes(1)
  })
  it.each([
    1235, undefined, { year: 1235 }, { year: 1235.5, calendar: 'julian' },
    { year: 1235, calendar: 'unknown' }, { year: 1235, month: 13, calendar: 'julian' },
    { year: 1235, day: 2, calendar: 'julian' }, { year: 1235, month: null, calendar: 'julian' },
    { year: 1235, month: 2, day: 29, calendar: 'julian' },
    { year: 1700, month: 2, day: 29, calendar: 'gregorian' },
    { year: 1235, month: 4, day: 31, calendar: 'julian' },
  ])('rejects an invalid from calendar point before calling the host (%j)', from => {
    const law = dataFixture()
    write('fixture.json', { ...law, jurisdiction: { ...law.jurisdiction, from } })
    const hostCalendar = vi.fn(toDay)
    const loaded = loadLaws(root, hostCalendar)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual([expect.stringContaining('data/laws/fixture.json: jurisdiction.from:')])
    expect(hostCalendar).not.toHaveBeenCalled()
  })
  it('rejects an invalid until point with its field and filename', () => {
    const law = dataFixture()
    law.jurisdiction.until = { year: 2006, month: 2, day: 30, calendar: 'gregorian' }
    write('fixture.json', law)
    const loaded = loadLaws(root, toDay)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: jurisdiction.until: invalid day for month and calendar'])
  })
  it('rejects reversed bounds after conversion across calendars', () => {
    const law = dataFixture()
    law.jurisdiction.from = { year: 1700, month: 3, day: 1, calendar: 'julian' }
    law.jurisdiction.until = { year: 1700, month: 3, day: 1, calendar: 'gregorian' }
    write('fixture.json', law)
    const loaded = loadLaws(root, toDay)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: jurisdiction.until: must be at least from'])
  })
  it('reports host conversion failures and continues with other files', () => {
    write('fixture.json', dataFixture())
    const second = dataFixture('second')
    second.jurisdiction.from = { year: 1285, calendar: 'julian' }
    write('second.json', second)
    const loaded = loadLaws(root, point => {
      if (point.year === 1235) throw new Error('host date unavailable')
      return 42
    })
    expect(loaded.laws.map(law => law.id)).toEqual(['government/law.second'])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: jurisdiction.from: toDay failed: host date unavailable'])
  })
  it.each([NaN, Infinity, null, undefined])('rejects a non-numeric or non-finite host day (%s)', day => {
    write('fixture.json', dataFixture())
    const loaded = loadLaws(root, () => day as number)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: jurisdiction.from: expected finite number'])
  })
  it('accepts an empty data/laws directory', () => {
    expect(loadLaws(root, toDay)).toEqual({ laws: [], entries: [], failures: [] })
    expect(checkLaws(loadLaws(root, toDay))).toEqual([])
  })
  it('accepts a missing data/laws directory', () => expect(checkLaws(loadLaws(join(root, 'missing'), toDay))).toEqual([]))
  it('reads every JSON law and sorts by id rather than filename', () => {
    write('a.json', dataFixture('z'))
    write('z.json', dataFixture('a'))
    expect(loadLaws(root, toDay).laws.map(law => law.id)).toEqual(['government/law.a', 'government/law.z'])
  })
  it('ignores non-JSON files and nested directories', () => {
    writeFileSync(join(root, 'data', 'laws', 'notes.txt'), 'notes')
    mkdirSync(join(root, 'data', 'laws', 'nested.json'))
    writeFileSync(join(root, 'data', 'laws', 'nested.json', 'bad.json'), '{')
    expect(checkLaws(loadLaws(root, toDay))).toEqual([])
  })
  it('reports bad JSON with its filename and continues loading', () => {
    writeFileSync(join(root, 'data', 'laws', 'broken.json'), '{')
    write('fixture.json', dataFixture())
    const loaded = loadLaws(root, toDay)
    expect(loaded.laws).toHaveLength(1)
    expect(checkLaws(loaded)).toEqual(['data/laws/broken.json: bad JSON'])
  })
  it('reports schema failures with filenames and excludes invalid laws from the typed collection', () => {
    write('fixture.json', { ...dataFixture(), condition: 'free text' })
    const loaded = loadLaws(root, toDay)
    expect(loaded.laws).toEqual([])
    expect(checkLaws(loaded)).toEqual(['data/laws/fixture.json: condition: expected true or a predicate object'])
  })
  it('rejects multiple law records in one file', () => {
    write('fixture.json', [dataFixture()])
    expect(checkLaws(loadLaws(root, toDay))).toEqual(['data/laws/fixture.json: law: expected object'])
  })
  it('reports duplicate ids', () => {
    write('fixture.json', dataFixture())
    write('duplicate.json', dataFixture())
    expect(checkLaws(loadLaws(root, toDay))).toContain('data/laws/fixture.json: duplicate id government/law.fixture')
  })
  it('requires a file name matching the id slug', () => {
    write('wrong.json', dataFixture())
    expect(checkLaws(loadLaws(root, toDay))).toEqual(['data/laws/wrong.json: file name must match id slug government/law.fixture'])
  })
  it('reports missing supersedes targets', () => {
    write('fixture.json', { ...dataFixture(), supersedes: ['government/law.missing'] })
    expect(checkLaws(loadLaws(root, toDay))).toEqual(['data/laws/fixture.json: supersedes target missing: government/law.missing'])
  })
  it('resolves supersedes across files regardless of load order', () => {
    write('a.json', { ...dataFixture('a'), supersedes: ['government/law.z'] })
    write('z.json', dataFixture('z'))
    expect(checkLaws(loadLaws(root, toDay))).toEqual([])
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
    const errors = checkLaws(loadLaws(root, toDay))
    expect(errors).toEqual(['data/laws/a.json: bad JSON', 'data/laws/z.json: law: expected object'])
    expect(checkLaws(loadLaws(root, toDay))).toEqual(errors)
  })
})

describe('checker proleptic calendar adapter', () => {
  it('uses Gregorian 1970-01-01 as day zero in both calendar representations', () => {
    expect(toDay({ year: 1970, month: 1, day: 1, calendar: 'gregorian' })).toBe(0)
    expect(toDay({ year: 1969, month: 12, day: 19, calendar: 'julian' })).toBe(0)
    expect(toDay({ year: 1969, month: 12, day: 31, calendar: 'gregorian' })).toBe(-1)
  })
  it('uses Julian leap centuries and Gregorian century exceptions', () => {
    for (const calendar of ['julian', 'gregorian'] as const) {
      const difference = toDay({ year: 1700, month: 3, day: 1, calendar })
        - toDay({ year: 1700, month: 2, day: 28, calendar })
      expect(difference).toBe(calendar === 'julian' ? 2 : 1)
      expect(toDay({ year: 1600, month: 3, day: 1, calendar })
        - toDay({ year: 1600, month: 2, day: 28, calendar })).toBe(2)
    }
    expect(toDay({ year: 1700, month: 2, day: 29, calendar: 'julian' }))
      .toBe(toDay({ year: 1700, month: 3, day: 11, calendar: 'gregorian' }))
  })
})

describe('check-laws CLI', () => {
  function cli() {
    for (const file of ['scripts/check-laws.ts', 'scripts/calendar.ts', 'src/law/calendar.ts', 'src/law/load.ts', 'src/law/schema.ts', 'src/law/predicate.ts']) {
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
    write('fixture.json', dataFixture())
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
