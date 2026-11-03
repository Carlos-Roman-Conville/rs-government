import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { assess, checkLaws, collectionCommands, evaluateAct, taxBreaches, validateLaw, validateLawData } from '../src/index.ts'
import type { ActFacts, Law, TaxPayment, TaxSchedule } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const payer = { id: 'person.tenant', place: 'place.manor', object: 'inventory.harvest' }
const facts: ActFacts = name => name === 'economy.harvest' ? { amount: 100, unit: 'grain' } : undefined
function tax(schedule: TaxSchedule = { kind: 'rate', rate: 0.1 }, slug = 'tax'): Law {
  return { ...lawFixture(slug), modality: 'require', regulated: { action: 'pay', object: 'any' },
    tax: { base: 'economy.harvest', schedule, treasury: 'account.treasury', collector: 'office.reeve' } }
}
function payment(law: Law, amount: number): TaxPayment {
  return { law: law.id, payer: payer.id, day: 10, amount, unit: 'grain', owner: 'economy', from: 'inventory.tenant' }
}

describe('declared remission boundary', () => {
  it('(r1) taxes the threshold only when remission is strictly below it', () => {
    for (const remitBoundary of ['strictly-below', 'at-or-below'] as const) {
      const law = tax({ kind: 'proportional-with-remission', rate: 0.1, remitBelow: 50, remitBoundary })
      expect(validateLaw(law)).toEqual([])
      expect(assess([law], 10, [payer], () => ({ amount: 50, unit: 'grain' }))[0].owed)
        .toBe(remitBoundary === 'strictly-below' ? 5 : 0)
    }
  })
  it('(r2) both boundaries remit below the threshold', () => {
    for (const remitBoundary of ['strictly-below', 'at-or-below'] as const) {
      const law = tax({ kind: 'proportional-with-remission', rate: 0.1, remitBelow: 50, remitBoundary })
      expect(assess([law], 10, [payer], () => ({ amount: 49, unit: 'grain' }))[0].owed).toBe(0)
    }
  })
  it('(r3) missing and invalid boundaries name tax.schedule.remitBoundary', () => {
    const law = tax()
    for (const boundary of [{}, { remitBoundary: 'above' }, { remitBoundary: null }]) {
      const schedule = { kind: 'proportional-with-remission', rate: 0.1, remitBelow: 50, ...boundary }
      expect(validateLaw({ ...law, tax: { ...law.tax, schedule } }))
        .toEqual([expect.stringContaining('tax.schedule.remitBoundary')])
    }
  })
})

describe('tax schema and declared owner reads', () => {
  it.each<TaxSchedule>([
    { kind: 'fixed', amount: 2, unit: 'coin' }, { kind: 'rate', rate: 0.1 },
    { kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: 50 },
  ])('accepts the $kind schedule in runtime and calendar law data', schedule => {
    const law = tax(schedule)
    expect(validateLaw(law)).toEqual([])
    expect(validateLawData({ ...law, jurisdiction: { ...law.jurisdiction, from: null } })).toEqual([])
  })
  it.each(['prohibit', 'permit', 'empower', 'establish'])('forbids tax on %s', modality => {
    expect(validateLaw({ ...tax(), modality })).toContain('tax: allowed only for require')
  })
  it.each([
    null, { kind: 'unknown' }, { kind: 'fixed', amount: -1, unit: 'coin' },
    { kind: 'fixed', amount: 1, unit: '' }, { kind: 'rate', rate: Infinity },
    { kind: 'rate', rate: -0.1 }, { kind: 'rate', rate: '0.1' },
    { kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1 },
    { kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: -1 },
    { kind: 'rate', rate: 0.1, amount: 2 },
  ])('rejects malformed schedule %j', schedule => {
    const law = tax()
    expect(validateLaw({ ...law, tax: { ...law.tax, schedule } }).some(error => error.startsWith('tax.schedule'))).toBe(true)
  })
  it.each([{ base: '' }, { treasury: '' }, { collector: null }, { arbitrary: true }])('rejects malformed tax field %j', patch => {
    const law = tax()
    expect(validateLaw({ ...law, tax: { ...law.tax, ...patch } }).length).toBeGreaterThan(0)
  })
  it('declares every fixture base with its stubbed owner port and rejects undeclared bases', () => {
    const registry = readFileSync(new URL('../data/laws/READS.md', import.meta.url), 'utf8')
    const reads = registry.split(/\r?\n/).map(line => line.split(' — ')[0]).filter(Boolean)
    expect(registry).toMatch(/economy\.harvest — Economy.*stubbed.*ActFacts/)
    expect(checkLaws([tax()], undefined, reads)).toEqual([])
    const law = tax()
    expect(checkLaws([{ ...law, tax: { ...law.tax, base: 'missing.base' } }], undefined, reads))
      .toContain('laws[0]: tax.base: undeclared read missing.base')
  })
})

