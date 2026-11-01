import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateLawData } from '../src/law/schema.ts'
import type { LawData, SanctionKind } from '../src/law/schema.ts'

const directory = new URL('../data/laws/', import.meta.url)
const sources = readFileSync(new URL('SOURCES.md', directory), 'utf8')
// Read only the Consequence line in each matching section, never the notes or
// another section (which may mention a penalty that this rule does not carry).
const sections = new Map([...sources.matchAll(/^## ([a-z0-9-]+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)]
  .map(match => [match[1], match[2]]))
const records = readdirSync(fileURLToPath(directory)).filter(name => name.endsWith('.json')).sort()

// SOURCES uses ordinary language rather than enum names. These are explicit
// textual equivalents, not permission to infer a sanction from general liability.
const evidence: Record<SanctionKind, RegExp> = {
  fine: /\b(?:fine[ds]?|amercement|repaying double|treble damages|4d paid to the lord)\b/i,
  detention: /\b(?:detention|imprisonment|imprisoned|prison|gaol|stocks)\b/i,
  seizure: /\b(?:seizure|forfeit|property to the Crown|property to the immediate lord|takes the tenant's best beast)\b/i,
  corporal: /\b(?:corporal|hanging|quartering|burning|pilloried)\b/i,
  outlawry: /\b(?:outlawry|outlawed)\b/i,
  exile: /\b(?:exile|exiled|banishment|banished)\b/i,
}
// An unspecified amount or duration does not erase an explicitly stated penalty.
const unstatedPenalty = /^(?:not stated)\b|\b(?:consequence|penalty)(?: for interference)? (?:is )?not stated\b/i

describe('historical sanctions agree with SOURCES.md', () => {
  it('checks every fixture and a unique source section for every record', () => {
    expect(records.length).toBeGreaterThanOrEqual(20)
    expect(sections.size).toBe([...sources.matchAll(/^## /gm)].length)
    expect(sections.size).toBe(records.length)
  })
  for (const file of records) {
    const slug = file.slice(0, -5)
    it(`${slug} carries only sanctions stated in its Consequence line`, () => {
      const law = JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as LawData
      expect(validateLawData(law)).toEqual([])
      expect(law.id).toBe(`government/law.${slug}`)
      const lines = [...(sections.get(slug) ?? '').matchAll(/^- Consequence: (.+)$/gm)]
      expect(lines, `${slug}: missing or duplicate Consequence line`).toHaveLength(1)
      const consequence = lines[0][1].trim()
      const sanctions = law.consequence.kind === 'sanctions' ? law.consequence.sanctions : []
      if (unstatedPenalty.test(consequence)) expect(sanctions).toEqual([])
      for (const sanction of sanctions) {
        expect(consequence, `${slug}: unsupported ${sanction.kind}`).toMatch(evidence[sanction.kind])
      }
    })
  }
  it('separates imprisonment for hiring a departed worker from double repayment and treble damages', () => {
    const law = JSON.parse(readFileSync(new URL('ordinance-of-labourers-1349-service.json', directory), 'utf8')) as LawData
    expect(law.consequence).toEqual({ kind: 'sanctions', sanctions: [
      { kind: 'detention', amount: null, note: 'Leaving service without reasonable cause means imprisonment.' },
      { kind: 'detention', amount: null, note: 'Hiring or keeping a worker who left service without reasonable cause means imprisonment.' },
      { kind: 'fine', amount: null, note: 'Paying or taking more than the rate means repaying double; a lord who breaks it pays treble damages.' },
    ] })
  })
})
