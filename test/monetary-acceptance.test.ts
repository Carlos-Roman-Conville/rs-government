import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  createAuthorityProvider, createViolation, detect, issue, legalTender, mint, prosecute,
  refusalBreaches, sanction, sanctionCommands, validateLawData,
} from '../src/index.ts'
import type { ActFacts, Law, LawData, MintRequest, MonetaryRequest, RefusalContext, RefusalOutcome, SanctionCommand } from '../src/index.ts'
import { normalizeCalendarPoint } from '../src/law/calendar.ts'
import { toDay } from '../scripts/calendar.ts'

const repo = fileURLToPath(new URL('..', import.meta.url))
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/monetary-island-b.json')
const islandRaw = JSON.parse(readFileSync(fixturePath, 'utf8')) as IslandFixture

interface IslandFixture {
  note: string
  office: string
  officeGrantId: string
  authority: string
  place: string
  collector: string
  currency: string
  coin: { id: string; metal: string; metalContent: number; note: string }
  laws: LawData[]
}

function lawDataToLaw(data: LawData): Law {
  const jurisdiction = { ...data.jurisdiction, from: null as number | null, until: null as number | null }
  for (const key of ['from', 'until'] as const) {
    if (data.jurisdiction[key] === null) continue
    jurisdiction[key] = toDay(normalizeCalendarPoint(data.jurisdiction[key]))
  }
  const law = { ...data, enactment: data.enactment ?? null, jurisdiction } as Law
  expect(validateLawData(data)).toEqual([])
  return law
}

function islandLaws(): Law[] { return islandRaw.laws.map(lawDataToLaw) }

function islandFacts(officeSeat = islandRaw.place): ActFacts {
  return name => {
    if (name === 'office.seat') return officeSeat
    if (name === 'person.place') return islandRaw.place
    if (name === 'actor.office') return islandRaw.officeGrantId
    return undefined
  }
}

function islandAuthority(laws = islandLaws()) {
  return createAuthorityProvider(laws, islandFacts(),
    office => office === islandRaw.office ? islandRaw.officeGrantId : null)
}

function tenderScope() {
  return {
    authority: islandRaw.authority, actor: islandRaw.collector, place: islandRaw.place,
    facts: islandFacts(),
  }
}

function repealDay(): number {
  const until = islandRaw.laws[0].jurisdiction.until
  if (until === null || until === undefined) throw new Error('fixture legal tender must carry an until date')
  return toDay(normalizeCalendarPoint(until))
}

function forbidPriceOrQuote(value: unknown, path = 'root'): void {
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbidPriceOrQuote(item, `${path}[${index}]`))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    expect(key, `${path}.${key}`).not.toMatch(/^(price|quote)$/i)
    forbidPriceOrQuote(nested, `${path}.${key}`)
  }
}

