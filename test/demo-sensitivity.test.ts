import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderSensitivity, runSensitivityGrid, sensitivityGrid } from '../scripts/demo-sensitivity.ts'

const sources = readFileSync(new URL('../data/demo/SOURCES.md', import.meta.url), 'utf8')

describe('GOV-16 host sensitivity without tuning', () => {
  it('covers every recorded yield fraction and labels every input sourced or stub, with null stocks left at zero', () => {
    const grid = sensitivityGrid(sources)
    expect(grid.map(setting => setting.shockMultiplier.value)).toEqual([0.1, 0.61, 0.37, 0.9, 0.6, 0.4])
    for (const setting of grid) {
      expect(setting.shockMultiplier.label).toBe(setting.shockMultiplier.value === 0.1
        ? 'stub (unsourced)' : 'sourced (harvest-loss-1315)')
      expect(setting.granaryGrain).toEqual({ value: 0, label: 'stub (unsourced)' })
      expect(setting.householdGrain).toEqual({ value: 0, label: 'stub (unsourced)' })
    }
  })

  it('uses only the stub shock when the harvest Value is null and fails closed on unknown units', () => {
    const replaceHarvest = (value: string) => sources.replace(/(## harvest-loss-1315\r?\n- Value: )[^\r\n]+/, `$1${value}`)
    expect(sensitivityGrid(replaceHarvest('null'))).toHaveLength(1)
    expect(() => sensitivityGrid(replaceHarvest('39 percent lost'))).toThrow('units')
    expect(sensitivityGrid(replaceHarvest('retained fraction 0.37–0.61'))
      .map(setting => setting.shockMultiplier.value)).toEqual([0.1, 0.37, 0.61])
  })

  it('replays every seed and setting to the same rows and reproduces the committed evidence report', () => {
    const rows = runSensitivityGrid(sources)
    expect(rows).toHaveLength(24)
    expect(runSensitivityGrid(sources)).toEqual(rows)
    for (const setting of sensitivityGrid(sources)) {
      const group = rows.filter(row => JSON.stringify(row.setting) === JSON.stringify(setting))
      expect(group.map(row => [row.variant, row.seed])).toEqual([['A', 42], ['B', 42], ['A', 43], ['B', 43]])
      for (const row of group) {
        expect(row.evidence.after.cause).toContain('attributed to court')
        expect(row.evidence.postDay).toBe(730)
      }
    }
    const report = renderSensitivity(sources, rows)
    expect(report).toContain('## Verdict')
    expect(report).toContain('level-5 counterfactuals')
    expect(report).toContain('D-demo-1')
    expect(report).toContain('D-demo-2')
    expect(readFileSync(new URL('../data/demo/SENSITIVITY.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')).toBe(report)
  }, 60000)
})
