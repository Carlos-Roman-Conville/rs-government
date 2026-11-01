import { describe, expect, it, vi } from 'vitest'
import { issue, retire, mint } from '../src/index.ts'
import type { AuthorityProvider, MintRequest, MonetaryRequest } from '../src/index.ts'

// Test fiction: all identifiers, dates, amounts and metal contents below are invented
// for these tests only, not historical rules or production coin definitions.
const money: MonetaryRequest = Object.freeze({ law: 'government/law.test-fiction-issue',
  office: 'office.test-mint', holder: 'person.test-holder', currency: 'currency.test',
  amount: 12, day: 7, note: 'test fiction issuance or retirement' })
const coin: MintRequest = Object.freeze({ law: 'government/law.test-fiction-mint',
  office: money.office, holder: money.holder, day: money.day,
  metal: 'good.test-metal', metalUnits: 6, coin: 'good.test-coin', coinUnits: 3, metalContent: 2 })

function provider(allowed: boolean): AuthorityProvider & { may: ReturnType<typeof vi.fn<AuthorityProvider['may']>> } {
  return { may: vi.fn<AuthorityProvider['may']>(() => allowed) }
}

describe.each([
  { action: 'issue', run: issue, type: 'credit', process: 'government.monetary.issue' },
  { action: 'retire', run: retire, type: 'debit', process: 'government.monetary.retire' },
] as const)('$action monetary authority', ({ action, run, type, process }) => {
  it('emits no command and one reasoned refusal when the issue power is denied', () => {
    const authority = provider(false)
    const result = run(money, authority)
    expect(authority.may.mock.calls).toEqual([[money.office, 'issue', money.currency, money.day]])
    expect(result.commands).toEqual([])
    expect(result.events).toEqual([{ type: 'government.monetary', action,
      law: money.law, office: money.office, currency: money.currency, holder: money.holder,
      amount: money.amount, day: money.day, outcome: 'refused', flagged: true,
      reason: `AuthorityProvider.may refused issue for ${money.currency}` }])
  })

  it('emits exactly one Settlement command and one provenance event when permitted', () => {
    const authority = provider(true)
    const result = run(money, authority)
    expect(authority.may.mock.calls).toEqual([[money.office, 'issue', money.currency, money.day]])
    expect(result.commands).toEqual([{ type, holder: money.holder, amount: money.amount,
      currency: money.currency, process, note: money.note }])
    expect(result.events).toEqual([{ type: 'government.monetary', action,
      law: money.law, office: money.office, currency: money.currency, holder: money.holder,
      amount: money.amount, day: money.day, outcome: 'command', reason: null, flagged: false }])
  })

  it.each([0, -1, NaN, Infinity, -Infinity])('refuses invalid amount %s even with permission', amount => {
    const result = run({ ...money, amount }, provider(true))
    expect(result.commands).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ outcome: 'refused', flagged: true,
      reason: 'Amount must be finite and greater than zero' })
  })

  it('preserves unknown provenance as null and rechecks authority on every call', () => {
    const authority = provider(true)
    expect(run({ ...money, law: null }, authority).events[0].law).toBeNull()
    authority.may.mockReturnValue(false)
    expect(run(money, authority).commands).toEqual([])
    expect(authority.may).toHaveBeenCalledTimes(2)
  })
})

describe('mint monetary authority', () => {
  it('emits no command and logs a refusal when the mint power over this coin is denied', () => {
    const authority = provider(false)
    const result = mint(coin, authority)
    expect(authority.may.mock.calls).toEqual([[coin.office, 'mint', coin.coin, coin.day]])
    expect(result.commands).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ outcome: 'refused', flagged: true,
      reason: `AuthorityProvider.may refused mint for ${coin.coin}` })
  })

  it('flags missing metal content as null and refuses without assuming a content', () => {
    const result = mint({ ...coin, metalContent: null }, provider(true))
    expect(result.commands).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ metalContent: null, outcome: 'refused', flagged: true,
      reason: 'Missing coin metal content' })
  })

  it.each([5, 7, 6 + Number.EPSILON * 4])('refuses mismatched metal quantity %s without rounding it', metalUnits => {
    const result = mint({ ...coin, metalUnits }, provider(true))
    expect(result.commands).toEqual([])
    expect(result.events[0]).toMatchObject({ outcome: 'refused', flagged: true,
      reason: 'Coin metal content times coinUnits must equal metalUnits' })
  })

  it.each([
    { metalContent: 2, coinUnits: 3, metalUnits: 6 },
    { metalContent: 0.25, coinUnits: 6, metalUnits: 1.5 },
    { metalContent: 5, coinUnits: 2, metalUnits: 10 },
  ])('conserves the host-supplied metal across a mint: %j', quantities => {
    const request = Object.freeze({ ...coin, ...quantities })
    const authority = provider(true)
    const result = mint(request, authority)
    expect(authority.may.mock.calls).toEqual([[coin.office, 'mint', coin.coin, coin.day]])
    expect(result.commands).toEqual([{ type: 'mint', office: coin.office, holder: coin.holder,
      metal: coin.metal, metalUnits: quantities.metalUnits, coin: coin.coin,
      coinUnits: quantities.coinUnits, day: coin.day }])
    const command = result.commands[0]!
    expect(command.metalUnits).toBe(command.coinUnits * request.metalContent)
    expect(result.events).toEqual([{ type: 'government.monetary', action: 'mint', law: coin.law,
      office: coin.office, holder: coin.holder, currency: coin.coin, amount: quantities.coinUnits,
      day: coin.day, outcome: 'command', reason: null, flagged: false,
      metal: coin.metal, coin: coin.coin, ...quantities }])
    expect(mint(request, authority)).toEqual(result)
  })

  it.each(['metalContent', 'metalUnits', 'coinUnits'] as const)('refuses invalid %s', field => {
    for (const value of [0, -1, NaN, Infinity, -Infinity]) {
      const result = mint({ ...coin, [field]: value }, provider(true))
      expect(result.commands).toEqual([])
      expect(result.events[0]).toMatchObject({ outcome: 'refused', flagged: true, reason: expect.any(String) })
    }
  })

  it('refuses overflow even when an overflowing product would equal the supplied metal', () => {
    expect(mint({ ...coin, metalContent: Number.MAX_VALUE, coinUnits: 2, metalUnits: Infinity },
      provider(true)).commands).toEqual([])
  })
})

it.each([NaN, Infinity, -Infinity])('rejects non-finite day %s before consulting authority', day => {
  const authority = provider(true)
  expect(() => issue({ ...money, day }, authority)).toThrow('Monetary day must be finite')
  expect(() => retire({ ...money, day }, authority)).toThrow('Monetary day must be finite')
  expect(() => mint({ ...coin, day }, authority)).toThrow('Monetary day must be finite')
  expect(authority.may).not.toHaveBeenCalled()
})