describe('§8 Government acceptance (a) legal tender and monetary authority stay off Economy prices', () => {
  it('legalTender output and issue/mint commands carry no price or quote field', () => {
    const laws = islandLaws()
    const day = repealDay() - 1
    const assets = legalTender(laws, tenderScope(), day, 'tax')
    expect(assets).toEqual([islandRaw.currency])
    forbidPriceOrQuote(assets)
    const authority = islandAuthority(laws)
    const money: MonetaryRequest = {
      law: laws[1].id, office: islandRaw.office, holder: islandRaw.collector,
      currency: islandRaw.currency, amount: 4, day, note: islandRaw.note,
    }
    const coin: MintRequest = {
      law: laws[2].id, office: islandRaw.office, holder: islandRaw.collector, day,
      metal: islandRaw.coin.metal, metalUnits: 1, coin: islandRaw.coin.id, coinUnits: 4,
      metalContent: islandRaw.coin.metalContent,
    }
    for (const result of [issue(money, authority), mint(coin, authority)]) {
      forbidPriceOrQuote(result)
      for (const command of result.commands) forbidPriceOrQuote(command)
    }
  })

  it('no module under src/monetary/ imports Economy price code', () => {
    const monetaryDir = join(repo, 'src/monetary')
    const forbidden = [/from\s+['"][^'"]*economy[^'"]*price/i, /from\s+['"]@rex\/economy['"]/]
    for (const file of readdirSync(monetaryDir).filter(name => name.endsWith('.ts'))) {
      const source = readFileSync(join(monetaryDir, file), 'utf8')
      for (const pattern of forbidden) expect(source, file).not.toMatch(pattern)
    }
  })
})

describe('§8 Government acceptance (b) legal tender repeal through until', () => {
  it('changes the answer the next day without storing a list', () => {
    const laws = islandLaws()
    const scope = tenderScope()
    const before = structuredClone(laws)
    const last = repealDay() - 1
    expect(legalTender(laws, scope, last, 'tax')).toEqual([islandRaw.currency])
    expect(legalTender(laws, scope, repealDay(), 'tax')).toEqual([])
    expect(legalTender(laws, scope, last, 'tax')).toEqual([islandRaw.currency])
    expect(laws).toEqual(before)
  })
})

describe('§8 Government acceptance (c) legal tender refusal breach and enforcement chain', () => {
  const context: RefusalContext = {
    authority: islandRaw.authority, place: islandRaw.place, day: repealDay() - 1, facts: islandFacts(),
  }
  const outcome: RefusalOutcome = {
    type: 'shared.action.outcome', status: 'failed', payload: {
      type: 'refused', reason: 'not-accepted', refusedBy: islandRaw.collector,
      currency: islandRaw.currency, purpose: 'tax',
    },
  }

  it('records a breach and sanctions only after detection and prosecution', () => {
    const law = islandLaws()[0]
    const [breach] = refusalBreaches(islandLaws(), outcome, context)
    expect(breach.law).toBe(law.id)
    const initial = createViolation('government/violation.island-b-refusal', breach)
    expect(() => sanction(initial)).toThrow(/Illegal violation transition/)
    const prosecuted = prosecute(detect(initial, 'office.island-b-reeve'))
    expect(sanctionCommands(prosecuted, law)).toEqual([{
      owner: 'settlement', type: 'pay', violation: initial.id, law: law.id,
      actor: islandRaw.collector, object: islandRaw.currency, amount: null,
      note: 'test fiction: amount not stated',
    }])
    expect(sanction(prosecuted).stage).toBe('sanctioned')
  })

  it('keeps a valid breach when detection fails and emits no sanction', () => {
    const law = islandLaws()[0]
    const record = createViolation('government/violation.island-b-unseen',
      refusalBreaches(islandLaws(), outcome, context)[0])
    const commands: SanctionCommand[] = []
    const observe = vi.fn(() => false)
    if (observe()) commands.push(...sanctionCommands(prosecute(detect(record, 'office.island-b-reeve')), law))
    expect(observe).toHaveBeenCalledOnce()
    expect(record.stage).toBe('breach')
    expect(commands).toEqual([])
  })
})

describe('§8 Government acceptance (d) issue and mint under may, logged, metal conserved', () => {
  const day = repealDay() - 1
  const money: MonetaryRequest = {
    law: islandRaw.laws[1].id, office: islandRaw.office, holder: islandRaw.collector,
    currency: islandRaw.currency, amount: 8, day, note: islandRaw.note,
  }
  const coin: MintRequest = {
    law: islandRaw.laws[2].id, office: islandRaw.office, holder: islandRaw.collector, day,
    metal: islandRaw.coin.metal, metalUnits: 2, coin: islandRaw.coin.id, coinUnits: 8,
    metalContent: islandRaw.coin.metalContent,
  }

  it('refuses without may and logs one flagged event', () => {
    const authority = islandAuthority()
    authority.may = vi.fn(() => false)
    expect(issue(money, authority).events[0]).toMatchObject({ outcome: 'refused', flagged: true })
    expect(mint(coin, authority).events[0]).toMatchObject({ outcome: 'refused', flagged: true })
  })

  it('issues and mints when permitted, logs provenance, and conserves metal', () => {
    const authority = islandAuthority()
    const issued = issue(money, authority)
    expect(issued.commands).toEqual([{
      type: 'credit', holder: money.holder, amount: money.amount, currency: money.currency,
      process: 'government.monetary.issue', note: money.note,
    }])
    expect(issued.events[0]).toMatchObject({
      type: 'government.monetary', action: 'issue', law: money.law, outcome: 'command', flagged: false,
    })
    const minted = mint(coin, authority)
    expect(minted.commands).toEqual([{
      type: 'mint', office: coin.office, holder: coin.holder, metal: coin.metal,
      metalUnits: coin.metalUnits, coin: coin.coin, coinUnits: coin.coinUnits, day: coin.day,
    }])
    const command = minted.commands[0]!
    expect(command.metalUnits).toBe(command.coinUnits * coin.metalContent!)
    expect(minted.events[0]).toMatchObject({
      action: 'mint', law: coin.law, metalContent: coin.metalContent, outcome: 'command',
    })
  })
})

describe('§8 Government acceptance (e) absent Government legal tender is empty', () => {
  it('returns [] with no laws', () => {
    expect(legalTender([], tenderScope(), 0, 'tax')).toEqual([])
    expect(legalTender([], tenderScope(), 0, 'debt')).toEqual([])
  })

  it('labels island B fixture as test fiction for hosts and reports', () => {
    expect(islandRaw.note).toBe('test fiction')
    expect(JSON.stringify(islandRaw)).toContain('test fiction')
  })
})
