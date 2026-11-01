import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadManorFixture, loadProcedures, createHarvestStubs, runLegitimacyHarvest,
  summarizeHarvest, harvestLedgerDay, sanctionCommands } from '../src/index.ts'
import type { HarvestCommand, HarvestStubParameters, StubOwnerSnapshot } from '../src/index.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = { A: loadManorFixture(root, 'A'), B: loadManorFixture(root, 'B') }
const first = fixtures.A.households[0].id
const parameters: HarvestStubParameters = {
  note: 'Host modelling choices: five 365-day years, harvest day 0, five acres, no stores, 90% harvest loss; pay available grain; unchanged 3087 post-levy food-adequacy belief stub. Not validation.',
  institution: 'authority.manor-court', domain: 'levy', backingActor: 'office.beadle',
  agents: [first], granaryGrain: 0, shockMultiplier: 0.1,
  households: Object.fromEntries(fixtures.A.households.map(h => [h.id, { acres: 5, grain: 0, belief: 1, weight: 1, capacity: 1 }])),
  choosePayment: (row, available) => Math.min(row.owed!, available),
  updateBelief: experience => ({ belief: Math.min(1, experience.grain / experience.annualNeed),
    cause: `Cognition stub: post-levy grain ${experience.grain} / annual subsistence ${experience.annualNeed}; paid ${experience.paid} attributed to court` }),
  acts: day => day.shock ? [{ actor: first, action: 'steal', object: 'inventory.lord-granary',
    place: fixtures.A.place, day: day.day, attempted: true, succeeded: true }] : [],
  present: (_breach, procedure) => ({ witnesses: procedure ? [first] : [], present: procedure !== null }),
}

const seeds = [42, 43]
const runs = seeds.map(seed => {
  const logs: Record<'A' | 'B', HarvestCommand[]> = { A: [], B: [] }
  const needs = { A: new Map<string, number>(), B: new Map<string, number>() }
  const trace = runLegitimacyHarvest({ seed, startDay: 0,
    yearLengths: [365, 365, 365, 365, 365], harvestDays: [0, 0, 0, 0, 0],
    institution: parameters.institution, domain: parameters.domain, backingActor: parameters.backingActor,
    fixtures, procedures: loadProcedures(root).procedures,
    providers: (fixture, random) => {
      const provider = createHarvestStubs(fixture, random, { ...parameters,
        updateBelief: experience => {
          needs[fixture.variant].set(experience.person, experience.annualNeed)
          return parameters.updateBelief(experience)
        } })
      return { ...provider,
        collect: (commands, rows) => { logs[fixture.variant].push(...commands); return provider.collect(commands, rows) },
        execute: command => { logs[fixture.variant].push(command); return provider.execute(command) },
      }
    } })
  const summary = { A: summarizeHarvest(seed, trace.A), B: summarizeHarvest(seed, trace.B) }
  console.info('Stub-provider evidence, not validation; B fails section 3 item 2:', JSON.stringify({ A: { ...summary.A, breachingHouseholds: summary.A.breachingHouseholds.length },
    B: { ...summary.B, breachingHouseholds: summary.B.breachingHouseholds.length } }))
  return { seed, trace, summary, logs, needs }
})

