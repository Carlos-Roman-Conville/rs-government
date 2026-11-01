import { describe, expect, it, vi } from 'vitest'
import { appropriations, evaluateAct, validateLaw, validateLawData } from '../src/index.ts'
import type { Law, SpendingSchedule, TreasuryBalance } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

function spending(slug = 'watch', schedule: SpendingSchedule = { kind: 'fixed', amount: 10, unit: 'coin' }): Law {
  return { ...lawFixture(slug), modality: 'require', regulated: { action: 'pay', object: 'any' },
    spend: { treasury: 'account.treasury', payee: 'account.watch' }, schedule }
}
const snapshot = (amount: number): TreasuryBalance => ({ amount, unit: 'coin',
  institution: 'authority.council', place: 'place.manor', facts: () => undefined })
const receipts = () => ({ amount: 100, unit: 'coin' })

describe('appropriations under DESIGN §1.10', () => {
  it('pays a fixed appropriation with a Settlement command', () => {
    const result = appropriations([spending()], 10, () => snapshot(20), receipts)
    expect(result.records).toEqual([{ type: 'government.appropriation', law: 'government/law.watch',
      treasury: 'account.treasury', payee: 'account.watch', due: 10, paid: 10, unfunded: 0, unit: 'coin' }])
    expect(result.commands).toEqual([{ owner: 'settlement', type: 'pay', law: 'government/law.watch',
      from: 'account.treasury', to: 'account.watch', amount: 10, unit: 'coin' }])
    expect(result.breaches).toEqual([])
  })
  it('appropriates a share of receipts rather than a share of balance', () => {
    const result = appropriations([spending('church', { kind: 'rate', rate: 0.1 })], 10, () => snapshot(30), receipts)
    expect(result.records[0]).toMatchObject({ due: 10, paid: 10, unfunded: 0 })
  })
  it('an unfunded appropriation gives an institutional breach and no command', () => {
    const law = spending(), account = snapshot(0)
    const result = appropriations([law], 10, () => account, receipts)
    expect(result.commands).toEqual([])
    expect(result.records[0]).toMatchObject({ due: 10, paid: 0, unfunded: 10 })
    expect(result.breaches).toEqual(evaluateAct([law], { actor: account.institution,
      object: 'account.treasury', place: account.place, day: 10, action: 'omit:pay',
      attempted: false, succeeded: false }, account.facts))
    expect(result.breaches).toHaveLength(1)
  })
  it('allocates a shared balance in host-supplied enactment order with partial funding', () => {
    const first = spending('z-first'), second = spending('a-second'), read = vi.fn(() => snapshot(15))
    const result = appropriations([first, second], 10, read, receipts)
    expect(result.records.map(row => [row.law, row.paid, row.unfunded])).toEqual([
      [first.id, 10, 0], [second.id, 5, 5],
    ])
    expect(result.breaches.map(row => row.law)).toEqual([second.id])
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('keeps treasury balances separate and snapshots receipts once per treasury', () => {
    const a = spending('a', { kind: 'rate', rate: 0.1 }), b = spending('b', { kind: 'rate', rate: 0.2 })
    const c = spending('c'); c.spend = { treasury: 'account.other', payee: 'account.watch' }
    const read = vi.fn(receipts)
    expect(appropriations([a, b, c], 10, () => snapshot(30), read).records.map(row => row.paid)).toEqual([10, 20, 10])
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('honours applicability and supersession through the existing evaluator', () => {
    const law = spending()
    const excluded: Law[] = [
      { ...law, status: 'suspended' }, { ...law, condition: { not: true } },
      { ...law, exceptions: [{ condition: true, reason: 'exempt' }] },
      { ...law, jurisdiction: { ...law.jurisdiction, until: 10 } },
      { ...law, jurisdiction: { ...law.jurisdiction, places: ['elsewhere'] } },
      { ...law, modality: 'require', regulated: { action: 'pay', object: { not: true } } },
    ]
    for (const candidate of excluded) expect(appropriations([candidate], 10, () => snapshot(20), receipts).records).toEqual([])
    expect(appropriations([law, { ...lawFixture('replacement'), supersedes: [law.id] }], 10,
      () => snapshot(20), receipts).records).toEqual([])
  })
  it('writes no ledger state and mutates neither laws nor owner snapshots', () => {
    const laws = [spending()], account = Object.freeze(snapshot(20)), received = Object.freeze(receipts())
    const ledger = Object.freeze([]), before = structuredClone(laws)
    appropriations(Object.freeze(laws), 10, () => account, () => received)
    expect(laws).toEqual(before)
    expect(account.amount).toBe(20)
    expect(received.amount).toBe(100)
    expect(ledger).toEqual([])
  })
  it('rejects missing values, mismatched units, duplicate obligations and overflow', () => {
    const law = spending()
    expect(() => appropriations([law, law], 10, () => snapshot(20), receipts)).toThrow(/Duplicate/)
    expect(() => appropriations([law], NaN, () => snapshot(20), receipts)).toThrow()
    expect(() => appropriations([law], 10, () => snapshot(-1), receipts)).toThrow()
    expect(() => appropriations([law], 10, () => ({ ...snapshot(20), unit: 'grain' }), receipts)).toThrow(/unit/)
    expect(() => appropriations([spending('huge', { kind: 'rate', rate: Number.MAX_VALUE })], 10,
      () => snapshot(20), receipts)).toThrow(/amount/)
  })
  it('validates reused fixed/rate shapes and permits spend only on require', () => {
    for (const schedule of [{ kind: 'fixed', amount: 10, unit: 'coin' }, { kind: 'rate', rate: 0.1 }] as const) {
      const law = spending('valid', schedule)
      expect(validateLaw(law)).toEqual([])
      expect(validateLawData({ ...law, jurisdiction: { ...law.jurisdiction, from: null } })).toEqual([])
    }
    for (const modality of ['prohibit', 'permit', 'empower', 'establish']) {
      expect(validateLaw({ ...spending(), modality })).toContain('spend: allowed only for require')
    }
    for (const patch of [{ schedule: undefined }, { schedule: { kind: 'rate', rate: -1 } },
      { schedule: { kind: 'fixed', amount: 1, unit: '' } }, { spend: { treasury: '', payee: '' } }]) {
      expect(validateLaw({ ...spending(), ...patch }).length).toBeGreaterThan(0)
    }
  })
})