describe('pure tax assessment', () => {
  it.each<[TaxSchedule, number, string]>([
    [{ kind: 'fixed', amount: 3, unit: 'coin' }, 3, 'coin'],
    [{ kind: 'rate', rate: 0.125 }, 12.5, 'grain'],
    [{ kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: 50 }, 10, 'grain'],
  ])('computes %j without inventing rounding or a currency', (schedule, owed, unit) => {
    const [row] = assess([tax(schedule)], 10, [payer], facts)
    expect(row).toMatchObject({ type: 'government.tax_assessment', law: 'government/law.tax',
      payer: payer.id, base: 100, owed, unit, day: 10, reason: null, treasury: 'account.treasury', collector: 'office.reeve' })
  })
  it.each([[49, 0], [50, 5], [51, 5.1]])('remits strictly below the threshold: base %s owes %s', (amount, owed) => {
    const law = tax({ kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: 50 })
    expect(assess([law], 10, [payer], () => ({ amount, unit: 'grain' }))[0].owed).toBeCloseTo(owed)
  })
  it.each([undefined, null, { amount: NaN, unit: 'grain' }, { amount: -1, unit: 'grain' }, { amount: 10 }])
    ('missing or invalid base %j stays null for every schedule', value => {
      for (const schedule of [{ kind: 'rate', rate: 0 }, { kind: 'fixed', amount: 3, unit: 'coin' },
        { kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: 50 }] as const) {
        const [row] = assess([tax(schedule)], 10, [payer], () => value)
        expect(row.owed).toBeNull()
        expect(row.reason).toContain('base read: economy.harvest')
      }
    })
  it('preserves a base provider failure as an unresolved reason', () => {
    const [row] = assess([tax()], 10, [payer], () => { throw new Error('port unavailable') })
    expect(row.owed).toBeNull()
    expect(row.reason).toContain('port unavailable')
  })
  it('reads the taxable subject at the query day and leaves predicate failures explicit', () => {
    const read = vi.fn(facts)
    assess([tax()], 10, [payer], read)
    expect(read).toHaveBeenCalledWith('economy.harvest', { actor: payer.id, object: payer.object,
      place: payer.place, day: 10, action: 'pay', attempted: false, succeeded: false })
    const law = tax()
    law.condition = { read: 'person.status', op: 'eq', value: 'tenant' }
    expect(() => assess([law], 10, [payer], facts)).toThrow(/undefined/)
  })
  it('honours dates, status, place, persons, object, conditions and exceptions', () => {
    const law = tax()
    const excluded: Law[] = [
      { ...law, status: 'suspended' }, { ...law, status: 'repealed' },
      { ...law, jurisdiction: { ...law.jurisdiction, from: 11 } },
      { ...law, jurisdiction: { ...law.jurisdiction, until: 10 } },
      { ...law, jurisdiction: { ...law.jurisdiction, places: ['elsewhere'] } },
      { ...law, jurisdiction: { ...law.jurisdiction, persons: { not: true } } },
      { ...law, modality: 'require', regulated: { action: 'pay', object: { not: true } } },
      { ...law, condition: { not: true } },
      { ...law, exceptions: [{ condition: true, reason: 'exempt' }] }, lawFixture(),
    ]
    for (const candidate of excluded) expect(assess([candidate], 10, [payer], facts)).toEqual([])
    law.jurisdiction.from = 10
    expect(assess([law], 10, [payer], facts)).toHaveLength(1)
  })
  it('keeps rival taxes, respects non-tax supersession and sorts laws and payers', () => {
    const a = tax(undefined, 'a'), z = tax(undefined, 'z')
    z.jurisdiction.authority = 'authority.rival'
    z.supersedes = [a.id]
    const payers = [payer, { ...payer, id: 'person.a' }]
    const rows = assess([z, a], 10, payers, facts)
    expect(rows.map(row => [row.law, row.payer])).toEqual([
      [a.id, 'person.a'], [a.id, payer.id], [z.id, 'person.a'], [z.id, payer.id],
    ])
    expect(assess([a, z], 10, [...payers].reverse(), facts)).toEqual(rows)
    const repeal = { ...lawFixture('repeal'), supersedes: [a.id] }
    expect(assess([z, a, repeal], 10, [payer], facts).map(row => row.law)).toEqual([z.id])
  })
  it('does not turn overflow into an infinite obligation', () => {
    expect(assess([tax({ kind: 'rate', rate: Number.MAX_VALUE })], 10, [payer], facts)[0])
      .toMatchObject({ owed: null, reason: expect.stringContaining('invalid assessment') })
  })
  it('a known zero base stays distinct from a missing read, with no invented collector', () => {
    const law = tax()
    delete law.tax!.collector
    expect(assess([law], 10, [payer], () => ({ amount: 0, unit: 'grain' }))[0])
      .toMatchObject({ base: 0, owed: 0, reason: null, collector: null })
  })
})

