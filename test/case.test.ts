import { describe, expect, it } from 'vitest'
import { assessAct, find, issueOrder, openCase, present } from '../src/index.ts'
import type { Act, Case, DecisionRule, Evidence, Law, Report } from '../src/index.ts'
import * as caseAPI from '../src/case/case.ts'
import presentmentProcedure from '../data/procedures/manorial-court-presentment-by-jurors-or-homage.json'
import wagerProcedure from '../data/procedures/manorial-court-baron-action-wager-of-law.json'
import { lawFixture } from './law-fixture.ts'

const law: Law = { ...lawFixture('take'), modality: 'prohibit', regulated: { action: 'take', object: 'any' },
  exceptions: [{ condition: { read: 'permission', op: 'eq', value: true }, reason: 'Has permission' }],
  consequence: { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: 2, note: 'Fixture amount' }] } }
const act: Act = { actor: 'person.accused', action: 'take', object: 'goods.grain', place: 'place.manor',
  day: 10, attempted: true, succeeded: true }
const charge: Report['claim'] = { accused: act.actor, action: act.action, object: act.object, day: act.day, law: law.id }
const presentment: DecisionRule = { kind: 'presentment',
  procedure: 'government/procedure.manorial-court-presentment-by-jurors-or-homage', touchesFreehold: false }
// Scenario parameter from data/procedures/manorial-court-baron-action-wager-of-law.json:
// the Tooting entry specifies five compurgators (sixth hand), not a general default.
const wager: DecisionRule = { kind: 'wager-of-law',
  procedure: 'government/procedure.manorial-court-baron-action-wager-of-law', oathHelpersRequired: 5 }
function report(form: Report['form'] = 'presentment', id = 'report.1'): Report {
  return { id, by: ['person.a', 'person.z'], to: 'office.steward', day: 11, form,
    claim: { ...charge }, quantity: null }
}
function evidence(id: string, fields: Partial<Evidence> = {}): Evidence {
  return { id, kind: 'report', ref: 'report.1', by: 'person.a', supports: null,
    holder: 'office.steward', day: 12, ...fields }
}
function opened(rule: DecisionRule = presentment): Case {
  return openCase('case.1', report(rule.kind === 'presentment' ? 'presentment' : 'plaint'), charge, rule)
}
function pleaded(helpers: number, rule: DecisionRule = wager): Case {
  let result = present(opened(rule), evidence('e.plaint'))
  result = present(result, evidence('e.denial', { kind: 'denial', ref: null, by: act.actor }))
  for (let i = 0; i < helpers; i++) result = present(result, evidence(`e.oath.${i}`, {
    kind: 'oath', ref: null, by: `helper.${i}`, supports: act.actor,
  }))
  return result
}
const decidePresentment = () => find(present(opened(), evidence('e.presentment')), 13, [report()])

