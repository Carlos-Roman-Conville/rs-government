import { describe, expect, it } from 'vitest'
import { applyEntry, collectionCommands, obligationStatus, openObligation, requestCollection, shortfall } from '../src/index.ts'
import type { CollectionRequest, ObligationEntry, TaxAssessment } from '../src/index.ts'

const assessment: TaxAssessment = {
  type: 'government.tax_assessment', law: 'government/law.rent', payer: 'person.tenant',
  base: 100, baseRead: 'economy.harvest', owed: 10, unit: 'grain', day: 5, reason: null,
  treasury: 'inventory.treasury', collector: 'office.collector',
  act: { actor: 'person.tenant', object: 'inventory.harvest', place: 'place.manor',
    action: 'pay', day: 5, attempted: false, succeeded: false },
}
const receipt: ObligationEntry = { kind: 'receipt', ref: 'transfer.1', amount: 4, day: 6 }
const request: CollectionRequest = { ref: 'request.1', amount: 4, from: 'inventory.tenant', owner: 'economy' }
const open = () => openObligation(assessment, 10)

describe('append-only tax obligation ledger', () => {
  it('(o1) a partial confirmed receipt reduces outstanding exactly once', () => {
    const obligation = applyEntry(open(), receipt)
    expect(obligationStatus(obligation)).toEqual({ remaining: 6, outstanding: 6, overpaid: 0 })
    const replay = applyEntry(obligation, { day: 6, amount: 4, ref: 'transfer.1', kind: 'receipt' })
    expect(replay).toBe(obligation)
    expect(replay.entries).toEqual([receipt])
  })
  it('(o2) the same ref with different content throws', () => {
    const obligation = applyEntry(open(), receipt)
    for (const changed of [{ ...receipt, amount: 5 }, { ...receipt, day: 7 },
      { ...receipt, kind: 'refund' as const },
      { kind: 'failed-transfer' as const, ref: receipt.ref, day: 6, reason: 'owner failure' }]) {
      expect(() => applyEntry(obligation, changed)).toThrow(/Conflicting.*ref/)
    }
    const correction: ObligationEntry = { kind: 'correction', ref: 'correction.1', day: 7, delta: -1, reason: 'review' }
    expect(() => applyEntry(applyEntry(open(), correction), { ...correction, reason: 'different review' })).toThrow(/Conflicting/)
  })
  it('(o3) a failed transfer records the owner failure without a receipt', () => {
    const failure: ObligationEntry = { kind: 'failed-transfer', ref: 'failure.1', day: 6, reason: 'insufficient stock' }
    const obligation = applyEntry(open(), failure)
    expect(obligation.entries).toEqual([failure])
    expect(obligationStatus(obligation)).toEqual({ remaining: 10, outstanding: 10, overpaid: 0 })
    expect(applyEntry(obligation, failure)).toBe(obligation)
  })
  it('(o4) pending requests collect once and reserve the outstanding amount', () => {
    const obligation = open()
    for (const owner of ['economy', 'settlement'] as const) {
      const choice = { ...request, owner }
      expect(requestCollection(obligation, [], choice)).toEqual(collectionCommands([assessment], [{
        law: assessment.law, payer: assessment.payer, day: assessment.day, unit: 'grain',
        amount: choice.amount, from: choice.from, owner,
      }])[0])
    }
    expect(requestCollection(obligation, [request], request)).toBeNull()
    expect(() => requestCollection(obligation, [request], { ...request, ref: 'request.2', amount: 7 }))
      .toThrow(/outstanding less pending/)
    expect(requestCollection(obligation, [request], { ...request, ref: 'request.2', amount: 6 }))
      .toMatchObject({ amount: 6 })
    expect(requestCollection(obligation, [], { ...request, amount: 0 })).toBeNull()
    expect(obligation.entries).toEqual([])
    expect(obligationStatus(obligation).outstanding).toBe(10)
    const reduced = applyEntry(obligation, receipt)
    expect(() => requestCollection(reduced, [request], { ...request, ref: 'request.2', amount: 3 })).toThrow()
    // The host can persist and reload the record without losing the owner destination.
    expect(requestCollection(JSON.parse(JSON.stringify(obligation)), [], request))
      .toEqual(requestCollection(obligation, [], request))
  })
  it('(o5) remission and signed corrections change remaining without clamping', () => {
    let obligation = applyEntry(open(), { kind: 'remission', ref: 'remission.1', amount: 3, day: 6, law: 'government/law.relief' })
    expect(obligationStatus(obligation).remaining).toBe(7)
    obligation = applyEntry(obligation, { kind: 'correction', ref: 'correction.1', delta: -2, day: 7, reason: 'base corrected' })
    expect(obligationStatus(obligation).remaining).toBe(5)
    obligation = applyEntry(obligation, { kind: 'correction', ref: 'correction.2', delta: 4, day: 8, reason: 'omitted base' })
    expect(obligationStatus(obligation).remaining).toBe(9)
    expect(obligation.assessed).toBe(10)
  })
  it('(o6) overpayment and refunds stay explicit and refunds cannot exceed receipts', () => {
    let obligation = applyEntry(open(), { ...receipt, amount: 15 })
    expect(obligationStatus(obligation)).toEqual({ remaining: -5, outstanding: 0, overpaid: 5 })
    obligation = applyEntry(obligation, { kind: 'refund', ref: 'refund.1', amount: 3, day: 7 })
    expect(obligationStatus(obligation)).toEqual({ remaining: -2, outstanding: 0, overpaid: 2 })
    expect(() => applyEntry(obligation, { kind: 'refund', ref: 'refund.2', amount: 13, day: 8 }))
      .toThrow(/Refund exceeds confirmed paid total/)
    const refunded = applyEntry(obligation, { kind: 'refund', ref: 'refund.2', amount: 12, day: 8 })
    expect(obligationStatus(refunded)).toEqual({ remaining: 10, outstanding: 10, overpaid: 0 })
    expect(() => applyEntry(open(), { kind: 'refund', ref: 'refund.1', amount: 1, day: 7 })).toThrow(/Refund/)
  })
  it('(o7) unresolved assessments and invalid or omitted deadlines open no obligation', () => {
    expect(() => openObligation({ ...assessment, owed: null }, 10)).toThrow(/unresolved/)
    for (const due of [4, NaN, Infinity, -Infinity]) expect(() => openObligation(assessment, due)).toThrow(/Due day/)
    // @ts-expect-error A deadline is mandatory at the type boundary and runtime.
    expect(() => openObligation(assessment)).toThrow(/Due day/)
    expect(openObligation(assessment, 5)).toEqual({ type: 'government.tax_obligation',
      law: assessment.law, payer: assessment.payer, unit: 'grain', assessedOn: 5, due: 5,
      assessed: 10, treasury: assessment.treasury, entries: [] })
    expect(obligationStatus(openObligation({ ...assessment, owed: 0 }, 5)).remaining).toBe(0)
  })
  it('(o8) shortfall exposes exactly the due amount and known or unknown holdings', () => {
    const obligation = open()
    expect(shortfall(obligation, 9, 2)).toBeNull()
    for (const held of [2, null, 20]) {
      const fact = shortfall(obligation, 10, held)
      expect(fact).toEqual({ law: assessment.law, payer: assessment.payer, unit: 'grain', day: 10, outstanding: 10, held })
      expect(Object.keys(fact!).sort()).toEqual(['day', 'held', 'law', 'outstanding', 'payer', 'unit'])
    }
    expect(shortfall(applyEntry(obligation, { ...receipt, amount: 10 }), 10, null)).toBeNull()
    expect(shortfall(obligation, 11, null)?.day).toBe(11)
  })
  it('(o9) fixed replay permutations preserve the accounting identity and status', () => {
    // Every ordering keeps its refund after enough confirmed receipts.
    const entries: ObligationEntry[] = [
      { kind: 'receipt', ref: 'receipt.1', amount: 8, day: 6 },
      { kind: 'remission', ref: 'remission.1', amount: 2, day: 7, law: 'government/law.relief' },
      { kind: 'correction', ref: 'correction.1', delta: -1, day: 7, reason: 'review' },
      { kind: 'correction', ref: 'correction.2', delta: 3, day: 8, reason: 'omitted base' },
      { kind: 'failed-transfer', ref: 'failure.1', day: 8, reason: 'owner failure' },
      { kind: 'refund', ref: 'refund.1', amount: 1, day: 9 },
      { kind: 'receipt', ref: 'receipt.2', amount: 2, day: 9 },
    ]
    const permutations = [[0, 1, 2, 3, 4, 5, 6], [4, 3, 2, 6, 5, 1, 0], [2, 0, 5, 4, 1, 6, 3]]
    const expected = { remaining: 1, outstanding: 1, overpaid: 0 }
    for (const order of permutations) {
      let obligation = open()
      for (const i of [...order, ...order.slice().reverse()]) obligation = applyEntry(obligation, entries[i])
      expect(obligation.entries).toHaveLength(entries.length)
      expect(obligationStatus(obligation)).toEqual(expected)
      const sum = obligation.entries.reduce((total, entry) => total
        + (entry.kind === 'correction' ? entry.delta : entry.kind === 'refund' ? entry.amount
          : entry.kind === 'receipt' || entry.kind === 'remission' ? -entry.amount : 0), obligation.assessed)
      expect(obligationStatus(obligation).remaining).toBe(sum)
    }
  })
  it('(o10) applying an entry leaves the prior value unchanged for complete rollback', () => {
    const obligation = open(), before = structuredClone(obligation), input = { ...receipt }
    Object.freeze(obligation.entries)
    Object.freeze(obligation)
    const next = applyEntry(obligation, input)
    expect(next).not.toBe(obligation)
    expect(obligation).toEqual(before)
    expect(obligationStatus(obligation).outstanding).toBe(10)
    expect(obligationStatus(next).outstanding).toBe(6)
    expect(next.entries[0]).not.toBe(input)
    input.amount = 9
    expect(obligationStatus(next).outstanding).toBe(6)
    const nextBefore = structuredClone(next)
    applyEntry(next, { kind: 'correction', ref: 'correction.1', delta: 2, day: 8, reason: 'review' })
    expect(next).toEqual(nextBefore)
  })
  it('rejects invalid entry amounts, deltas, refs and days before appending', () => {
    for (const amount of [-1, NaN, Infinity]) {
      for (const kind of ['receipt', 'refund', 'remission'] as const) {
        expect(() => applyEntry(open(), { kind, ref: 'invalid', day: 6, amount, law: 'government/law.relief' })).toThrow(/amount/)
      }
    }
    for (const delta of [NaN, Infinity]) {
      expect(() => applyEntry(open(), { kind: 'correction', ref: 'invalid', day: 6, delta, reason: 'review' })).toThrow(/delta/)
    }
    expect(() => applyEntry(open(), { ...receipt, ref: ' ' })).toThrow(/ref/)
    expect(() => applyEntry(open(), { ...receipt, day: NaN })).toThrow(/day/)
    const huge = applyEntry(open(), { ...receipt, amount: Number.MAX_VALUE })
    expect(() => applyEntry(huge, { ...receipt, ref: 'transfer.2', amount: Number.MAX_VALUE })).toThrow(/finite/)
  })
  it('rejects invalid collection choices and unknown holdings must be explicit null', () => {
    for (const amount of [-1, NaN, Infinity]) {
      expect(() => requestCollection(open(), [], { ...request, amount })).toThrow(/Invalid/)
    }
    expect(() => requestCollection(open(), [], { ...request, ref: '' })).toThrow(/Invalid/)
    expect(() => requestCollection(open(), [{ ...request, amount: NaN }], request)).toThrow(/Invalid/)
    expect(() => requestCollection(open(), [request, request], request)).toThrow(/Duplicate pending/)
    expect(() => shortfall(open(), NaN, null)).toThrow(/Invalid/)
    expect(() => shortfall(open(), 10, NaN)).toThrow(/Invalid/)
  })
})