describe('Section 3 acceptance on unchanged stub providers', () => {
  it.each(runs)('seed $seed: A declines and the A-B direction holds', ({ trace, summary }) => {
    expect(summary.A.R.after).toBeLessThan(summary.A.R.before!)
    expect(summary.A.paymentBreaches.after).toBeGreaterThan(summary.A.paymentBreaches.before)
    expect(summary.B.R.after).toBeGreaterThanOrEqual(summary.A.R.after!)
    expect(summary.B.paymentBreaches.after).toBeLessThanOrEqual(summary.A.paymentBreaches.after)
    expect(trace.A.filter(d => d.harvest).map(d => d.input)).toEqual(trace.B.filter(d => d.harvest).map(d => d.input))
  })

  // (5008-fix)
  it('reports each seed’s breaching households and whether the sets are the same', () => {
    const sets = runs.map(({ seed, summary }) => ({ seed,
      A: summary.A.breachingHouseholds, B: summary.B.breachingHouseholds }))
    console.info('Breaching households: stub-provider evidence, not validation:', JSON.stringify(sets))
    for (const variant of ['A', 'B'] as const) {
      const same = sets.every(row => JSON.stringify(row[variant]) === JSON.stringify(sets[0][variant]))
      console.info(`Variant ${variant}: seeds ${seeds.join(', ')} give ${same ? 'the same' : 'different'} sets of breaching households; seed diversity is reported, not asserted.`)
    }
  })

  it.each(runs)('seed $seed: conservation accounts for every command and every owner account', ({ trace, logs, needs }) => {
    for (const variant of ['A', 'B'] as const) {
      expect(logs[variant]).toEqual(trace[variant].flatMap(day => day.commands))
      let balances = new Map(Object.entries(parameters.households).map(([id, h]) => [id, h.grain]))
      balances.set(fixtures[variant].laws.find(l => l.tax)!.tax!.treasury, parameters.granaryGrain)
      for (const day of trace[variant]) {
        const snapshot = day.owners as StubOwnerSnapshot
        const ledger = harvestLedgerDay(day, balances, needs[variant])
        expect(snapshot.grain.opening).toBeCloseTo([...balances.values()].reduce((a, b) => a + b, 0), 8)
        expect(snapshot.grain.harvested).toBeCloseTo(ledger.harvested, 8)
        expect(snapshot.grain.consumed).toBeCloseTo(ledger.consumed, 8)
        expect(snapshot.grain.closing).toBeCloseTo(snapshot.grain.opening + ledger.harvested - ledger.consumed, 8)
        expect(snapshot.coinsMoved).toBe(ledger.coins)
        expect(snapshot.balances.map(b => b.id)).toEqual([...ledger.balances.keys()].sort())
        for (const balance of snapshot.balances) {
          expect(balance.amount).toBeCloseTo(ledger.balances.get(balance.id)!, 8)
          expect(balance.amount).toBeGreaterThanOrEqual(0)
        }
        for (const command of day.commands) {
          if ('payer' in command) {
            expect(command.owner).toBe('economy')
            expect(command.unit).toBe('bushel')
            const receipt = day.payments.find(p => p.law === command.law && p.payer === command.payer && p.day === command.day)
            expect(receipt?.paid).toBe(command.amount)
          } else {
            expect(command).toMatchObject({ owner: 'settlement', type: 'pay', amount: null })
            expect(snapshot.unresolved).toContain('settlement:pay: execution details not supplied')
          }
        }
        const sanctions = day.courts.flatMap(court => court.stages.filter(s => s.stage === 'prosecuted')
          .flatMap(s => sanctionCommands(s, fixtures[variant].laws.find(l => l.id === s.law)!)))
        expect(day.commands.filter(c => !('payer' in c))).toEqual(sanctions)
        balances = new Map(snapshot.balances.map(b => [b.id, b.amount]))
      }
    }
  }, 20000)

  it.each(runs)('seed $seed: attributed beliefs recompute R for the same institution/domain without a stored type', ({ trace }) => {
    for (const variant of ['A', 'B'] as const) {
      const beliefs = new Map(Object.entries(parameters.households).map(([id, h]) => [id, h.belief!]))
      for (const day of trace[variant]) {
        for (const update of day.beliefUpdates) {
          expect(update.before).toBe(beliefs.get(update.person))
          expect(update.cause.trim()).not.toBe('')
          beliefs.set(update.person, update.after!)
        }
        expect(day.R).toBeCloseTo([...beliefs.values()].reduce((a, b) => a + b, 0) / beliefs.size)
        expect(day.recognition).toMatchObject({ institution: parameters.institution, domain: parameters.domain, day: day.day })
        expect(day).not.toHaveProperty('type')
        expect(day.recognition).not.toHaveProperty('type')
        expect(day.owners).not.toHaveProperty('type')
      }
    }
  })
})
