import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanNoMeter } from '../src/nometer.ts'

const dirs: string[] = []

function scan(source: string): string[] {
  const root = mkdtempSync(join(tmpdir(), 'nometer-'))
  dirs.push(root)
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'x.ts'), source)
  return scanNoMeter(root)
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('no-meter check', () => {
  it('fails a stored field in an exported interface', () => {
    const out = scan('export interface Polity {\n  name: string\n  legitimacyScore: number\n}\n')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/^src\/x\.ts:3: stored meter field/)
  })

  it('fails a stored field in a type literal and a class field', () => {
    expect(scan('export type S = { governmentType: string }\n')).toHaveLength(1)
    expect(scan('export class C {\n  stability = 0\n}\n')).toHaveLength(1)
  })

  it('fails a module-level number holding a meter', () => {
    const out = scan('let corruptionRate = 0.2\n')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/^src\/x\.ts:1: module-level stored meter/)
  })

  it('passes a function that computes legitimacy', () => {
    expect(scan('export function legitimacy(beliefs: number[]): number {\n  return beliefs.length\n}\n')).toEqual([])
    expect(scan('export const legitimacy = (b: number[]) => b.length\n')).toEqual([])
  })

  it('passes a local variable inside a function', () => {
    expect(scan('export function f() {\n  const stability = 3\n  const o = { rebellionMeter: 1 }\n  return stability + o.rebellionMeter\n}\n')).toEqual([])
  })

  it('fails a module-level cache of authority or legitimacy', () => {
    const out = scan('const authorityCache = new Map<string, number>()\nconst legitimacyByAgent: Record<string, number> = {}\n')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatch(/module-level cache/)
  })

  it('ignores comments and strings', () => {
    expect(scan('// stability: number\nexport const s = "legitimacyScore: 1"\n')).toEqual([])
  })

  it('passes the repo itself', () => {
    expect(scanNoMeter('.')).toEqual([])
  })
})
