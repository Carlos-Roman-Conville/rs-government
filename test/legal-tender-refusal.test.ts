import { describe, expect, it, vi } from 'vitest'
import { createViolation, detect, drop, fail, prosecute, refusalBreaches, sanction, sanctionCommands } from '../src/index.ts'
import type { Law, RefusalContext, RefusalOutcome, SanctionCommand, Violation } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const context: RefusalContext = {
  authority: 'office.council', place: 'place.town', day: 10, facts: () => undefined,
}
const outcome: RefusalOutcome = {
  type: 'shared.action.outcome', status: 'failed', payload: {
    type: 'refused', reason: 'not-accepted', refusedBy: 'person.collector', currency: 'asset.a', purpose: 'tax',
  },
}
function tenderLaw(slug = 'tender'): Law {
  return { ...lawFixture(slug), modality: 'require', regulated: { action: 'accept-payment', object: 'any' },
    tender: { assets: ['asset.a'], purposes: ['tax', 'debt'] },
    consequence: { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: null, note: 'Fixture: amount not stated' }] } }
}
function refusal(patch: Partial<RefusalOutcome['payload']>): RefusalOutcome {
  return { ...outcome, payload: { ...outcome.payload, ...patch } }
}

describe('legal tender refusal breaches', () => {
  it('records one breach against the refusing actor and sanctions only after detection and prosecution', () => {
    const law = tenderLaw()
    const breaches = refusalBreaches([law], outcome, context)
    expect(breaches).toEqual([{
      law: law.id, act: { actor: 'person.collector', object: 'asset.a', action: 'omit:accept-payment',
        place: context.place, day: context.day, attempted: false, succeeded: false },
      stage: 'breach', known_to: [], reason: null,
      sanction: [{ kind: 'fine', amount: null, note: 'Fixture: amount not stated' }],
    }])
    const initial = createViolation('government/violation.refusal', breaches[0])
    expect(() => prosecute(initial)).toThrow(/Illegal violation transition/)
    expect(() => sanction(initial)).toThrow(/Illegal violation transition/)
    const detected = detect(initial, 'office.reeve')
    expect(() => sanction(detected)).toThrow(/Illegal violation transition/)
    const prosecuted = prosecute(detected)
    expect(sanctionCommands(prosecuted, law)).toEqual([{
      owner: 'settlement', type: 'pay', violation: initial.id, law: law.id,
      actor: 'person.collector', object: 'asset.a', amount: null, note: 'Fixture: amount not stated',
    }])
    expect([initial, detected, prosecuted, sanction(prosecuted)].map(record => record.stage))
      .toEqual(['breach', 'detected', 'prosecuted', 'sanctioned'])
    expect(initial.known_to).toEqual([])
  })

  it('a run with failed detection retains its valid breach and emits no sanction', () => {
    const law = tenderLaw()
    const records: Violation[] = refusalBreaches([law], outcome, context)
      .map(breach => createViolation('government/violation.unseen', breach))
    const commands: SanctionCommand[] = []
    const observe = vi.fn(() => false)
    for (const record of records) {
      if (!observe()) continue
      const prosecuted = prosecute(detect(record, 'office.reeve'))
      commands.push(...sanctionCommands(prosecuted, law))
    }
    expect(observe).toHaveBeenCalledOnce()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ stage: 'breach', known_to: [], reason: null })
    expect(commands).toEqual([])
  })

  it('prosecution may be declined and a prosecuted sanction may fail', () => {
    const initial = createViolation('government/violation.refusal', refusalBreaches([tenderLaw()], outcome, context)[0])
    const detected = detect(initial, 'office.reeve')
    expect(drop(detected, 'Enforcer declined')).toMatchObject({ stage: 'dropped', reason: 'Enforcer declined' })
    expect(fail(prosecute(detected), 'Successful resistance'))
      .toMatchObject({ stage: 'failed', reason: 'Successful resistance' })
  })

  it.each([null, undefined] as const)('purpose %s is never inferred from a tax law or predicate', purpose => {
    const event = refusal({ purpose })
    if (purpose === undefined) delete event.payload.purpose
    const facts = vi.fn(() => { throw new Error('Must not infer purpose') })
    expect(refusalBreaches([tenderLaw()], event, { ...context, facts })).toEqual([])
    expect(facts).not.toHaveBeenCalled()
  })

  it.each([
    { currency: 'asset.other' }, { currency: undefined }, { currency: null },
    { refusedBy: undefined }, { refusedBy: null }, { refusedBy: ' ' },
    { reason: 'no-stock' }, { type: 'bought' },
  ])('unknown or non-refusal evidence %j gives no breach', patch => {
    expect(refusalBreaches([tenderLaw()], refusal(patch), context)).toEqual([])
  })

  it('completed outcomes and absent tender laws give no breach', () => {
    expect(refusalBreaches([tenderLaw()], { ...outcome, status: 'completed' }, context)).toEqual([])
    expect(refusalBreaches([], outcome, context)).toEqual([])
    expect(refusalBreaches([lawFixture()], outcome, context)).toEqual([])
  })

  it('breaches only the law covering both the offered asset and the explicit purpose', () => {
    const tax = tenderLaw('tax'), debt = tenderLaw('debt'), other = tenderLaw('other')
    tax.tender!.purposes = ['tax']
    debt.tender!.purposes = ['debt']
    other.tender!.assets = ['asset.other']
    const laws = [debt, other, tax]
    expect(refusalBreaches(laws, outcome, context).map(breach => breach.law)).toEqual([tax.id])
    expect(refusalBreaches(laws, refusal({ purpose: 'debt' }), context).map(breach => breach.law)).toEqual([debt.id])
    expect(refusalBreaches([tax], refusal({ purpose: 'debt' }), context)).toEqual([])
  })

  it('honours dates, status, jurisdiction, conditions and exceptions through the evaluator', () => {
    const law = tenderLaw()
    const excluded: Law[] = [
      { ...law, status: 'suspended' }, { ...law, status: 'repealed' },
      { ...law, jurisdiction: { ...law.jurisdiction, from: 11 } },
      { ...law, jurisdiction: { ...law.jurisdiction, until: 10 } },
      { ...law, jurisdiction: { ...law.jurisdiction, places: ['place.other'] } },
      { ...law, jurisdiction: { ...law.jurisdiction, persons: { not: true } } },
      { ...law, condition: { not: true } }, { ...law, exceptions: [{ condition: true, reason: 'Exempt' }] },
    ]
    for (const candidate of excluded) expect(refusalBreaches([candidate], outcome, context)).toEqual([])
    expect(refusalBreaches([law], outcome, { ...context, authority: 'office.other' })).toEqual([])
    law.jurisdiction.from = 10
    expect(refusalBreaches([law], outcome, context)).toHaveLength(1)
    law.jurisdiction.from = null
    expect(refusalBreaches([law], outcome, { ...context, day: -10 })).toHaveLength(1)
  })

  it('reads predicates for the refuser and preserves missing-port errors', () => {
    const law = tenderLaw()
    law.jurisdiction.persons = { read: 'person.collector', op: 'eq', value: true }
    law.condition = { read: 'payment.due', op: 'eq', value: true }
    const facts: RefusalContext['facts'] = (name, act) => {
      expect(act).toMatchObject({ actor: 'person.collector', place: context.place, day: context.day })
      if (name === 'payment.due') expect(act).toMatchObject({ action: 'omit:accept-payment', object: 'asset.a' })
      return true
    }
    expect(refusalBreaches([law], outcome, { ...context, facts })).toHaveLength(1)
    expect(() => refusalBreaches([law], outcome, context)).toThrow(/undefined/)
  })

  it('honours non-tender supersession while preserving sorted rival and unstated laws', () => {
    const a = tenderLaw('a'), z = tenderLaw('z'), unstated = tenderLaw('unstated')
    z.jurisdiction.authority = 'office.rival'
    z.supersedes = [a.id]
    unstated.jurisdiction.authority = null
    const scope = { ...context, authority: undefined }
    const laws = [z, unstated, a]
    const breaches = refusalBreaches(laws, outcome, scope)
    expect(breaches.map(breach => breach.law)).toEqual([a.id, unstated.id, z.id])
    expect(refusalBreaches([...laws].reverse(), outcome, scope)).toEqual(breaches)
    const replacement = { ...lawFixture('replacement'), supersedes: [a.id] }
    expect(refusalBreaches([...laws, replacement], outcome, scope).map(breach => breach.law))
      .toEqual([unstated.id, z.id])
    expect(refusalBreaches(laws, outcome, { ...context, authority: `unstated:${unstated.id}` })
      .map(breach => breach.law)).toEqual([unstated.id])
  })

  it('preserves empty or void consequences without supplying a default sanction or mutating inputs', () => {
    const consequences: Law['consequence'][] = [{ kind: 'sanctions', sanctions: [] }, { kind: 'void' }]
    for (const consequence of consequences) {
      const law: Law = { ...tenderLaw(), consequence }
      const before = structuredClone({ law, outcome })
      const [breach] = refusalBreaches([law], outcome, context)
      expect(breach.sanction).toEqual(consequence.kind === 'void' ? null : [])
      expect({ law, outcome }).toEqual(before)
    }
  })
})
