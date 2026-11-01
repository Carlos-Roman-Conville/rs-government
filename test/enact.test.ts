import { describe, expect, it, vi } from 'vitest'
import { decide, enact, evaluateAct } from '../src/index.ts'
import type { Act, ActFacts, Law, LawDraft } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const place = 'place.town'
const facts: ActFacts = (name, act) => name === 'holds.office' ? act.actor === 'authority.lord' : undefined
function draft(slug = 'decree'): LawDraft {
  return { ...lawFixture(slug), issuer: 'authority.lord', place,
    jurisdiction: { ...lawFixture().jurisdiction, authority: 'authority.lord', from: 10 } }
}
function grant(): Law {
  return { ...lawFixture('legislative-grant'), issuer: 'authority.crown', modality: 'empower',
    jurisdiction: { authority: 'authority.crown', places: [place], persons: 'all', from: 0, until: null },
    regulated: { action: 'seize', object: 'any', power: 'legislate' },
    condition: { read: 'holds.office', op: 'eq', value: true } }
}
const act: Act = { actor: 'person.subject', action: 'seize', object: 'title.field',
  place, day: 10, attempted: true, succeeded: true }

describe('rule creation and amendment', () => {
  it.each([null, 'chair'] as const)('preserves decide unresolved reason for tie rule %s without creating a law', tie => {
    const read = vi.fn(facts)
    for (const quorum of [2, 3]) {
      const outcome = decide({ id: 'procedure.vote', eligible: true, quorum: { count: quorum },
        threshold: { fraction: 0.5 }, tie }, ['a', 'b'],
      [{ member: 'a', vote: true }, { member: 'b', vote: false }], { read: () => undefined })
      expect(enact([grant()], draft(), outcome, 'event.vote', 10, read)).toEqual(quorum === 3
        ? { law: null, failure: 'not-quorate' }
        : { law: null, failure: 'unresolved', unresolved: tie === null ? 'tie' : 'chair-choice-missing' })
    }
    expect(read).not.toHaveBeenCalled()
  })
  it('an empowered lord decree is recognised and carries the host event id', () => {
    const proposal = draft(), laws = [grant()]
    const before = structuredClone({ proposal, laws })
    const result = enact(laws, proposal, { kind: 'decree' }, 'event.decree', 10, facts)
    expect(result).toMatchObject({ recognised: true, failure: null, ineffective: [],
      law: { issuer: 'authority.lord', enactment: 'event.decree' } })
    expect(result.law).not.toHaveProperty('place')
    expect(result.law).not.toHaveProperty('subject')
    expect({ proposal, laws }).toEqual(before)
    result.law!.jurisdiction.from = 100
    result.law!.supersedes.push('government/law.copy-only')
    expect({ proposal, laws }).toEqual(before)
  })
  it('a usurper decree is recorded with its issuer and remains unrecognised', () => {
    const result = enact([grant()], { ...draft(), issuer: 'authority.usurper' },
      { kind: 'decree' }, 'event.usurpation', 10, facts)
    expect(result).toMatchObject({ recognised: false, failure: null,
      law: { issuer: 'authority.usurper', enactment: 'event.usurpation' } })
  })
  it.each([
    { quorate: false, adopted: true, failure: 'not-quorate' },
    { quorate: false, adopted: false, failure: 'not-quorate' },
    { quorate: true, adopted: false, failure: 'not-adopted' },
  ])('a body outcome $failure creates no law or recognition reads', ({ quorate, adopted, failure }) => {
    const read = vi.fn(facts)
    expect(enact([grant()], draft(), { kind: 'body', quorate, adopted }, 'event.vote', 10, read))
      .toEqual({ law: null, failure })
    expect(read).not.toHaveBeenCalled()
  })
  it('a quorate adopted host outcome creates a recognised law', () => {
    expect(enact([grant()], draft(), { kind: 'body', quorate: true, adopted: true }, 'event.vote', 10, facts))
      .toMatchObject({ recognised: true, law: { enactment: 'event.vote' } })
  })
  it.each(['wrong-power', 'wrong-domain', 'wrong-place', 'future', 'expired', 'suspended', 'repealed',
    'exception', 'person', 'object', 'null-authority', 'superseded'])('%s grants do not recognise a decree', state => {
    const power = grant(), laws = [power]
    if (state === 'wrong-power') power.regulated = { action: 'seize', object: 'any', power: 'seize' }
    if (state === 'wrong-domain') power.regulated.action = 'tax'
    if (state === 'wrong-place') power.jurisdiction.places = ['place.port']
    if (state === 'future') power.jurisdiction.from = 11
    if (state === 'expired') power.jurisdiction.until = 10
    if (state === 'suspended' || state === 'repealed') power.status = state
    if (state === 'exception') power.exceptions = [{ condition: true, reason: 'Excepted' }]
    if (state === 'person') power.jurisdiction.persons = { not: true }
    if (state === 'object') power.regulated.object = { not: true }
    if (state === 'null-authority') power.jurisdiction.authority = null
    if (state === 'superseded') laws.push({ ...lawFixture('withdrawal'), issuer: power.issuer,
      jurisdiction: { ...power.jurisdiction }, supersedes: [power.id] })
    expect(enact(laws, draft(), { kind: 'decree' }, 'event.decree', 10, facts))
      .toMatchObject({ recognised: false, law: { id: draft().id } })
  })
  it('recognition sends the issuer, action domain, place and optional subject through deJure', () => {
    const power = grant()
    power.regulated.object = { read: 'subject.allowed', op: 'eq', value: true }
    const read = vi.fn<ActFacts>((name, event) => name === 'subject.allowed'
      ? event.object === 'person.subject' : facts(name, event))
    expect(enact([power], { ...draft(), subject: 'person.subject' }, { kind: 'decree' }, 'event.decree', 10, read))
      .toMatchObject({ recognised: true })
    expect(read).toHaveBeenCalledWith('subject.allowed', { actor: 'authority.lord', action: 'seize',
      object: 'person.subject', place, day: 10, attempted: false, succeeded: false })
  })
  it('an amendment applies on its later effective day in place of its own earlier law', () => {
    const old = enact([grant()], draft('old'), { kind: 'decree' }, 'event.old', 10, facts).law!
    const proposal = draft('amendment')
    proposal.supersedes = [old.id]
    proposal.jurisdiction.from = 20
    const amended = enact([grant(), old], proposal, { kind: 'decree' }, 'event.amendment', 15, facts)
    expect(amended).toMatchObject({ recognised: true, ineffective: [] })
    for (const laws of [[old, amended.law!], [amended.law!, old]]) {
      expect(evaluateAct(laws, { ...act, day: 19 }, facts).map(b => b.law)).toEqual([old.id])
      expect(evaluateAct(laws, { ...act, day: 20 }, facts).map(b => b.law)).toEqual([proposal.id])
    }
    expect(old.status).toBe('in-force')
  })
  it('cross-authority supersedes entries are retained and listed as ineffective in id order', () => {
    const a = { ...lawFixture('a'), issuer: 'authority.rival' }
    const z = { ...lawFixture('z'), issuer: 'authority.rival' }
    const proposal = { ...draft(), supersedes: [z.id, a.id, z.id] }
    const result = enact([z, grant(), a], proposal, { kind: 'decree' }, 'event.decree', 10, facts)
    expect(result).toMatchObject({ ineffective: [a.id, z.id], law: { supersedes: [z.id, a.id, z.id] } })
    expect(evaluateAct([z, a, result.law!], act, facts).map(b => b.law)).toEqual([a.id, proposal.id, z.id])
  })
  it.each(['issuer', 'null-authority'])('%s mismatch is ineffective under the evaluator boundary', mismatch => {
    const old: Law = { ...draft('old'), enactment: null }
    if (mismatch === 'issuer') old.issuer = 'authority.rival'
    else old.jurisdiction.authority = null
    const result = enact([old], { ...draft(), supersedes: [old.id] }, { kind: 'decree' }, 'event.decree', 10, facts)
    expect(result).toMatchObject({ ineffective: [old.id] })
    expect(evaluateAct([old, result.law!], act, facts)).toHaveLength(2)
  })
  it('a new empower law cannot recognise its own enactment', () => {
    const result = enact([], { ...grant(), place }, { kind: 'decree' }, 'event.grant', 10, facts)
    expect(result).toMatchObject({ recognised: false, law: { modality: 'empower' } })
  })
})
