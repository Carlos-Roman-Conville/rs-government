import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { applicableLaws, checkLaws, deJure, delegationChain, evaluateAct, loadLaws, validateLaw } from '../src/index.ts'
import type { Act, Law } from '../src/index.ts'
import { toDay } from '../scripts/calendar.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'actor', action: 'seize', object: 'subject', place: 'town',
  day: 10, attempted: true, succeeded: true }
const facts = () => undefined

function unsourced(slug: string): Law {
  const law = lawFixture(slug)
  return { ...law, issuer: null, jurisdiction: { ...law.jurisdiction, authority: null },
    sources: [{ key: 'test-source', title: 'Test source with no issuer', year: null, locator: null }] }
}

describe('laws with no sourced issuer or authority', () => {
  it('loads gleaning with null issuer and authority and an explicit source note', () => {
    const loaded = loadLaws(fileURLToPath(new URL('../', import.meta.url)), toDay)
    expect(checkLaws(loaded)).toEqual([])
    const law = loaded.laws.find(law => law.id === 'government/law.gleaning-bylaw')!
    expect(law).toMatchObject({ issuer: null, jurisdiction: { authority: null,
      note: expect.stringContaining('issuer and authority not stated in the source') } })
    expect(validateLaw(law)).toEqual([])
  })

  it('keeps two null-authority laws on the same act in separate, sorted sets', () => {
    const a = unsourced('a'), b = unsourced('b')
    const expected = [[`unstated:${a.id}`, [a]], [`unstated:${b.id}`, [b]]]
    expect([...applicableLaws([b, a], act, facts)]).toEqual(expected)
    expect([...applicableLaws([a, b], act, facts)]).toEqual(expected)
    expect(evaluateAct([b, a], act, facts).map(breach => breach.law)).toEqual([a.id, b.id])
  })

  it.each([null, 'authority.council'])('null-authority laws never supersede each other with issuer %s', issuer => {
    const a = { ...unsourced('a'), issuer }, b = { ...unsourced('b'), issuer }
    a.supersedes = [b.id]
    b.supersedes = [a.id]
    expect(evaluateAct([b, a], act, facts).map(breach => breach.law)).toEqual([a.id, b.id])
  })

  it('prevents supersession in either direction between null and named authorities', () => {
    const a = unsourced('a'), b = unsourced('b')
    b.jurisdiction.authority = 'authority.council'
    a.supersedes = [b.id]
    b.supersedes = [a.id]
    expect(evaluateAct([a, b], act, facts).map(breach => breach.law)).toEqual([a.id, b.id])
  })

  it.each(['not stated in the source', 'council', 'authority.Bad', 'authority.bad--id', 'authority.'])
    ('checkLaws rejects invalid issuer and authority IDs: %s', value => {
      const law = unsourced('invalid')
      law.issuer = value
      law.jurisdiction.authority = value
      expect(checkLaws([law])).toEqual([
        expect.stringContaining('laws[0]: issuer: expected null, authority.'),
        expect.stringContaining('laws[0]: jurisdiction.authority: expected null, authority.'),
      ])
    })

  it.each([null, 'fixture', 'authority.king-in-council', 'office.council', 'fixture-council'])
    ('checkLaws accepts null, authority IDs and named fixture exceptions: %s', value => {
      const law = unsourced('valid')
      law.issuer = value
      law.jurisdiction.authority = value
      expect(checkLaws([law])).toEqual([])
    })

  it('still requires a citation when the issuer is null', () => {
    expect(checkLaws([{ ...unsourced('uncited'), sources: [] }])).toEqual([
      'laws[0]: sources: at least one citation required unless issuer is fixture',
    ])
  })

  it('a null authority gives J = 0 even when an empower rule otherwise grants the power', () => {
    const law: Law = { ...unsourced('grant'), issuer: 'authority.council', modality: 'empower',
      regulated: { action: 'seize', object: 'any', power: 'seize' } }
    for (const actor of ['authority.council', 'actor', `unstated:${law.id}`]) {
      expect(deJure([law], actor, 'seize', { id: 'subject', place: 'town' }, 10, facts)).toBe(0)
    }
    law.jurisdiction.authority = 'authority.council'
    expect(deJure([law], 'actor', 'seize', { id: 'subject', place: 'town' }, 10, facts)).toBe(1)
  })

  it('delegation skips null issuers without asking the host for their recipients', () => {
    const law: Law = { ...unsourced('grant'), modality: 'empower',
      regulated: { action: 'seize', object: 'any', power: 'seize' } }
    law.jurisdiction.authority = 'authority.council'
    const read = vi.fn(() => ['actor'])
    expect(delegationChain([law], 'actor', 10, read)).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })

  it('delegation does not treat matching null authorities as superseding grants', () => {
    const grant: Law = { ...unsourced('grant'), issuer: 'authority.council', modality: 'empower',
      regulated: { action: 'seize', object: 'any', power: 'seize' } }
    const replacement = { ...unsourced('replacement'), issuer: grant.issuer, supersedes: [grant.id] }
    expect(delegationChain([grant, replacement], 'authority.council', 10, () => ['actor'])).toEqual(['actor'])
  })
})
