import { describe, expect, it } from 'vitest'
import { legalTender } from '../src/index.ts'
import type { Law, TenderJurisdiction, TenderRule } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const jurisdiction: TenderJurisdiction = {
  authority: 'office.council', actor: 'person.payer', place: 'place.town', facts: () => undefined,
}
function tenderLaw(slug = 'tender', tender: TenderRule = { assets: ['asset.a'], purposes: ['tax', 'debt'] }): Law {
  return { ...lawFixture(slug), modality: 'require',
    regulated: { action: 'accept-payment', object: 'any' }, tender }
}

describe('legal tender read', () => {
  it('includes the asset before until and excludes it on the repeal day without storing a list', () => {
    const law = tenderLaw()
    law.jurisdiction.until = 10
    const laws = [law]
    const before = structuredClone(laws)
    Object.freeze(law.tender!.assets)
    Object.freeze(law.tender!.purposes)
    Object.freeze(law.tender)
    Object.freeze(law.jurisdiction)
    Object.freeze(law)
    Object.freeze(laws)
    const scope = Object.freeze({ ...jurisdiction })
    const result = legalTender(laws, scope, 9, 'tax')
    expect(result).toEqual(['asset.a'])
    result.push('asset.unrelated')
    expect(legalTender(laws, scope, 10, 'tax')).toEqual([])
    expect(legalTender(laws, scope, 9, 'tax')).toEqual(['asset.a'])
    expect(laws).toEqual(before)
    expect(scope).toEqual(jurisdiction)
  })

  it('returns a sorted, deduplicated union independent of law order', () => {
    const a = tenderLaw('a', { assets: ['asset.z', 'asset.a', 'asset.z'], purposes: ['tax'] })
    const b = tenderLaw('b', { assets: ['asset.b', 'asset.a'], purposes: ['tax'] })
    expect(legalTender([b, a], jurisdiction, 1, 'tax')).toEqual(['asset.a', 'asset.b', 'asset.z'])
    expect(legalTender([a, b], jurisdiction, 1, 'tax')).toEqual(['asset.a', 'asset.b', 'asset.z'])
  })

  it('filters tax and debt purposes', () => {
    const tax = tenderLaw('tax', { assets: ['asset.tax'], purposes: ['tax'] })
    const debt = tenderLaw('debt', { assets: ['asset.debt'], purposes: ['debt'] })
    expect(legalTender([tax, debt], jurisdiction, 1, 'tax')).toEqual(['asset.tax'])
    expect(legalTender([tax, debt], jurisdiction, 1, 'debt')).toEqual(['asset.debt'])
  })

  it('filters authority and place coverage through the existing jurisdiction evaluator', () => {
    const law = tenderLaw()
    law.jurisdiction.places = ['place.town']
    expect(legalTender([law], jurisdiction, 1, 'tax')).toEqual(['asset.a'])
    expect(legalTender([law], { ...jurisdiction, authority: 'office.other' }, 1, 'tax')).toEqual([])
    expect(legalTender([law], { ...jurisdiction, place: 'place.other' }, 1, 'tax')).toEqual([])
  })

  it('checks person predicates with the supplied actor, day and place', () => {
    const law = tenderLaw()
    law.jurisdiction.persons = { read: 'person.member', op: 'eq', value: true }
    const scope: TenderJurisdiction = { ...jurisdiction, facts: (name, act) => {
      expect(name).toBe('person.member')
      expect(act).toMatchObject({ actor: jurisdiction.actor, place: jurisdiction.place, day: 1,
        action: 'accept-payment' })
      return true
    } }
    expect(legalTender([law], scope, 1, 'tax')).toEqual(['asset.a'])
    expect(legalTender([law], { ...scope, facts: () => false }, 1, 'tax')).toEqual([])
    expect(() => legalTender([law], jurisdiction, 1, 'tax')).toThrow()
  })

  it('preserves rival and unstated jurisdiction sets when no authority is selected', () => {
    const rival = tenderLaw('rival', { assets: ['asset.rival'], purposes: ['tax'] })
    rival.jurisdiction.authority = 'office.rival'
    const unstated = tenderLaw('unstated')
    unstated.jurisdiction.authority = null
    expect(legalTender([rival, unstated], { ...jurisdiction, authority: undefined }, 1, 'tax'))
      .toEqual(['asset.a', 'asset.rival'])
    expect(legalTender([rival, unstated], { ...jurisdiction, authority: `unstated:${unstated.id}` }, 1, 'tax'))
      .toEqual(['asset.a'])
  })

  it('uses inclusive from and unbounded null dates', () => {
    const law = tenderLaw()
    law.jurisdiction.from = 5
    expect(legalTender([law], jurisdiction, 4, 'tax')).toEqual([])
    expect(legalTender([law], jurisdiction, 5, 'tax')).toEqual(['asset.a'])
    law.jurisdiction.from = null
    expect(legalTender([law], jurisdiction, -100, 'tax')).toEqual(['asset.a'])
  })

  it.each(['suspended', 'repealed'] as const)('excludes %s laws', status => {
    expect(legalTender([{ ...tenderLaw(), status }], jurisdiction, 1, 'tax')).toEqual([])
  })

  it('honors in-force supersession even by a law without tender, but not by a rival', () => {
    const law = tenderLaw()
    const replacement = lawFixture('replacement')
    replacement.supersedes = [law.id]
    replacement.jurisdiction.from = 10
    expect(legalTender([law, replacement], jurisdiction, 9, 'tax')).toEqual(['asset.a'])
    expect(legalTender([law, replacement], jurisdiction, 10, 'tax')).toEqual([])
    replacement.jurisdiction.authority = 'office.rival'
    expect(legalTender([law, replacement], jurisdiction, 10, 'tax')).toEqual(['asset.a'])
  })

  it('returns an empty list for no laws or no matching tender rules', () => {
    expect(legalTender([], jurisdiction, 1, 'tax')).toEqual([])
    expect(legalTender([lawFixture()], jurisdiction, 1, 'tax')).toEqual([])
    expect(legalTender([tenderLaw('debt', { assets: ['asset.a'], purposes: ['debt'] })], jurisdiction, 1, 'tax')).toEqual([])
  })
})