describe('collection choices and confirmed non-payment', () => {
  it('a partial payment emits a command and its confirmed shortfall uses the existing evaluator', () => {
    const law = tax(), rows = assess([law], 10, [payer], facts)
    expect(collectionCommands(rows, [payment(law, 4)])).toEqual([
      { ...payment(law, 4), type: 'transfer', to: 'account.treasury' },
    ])
    const breaches = taxBreaches([law], rows, [{ ...payment(law, 4), paid: 4 }], facts)
    expect(breaches).toEqual(evaluateAct([law], { ...rows[0].act, action: 'omit:pay' }, facts))
    expect(breaches).toHaveLength(1)
    expect(breaches[0]).toMatchObject({ law: law.id, stage: 'breach', known_to: [] })
    expect(taxBreaches([law], rows, [], facts)).toEqual([])
  })
  it('money collection pays the treasury account even with a named collector', () => {
    const law = tax({ kind: 'fixed', amount: 3, unit: 'coin' })
    const rows = assess([law], 10, [payer], facts)
    expect(collectionCommands(rows, [{ ...payment(law, 2), owner: 'settlement', unit: 'coin', from: 'account.tenant' }]))
      .toEqual([{ law: law.id, payer: payer.id, day: 10, owner: 'settlement', type: 'pay',
        from: 'account.tenant', to: 'account.treasury', amount: 2, unit: 'coin' }])
  })
  it.each([[0, 1], [10, 0], [null, 0]] as const)('confirmed paid %s gives %s breaches', (paid, count) => {
    const law = tax(), rows = assess([law], 10, [payer], facts)
    expect(taxBreaches([law], rows, [{ ...payment(law, 0), paid }], facts)).toHaveLength(count)
    expect(collectionCommands(rows, [])).toEqual([])
    expect(collectionCommands(rows, [payment(law, 0)])).toEqual([])
  })
  it('missing and remitted assessments cannot establish a shortfall', () => {
    const law = tax({ kind: 'proportional-with-remission', remitBoundary: 'strictly-below', rate: 0.1, remitBelow: 200 })
    for (const read of [facts, () => null]) {
      expect(taxBreaches([law], assess([law], 10, [payer], read), [{ ...payment(law, 0), paid: 0 }], read)).toEqual([])
    }
  })
  it('one unpaid law does not create a breach of a paid rival obligation', () => {
    const a = tax(undefined, 'a'), b = tax(undefined, 'b')
    b.jurisdiction.authority = 'authority.rival'
    const rows = assess([a, b], 10, [payer], facts)
    expect(taxBreaches([a, b], rows, [{ ...payment(a, 0), paid: 0 }, { ...payment(b, 10), paid: 10 }], facts)
      .map(breach => breach.law)).toEqual([a.id])
    const repeal = { ...lawFixture('repeal'), supersedes: [a.id] }
    expect(taxBreaches([a, b, repeal], rows, [{ ...payment(a, 0), paid: 0 }], facts)).toEqual([])
  })
  it('rejects unmatched, duplicate, invalid, excessive and wrong-unit choices', () => {
    const law = tax(), rows = assess([law], 10, [payer], facts), choice = payment(law, 4)
    for (const bad of [[{ ...choice, day: 11 }], [choice, choice], [{ ...choice, amount: -1 }],
      [{ ...choice, amount: NaN }], [{ ...choice, amount: 11 }], [{ ...choice, unit: 'coin' }]]) {
      expect(() => collectionCommands(rows, bad)).toThrow()
    }
    expect(() => collectionCommands(assess([law], 10, [payer], () => null), [choice])).toThrow(/Unresolved/)
    expect(() => taxBreaches([law], rows, [{ ...choice, paid: -1 }], facts)).toThrow(/Invalid/)
  })
  it('never writes owner state, law data, payer data or payment choices', () => {
    const owner = { harvest: { amount: 100, unit: 'grain' }, ledger: [] as unknown[], accounts: { tenant: 30, treasury: 0 } }
    const law = tax(), payers = [payer], payments = [payment(law, 4)]
    const before = structuredClone({ owner, law, payers, payments })
    const read: ActFacts = () => Object.freeze(owner.harvest)
    const rows = assess([law], 10, payers, read), beforeRows = structuredClone(rows)
    collectionCommands(rows, payments)
    taxBreaches([law], rows, [{ ...payments[0], paid: 4 }], read)
    expect({ owner, law, payers, payments }).toEqual(before)
    expect(rows).toEqual(beforeRows)
  })
  it('command and breach ordering does not depend on host input order', () => {
    const a = tax(undefined, 'a'), z = tax(undefined, 'z'), laws = [z, a]
    const rows = assess(laws, 10, [payer], facts), payments = [payment(z, 4), payment(a, 3)]
    expect(collectionCommands([...rows].reverse(), payments))
      .toEqual(collectionCommands(rows, [...payments].reverse()))
    const outcomes = payments.map(row => ({ ...row, paid: row.amount }))
    expect(taxBreaches(laws, rows, outcomes, facts))
      .toEqual(taxBreaches([...laws].reverse(), [...rows].reverse(), [...outcomes].reverse(), facts))
  })
})