describe('reports, evidence, findings and orders are separate records', () => {
  it('(c1) an undiscovered take opens no case without an initiating presentment or plaint', () => {
    const assessment = assessAct([law], act, () => false)
    expect(assessment[0].result).toBe('breach')
    const before = structuredClone(assessment)
    expect(() => openCase('case.1', undefined as unknown as Report, charge, presentment)).toThrow(/initiating/)
    for (const form of ['testimony', 'account', 'announcement'] as const) {
      expect(() => openCase('case.1', report(form), charge, presentment)).toThrow(/initiating/)
    }
    expect(assessment).toEqual(before)
    expect(assessment[0].breach?.known_to).toEqual([])
  })

  it('(c2) false presentment can make an innocent accused liable and lead to an order', () => {
    expect(assessAct([law], act, () => true)[0].result).toBe('no-breach')
    expect(presentment.procedure).toBe(presentmentProcedure.id)
    expect(presentmentProcedure.proof).toContain('untraversable')
    const result = decidePresentment()
    expect(result.finding).toEqual({ case: result.id, day: 13, outcome: 'liable',
      reason: 'presentment untraversable', basis: ['e.presentment'] })
    expect(issueOrder('order.1', result.finding!, result, law, 14)).toEqual({
      type: 'government.order', id: 'order.1', case: result.id, law: law.id, against: act.actor,
      day: 14, sanctions: law.consequence.kind === 'sanctions' ? law.consequence.sanctions : [],
    })
  })

  it('(c3) a guilty accused makes law with five distinct helpers and cannot receive an order', () => {
    expect(assessAct([law], act, () => false)[0].result).toBe('breach')
    expect(wager.procedure).toBe(wagerProcedure.id)
    expect(wagerProcedure.proof).toContain('five compurgators (sixth hand)')
    const result = find(pleaded(5), 13, [report('plaint')])
    expect(result.finding).toMatchObject({ outcome: 'not-liable', reason: 'law made' })
    expect(result.finding?.basis).toEqual(['e.denial', ...Array.from({ length: 5 }, (_, i) => `e.oath.${i}`), 'e.plaint'])
    expect(() => issueOrder('order.1', result.finding!, result, law, 14)).toThrow(/liable/)
  })

  it('(c4) insufficient, duplicate, self or unrelated oaths supply no invented consequence or default', () => {
    const insufficient = 'law not made; consequence not stated in the procedure record'
    let result = pleaded(4)
    expect(find(result, 13, [report('plaint')]).finding).toMatchObject({ outcome: 'unresolved', reason: insufficient })
    for (const [id, by, supports] of [
      ['e.repeat', 'helper.0', act.actor], ['e.self', act.actor, act.actor],
      ['e.other', 'helper.other', 'person.other'], ['e.unsupported', 'helper.unsupported', null],
    ]) result = present(result, evidence(id!, { kind: 'oath', ref: null, by: by!, supports }))
    const found = find(result, 13, [report('plaint')])
    expect(found.finding).toMatchObject({ outcome: 'unresolved', reason: insufficient })
    expect(found.finding?.basis).not.toContain('e.self')
    expect(found.finding?.basis).not.toContain('e.other')
    expect(found.finding?.basis).not.toContain('e.unsupported')
    expect(() => issueOrder('order.1', found.finding!, found, law, 14)).toThrow(/liable/)
    const unknown = pleaded(5, { ...wager, oathHelpersRequired: null })
    expect(find(unknown, 13, [report('plaint')]).finding).toMatchObject({
      outcome: 'unresolved', reason: 'number of oath-helpers not stated', basis: ['e.denial', 'e.plaint'],
    })
  })

  it('(c5) a presentment held by the steward but not presented supplies no proof', () => {
    const held = evidence('e.held')
    expect(held.holder).toBe('office.steward')
    const initial = opened()
    expect(initial.initiatedBy).toBe('report.1')
    expect(initial.presented).toEqual([])
    expect(find(initial, 13, [report()]).finding).toMatchObject({
      outcome: 'unresolved', reason: 'no presentment presented', basis: [],
    })
    expect(find(present(initial, held), 13, [report()]).finding?.outcome).toBe('liable')
  })

  it('(c6) touching freehold or an unstated freehold fact stays unresolved', () => {
    for (const [touchesFreehold, reason] of [
      [true, 'presentment touching freehold is traversable; traverse not modelled'],
      [null, 'freehold not stated'],
    ] as const) {
      const result = find(present(opened({ ...presentment, touchesFreehold }), evidence('e.1')), 13, [report()])
      expect(result.finding).toMatchObject({ outcome: 'unresolved', reason, basis: ['e.1'] })
    }
  })

  it('(c7) findings are written once, evidence ids are unique and finished cases cannot be extended', () => {
    const pending = present(opened(), evidence('e.1'))
    const finished = find(pending, 13, [report()])
    const before = structuredClone({ pending, finished })
    expect(() => find(finished, 14, [report()])).toThrow(/only once/)
    expect(() => present(finished, evidence('e.2'))).toThrow(/after a finding/)
    expect(() => present(pending, evidence('e.1'))).toThrow(/Duplicate evidence id/)
    expect({ pending, finished }).toEqual(before)
  })

  it('(c8) deterministic copied outputs preserve inputs and sort presented evidence and finding basis', () => {
    const initiating = report(), rule = { ...presentment }, claim = { ...charge }
    const firstEvidence = evidence('z'), secondEvidence = evidence('a')
    const inputs = { initiating, rule, claim, firstEvidence, secondEvidence, law }
    const before = structuredClone(inputs)
    const initial = openCase('case.1', initiating, claim, rule)
    const first = present(initial, firstEvidence)
    const second = present(first, secondEvidence)
    const result = find(second, 13, [initiating])
    const order = issueOrder('order.1', result.finding!, result, law, 14)
    expect(openCase('case.1', initiating, claim, rule)).toEqual(initial)
    expect(present(initial, firstEvidence)).toEqual(first)
    expect(present(present(initial, secondEvidence), firstEvidence)).toEqual(second)
    expect(find(second, 13, [initiating])).toEqual(result)
    expect(issueOrder('order.1', result.finding!, result, law, 14)).toEqual(order)
    expect(result.finding?.basis).toEqual(['a', 'z'])
    expect(second.presented.map(item => item.id)).toEqual(['a', 'z'])
    expect(initial.presented).toEqual([])
    expect(first.presented).toHaveLength(1)
    expect(second.finding).toBeNull()
    result.charge.action = 'changed'
    result.presented[0].holder = 'changed'
    result.rule.procedure = 'government/procedure.changed'
    result.finding!.basis.push('changed')
    expect(second.charge).toEqual(charge)
    expect(second.rule).toEqual(presentment)
    expect(second.presented[0].holder).toBe('office.steward')
    expect(inputs).toEqual(before)
  })

  it('(c9) orders copy sanctions and carry no execution or status fields', () => {
    const result = decidePresentment()
    const before = structuredClone(law)
    const order = issueOrder('order.1', result.finding!, result, law, 14)
    expect(Object.keys(order).sort()).toEqual(['against', 'case', 'day', 'id', 'law', 'sanctions', 'type'])
    order.sanctions[0].amount = 999
    order.sanctions.push({ kind: 'exile', amount: null, note: 'Changed copy' })
    expect(law).toEqual(before)
    expect(() => issueOrder('order.1', result.finding!, result, lawFixture('other'), 14)).toThrow(/Law/)
    expect(() => issueOrder('order.1', { ...result.finding!, case: 'case.other' }, result, law, 14)).toThrow(/Finding/)
    expect(() => issueOrder('order.1', result.finding!, opened(), law, 14)).toThrow(/Finding/)
    expect(issueOrder('order.void', result.finding!, result, { ...law, consequence: { kind: 'void' } }, 14).sanctions).toEqual([])
  })

  it('(c10) an account stating seven stays as written beside a host ledger showing ten', () => {
    const account: Report = { ...report('account', 'report.account'), by: ['office.collector'],
      claim: { accused: null, action: 'collected', object: 'coins', day: 10, law: null },
      quantity: { amount: 7, unit: 'coins' } }
    const hostLedger = [{ from: 'person.payer', to: 'office.collector', amount: 10, unit: 'coins', day: 10 }]
    const before = structuredClone({ account, hostLedger })
    const result = find(present(opened(), evidence('e.account', { ref: account.id })), 13, [account])
    expect(result.finding).toMatchObject({ outcome: 'unresolved', reason: 'no presentment presented', basis: [] })
    expect({ account, hostLedger }).toEqual(before)
    expect(account.quantity?.amount).toBe(7)
    expect(hostLedger[0].amount).toBe(10)
    expect(Object.keys(caseAPI).sort()).toEqual(['find', 'issueOrder', 'openCase', 'present'])
  })

  it('matching proof requires accused, action, object and law, but not the reported day', () => {
    const pending = present(opened(), evidence('e.1'))
    for (const claim of [{ ...charge, accused: 'other' }, { ...charge, action: 'other' },
      { ...charge, object: null }, { ...charge, law: null }]) {
      expect(find(pending, 13, [{ ...report(), claim }]).finding?.reason).toBe('no presentment presented')
    }
    expect(find(pending, 13, [{ ...report(), claim: { ...charge, day: null } }]).finding?.outcome).toBe('liable')
    expect(find(pending, 13, []).finding?.reason).toBe('no presentment presented')
    expect(() => find(pending, 13, [report(), report()])).toThrow(/Duplicate report/)
  })

  it('wager requires both a matching presented plaint and the accused denial before counting helpers', () => {
    const pending = pleaded(5)
    expect(find(pending, 13, [report()]).finding?.reason).toBe('no plaint presented')
    expect(find(pending, 13, [{ ...report('plaint'), claim: { ...charge, accused: 'other' } }]).finding?.reason)
      .toBe('no plaint presented')
    const noDenial = { ...pending, presented: pending.presented.filter(item => item.kind !== 'denial') }
    expect(find(noDenial, 13, [report('plaint')]).finding?.reason).toBe('no denial by accused presented')
    const otherDenial = present(noDenial, evidence('e.other-denial', { kind: 'denial', by: 'other', ref: null }))
    expect(find(otherDenial, 13, [report('plaint')]).finding?.outcome).toBe('unresolved')
    expect(find(opened(wager), 13, []).finding?.reason).toBe('no plaint presented; no denial by accused presented')
  })

  it('report authors must be non-empty and sorted, and helper numbers cannot be malformed', () => {
    for (const by of [[], ['z', 'a'], ['']]) {
      expect(() => openCase('case.1', { ...report(), by }, charge, presentment)).toThrow(/authors/)
    }
    for (const oathHelpersRequired of [-1, 1.5, NaN, Infinity]) {
      expect(() => opened({ ...wager, oathHelpersRequired })).toThrow(/oath-helpers/)
    }
  })
})
