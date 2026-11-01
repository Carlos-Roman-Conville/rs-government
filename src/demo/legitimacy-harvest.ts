import { streams } from '@rex/kernel'
import type { RandomStreams } from '@rex/kernel'
import { backing } from '../authority/distribution.ts'
import type { AgentsReader, BeliefReader, CapacityReader, WeightReader } from '../authority/readers.ts'
import { assess, collectionCommands, taxBreaches } from '../fiscal/tax.ts'
import type { TaxAssessment, TaxCollectionCommand, TaxPayment, TaxPaymentOutcome } from '../fiscal/tax.ts'
import { evaluateAct } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import type { Procedure } from '../law/procedure.ts'
import { createViolation, detect, prosecute, sanctionCommands, sanction, fail } from '../law/violation.ts'
import type { Breach, SanctionCommand, Violation } from '../law/violation.ts'
import { legitimacyRead } from '../legitimacy/aggregate.ts'
import type { LegitimacyRead } from '../legitimacy/aggregate.ts'
import { defaultAuthorityProvider } from '../ports/authority-provider.ts'
import type { LoadedManorFixture, DemoVariant } from './fixture.ts'

export interface HarvestCalendar {
  startDay: number
  /** Host calendar, including leap years if needed. Exactly five years. */
  yearLengths: readonly [number, number, number, number, number]
  /** Zero-based day within each year; the third harvest is the input shock. */
  harvestDays: readonly [number, number, number, number, number]
}
export interface HarvestDay { day: number; year: number; yearLength: number; harvest: boolean; shock: boolean }
export type HarvestCommand = TaxCollectionCommand | SanctionCommand
export interface BeliefUpdate { person: string; before: number | null; after: number | null; cause: string }
export interface CourtChoice { witnesses: string[]; present: boolean }
export interface CourtRecord { procedure: string | null; stages: Violation[] }
export interface HarvestProviders {
  facts: ActFacts
  readers: BeliefReader & WeightReader & AgentsReader & CapacityReader
  begin(day: HarvestDay): unknown
  choosePayments(rows: readonly TaxAssessment[]): TaxPayment[]
  collect(commands: readonly TaxCollectionCommand[], rows: readonly TaxAssessment[]): TaxPaymentOutcome[]
  acts(day: HarvestDay): Act[]
  present(breach: Breach, procedure: Procedure | null): CourtChoice
  execute(command: SanctionCommand): boolean | null
  observe(day: HarvestDay, assessments: readonly TaxAssessment[], courts: readonly CourtRecord[]): BeliefUpdate[]
  end(day: HarvestDay): unknown
}
export interface HarvestTraceDay extends HarvestDay {
  input: unknown
  assessments: TaxAssessment[]
  commands: HarvestCommand[]
  payments: TaxPaymentOutcome[]
  breaches: Breach[]
  courts: CourtRecord[]
  beliefUpdates: BeliefUpdate[]
  recognition: LegitimacyRead
  R: number | null
  backing: ReturnType<typeof backing>
  owners: unknown
}
export interface HarvestRunOptions extends HarvestCalendar {
  seed: number
  institution: string
  domain: string
  backingActor: string
  fixtures: Record<DemoVariant, LoadedManorFixture>
  procedures: readonly Procedure[]
  /** A fresh owner world for each variant; common random streams start at the same seed. */
  providers(fixture: LoadedManorFixture, random: RandomStreams): HarvestProviders
}

/** Orchestration only: all owner mutations go through providers. No file output.
 * Procedure text is evidence for a provider's choice, never executable policy.
 */
export function runLegitimacyHarvest(options: HarvestRunOptions): Record<DemoVariant, HarvestTraceDay[]> {
  if (!Number.isInteger(options.startDay) || !Number.isInteger(options.seed)
    || options.yearLengths.length !== 5 || options.harvestDays.length !== 5
    || options.yearLengths.some((length, i) => !Number.isInteger(length) || length <= 0
      || !Number.isInteger(options.harvestDays[i]) || options.harvestDays[i] < 0 || options.harvestDays[i] >= length)) {
    throw new Error('Expected a seed and a five-year daily calendar with one harvest per year')
  }
  const result = {} as Record<DemoVariant, HarvestTraceDay[]>
  for (const variant of ['A', 'B'] as const) {
    const fixture = options.fixtures[variant]
    if (fixture.variant !== variant) throw new Error('Fixture variant mismatch')
    const owner = options.providers(fixture, streams(options.seed))
    const trace: HarvestTraceDay[] = []
    let day = options.startDay
    for (let year = 0; year < 5; year++) for (let offset = 0; offset < options.yearLengths[year]; offset++, day++) {
      const harvest = offset === options.harvestDays[year]
      const today: HarvestDay = { day, year: year + 1, yearLength: options.yearLengths[year], harvest, shock: harvest && year === 2 }
      const input = owner.begin(today)
      // The host's harvest date is also this stub experiment's levy deadline.
      // Calling assess daily with no due payers prevents repeating an annual obligation.
      const assessments = assess(fixture.laws, day, harvest ? fixture.households.map(h => ({ ...h, object: h.id })) : [], owner.facts)
      const collections = collectionCommands(assessments, owner.choosePayments(assessments))
      const commands: HarvestCommand[] = [...collections]
      const payments = owner.collect(collections, assessments)
      const breaches = [...taxBreaches(fixture.laws, assessments, payments, owner.facts),
        ...owner.acts(today).flatMap(act => {
          if (act.day !== day) throw new Error('Provider act must belong to the current day')
          return evaluateAct(fixture.laws, act, owner.facts)
        })].sort((a, b) => compare(a.law, b.law) || compare(a.act.actor, b.act.actor) || compare(a.act.action, b.act.action))
      const courts = breaches.map((breach, i): CourtRecord => {
        const law = fixture.laws.find(l => l.id === breach.law)!
        const procedure = law.procedure === null ? null : options.procedures.find(p => p.id === `government/${law.procedure}`)
        if (procedure === undefined) throw new Error(`Missing procedure: ${law.procedure}`)
        let record = createViolation(`${variant}:${day}:${i}`, breach)
        const stages = [record]
        const choice = owner.present(breach, procedure)
        for (const witness of [...new Set(choice.witnesses)].sort()) {
          record = detect(record, witness); stages.push(record)
        }
        if (procedure && choice.present && record.stage === 'detected') {
          record = prosecute(record); stages.push(record)
          const prescribed = sanctionCommands(record, law)
          commands.push(...prescribed)
          const receipts = prescribed.map(command => owner.execute(command))
          // Empty sanctions and unknown amounts do not prove a completed remedy.
          if (receipts.length && receipts.every(receipt => receipt === true)) stages.push(sanction(record))
          else if (receipts.some(receipt => receipt === false)) stages.push(fail(record, 'Owner reported execution failure'))
        }
        return { procedure: procedure?.id ?? null, stages }
      })
      const beliefUpdates = owner.observe(today, assessments, courts).sort((a, b) => compare(a.person, b.person))
      const owners = owner.end(today)
      const recognition = legitimacyRead(options.institution, options.domain, day, fixture.households.map(h => h.id), owner.readers, owner.readers)
      trace.push({ ...today, input, assessments, commands, payments, breaches, courts, beliefUpdates,
        recognition, R: recognition.R, backing: backing(options.backingActor, options.domain, owner.readers), owners })
    }
    result[variant] = trace
  }
  return result
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
export interface StubHousehold {
  acres: number
  grain: number
  belief: number | null
  weight: number
  capacity: number
}
export interface ExtractionExperience {
  person: string
  day: number
  before: number | null
  harvest: number
  paid: number
  grain: number
  annualNeed: number
  courts: readonly CourtRecord[]
}
export interface HarvestStubParameters {
  /** All unsourced values/behaviour are explicit host modelling choices. */
  note: string
  institution: string
  domain: string
  backingActor: string
  agents: readonly string[]
  households: Readonly<Record<string, StubHousehold>>
  granaryGrain: number
  shockMultiplier: number
  choosePayment(row: Readonly<TaxAssessment>, available: number, draw: () => number): number
  updateBelief(experience: Readonly<ExtractionExperience>): { belief: number | null; cause: string }
  acts(day: HarvestDay, draw: () => number): Act[]
  present(breach: Breach, procedure: Procedure | null, draw: () => number): CourtChoice
}
export interface StubOwnerSnapshot {
  grain: { opening: number; harvested: number; consumed: number; closing: number }
  balances: { id: string; amount: number }[]
  /** No monetary amount is specified by the fixture, so no coins move. */
  coinsMoved: number
  unresolved: string[]
}

/** In-repo Economy/Life/Cognition/Settlement stand-ins, not engine validation.
 * Uniform sampling within sourced yield/need ranges is a modelling stand-in.
 * Host callbacks decide payment from expected consequences (not recognition),
 * observed acts, presentment and attributed belief updates. No behavioural defaults.
 * The ledger is private to these owner providers; Government only sends commands.
 */
export function createHarvestStubs(fixture: LoadedManorFixture, random: RandomStreams,
  parameters: HarvestStubParameters): HarvestProviders {
  const config = { ...parameters, households: structuredClone(parameters.households), agents: [...parameters.agents] }
  const people = [...fixture.households].sort((a, b) => compare(a.id, b.id))
  const treasury = fixture.laws.find(l => l.tax)?.tax?.treasury
  if (!treasury || !config.note.trim()) throw new Error('Stub requires a treasury and modelling-choice note')
  const nonnegative = (value: number) => Number.isFinite(value) && value >= 0
  if (!nonnegative(config.granaryGrain) || !nonnegative(config.shockMultiplier) || config.shockMultiplier >= 1) throw new Error('Invalid stub grain or shock multiplier')
  for (const h of people) {
    const p = config.households[h.id]
    if (!p || ![p.acres, p.grain, p.weight, p.capacity].every(nonnegative)
      || (p.belief !== null && (!nonnegative(p.belief) || p.belief > 1))) throw new Error(`Invalid stub household: ${h.id}`)
  }
  if (config.agents.some(id => !config.households[id])) throw new Error('Unknown stub agent')
  const balances = new Map(people.map(h => [h.id, config.households[h.id].grain]))
  balances.set(treasury, config.granaryGrain)
  const beliefs = new Map(people.map(h => [h.id, config.households[h.id].belief]))
  const needs = new Map<string, number>(), yields = new Map<string, number>(), paid = new Map<string, number>()
  const authority = defaultAuthorityProvider(fixture.offices)
  const sample = (range: readonly [number, number], mechanism: string, person: string) => range[0] + (range[1] - range[0]) * random.get(mechanism, person)()
  for (const h of people) needs.set(h.id, sample(fixture.parameters.householdSubsistenceBushelsPerYear, 'demo.life.subsistence', h.id))
  const total = () => [...balances.values()].reduce((a, b) => a + b, 0)
  let opening = total(), harvested = 0
  const unresolved: string[] = []
  return {
    facts(name, act) {
      if (name === 'economy.harvest') return yields.has(act.actor) ? { amount: yields.get(act.actor), unit: 'bushel' } : null
      if (name === 'person.status') return people.find(h => h.id === act.actor)?.status ?? ''
      if (name === 'person.place' || name === 'office.seat') return fixture.place
      if (name === 'actor.office') return fixture.offices.some(o => o.id === act.actor) ? act.actor : ''
      if (name === 'holds.permission') return []
      throw new Error(`Unknown demo read: ${name}`)
    },
    readers: {
      recognition: (person, actor, domain) => domain === config.domain && [config.institution, config.backingActor].includes(actor) ? beliefs.get(person) ?? null : null,
      weight: person => config.households[person].weight,
      capacity: person => config.households[person].capacity,
      agents: actor => actor === config.backingActor ? [...config.agents] : [],
    },
    begin(day) {
      opening = total(); harvested = 0; paid.clear(); yields.clear(); unresolved.length = 0
      if (day.harvest) for (const h of people) {
        const amount = sample(fixture.parameters.grainYieldBushelsPerAcre, 'demo.economy.harvest', h.id)
          * config.households[h.id].acres * (day.shock ? config.shockMultiplier : 1)
        yields.set(h.id, amount); harvested += amount
        balances.set(h.id, balances.get(h.id)! + amount)
      }
      return { provider: 'economy.harvest (stub)', treatment: day.shock ? 'scripted year-3 input shock' : null,
        multiplier: day.shock ? config.shockMultiplier : 1, note: config.note,
        harvests: [...yields].map(([id, amount]) => ({ id, amount, unit: 'bushel' })) }
    },
    choosePayments: rows => rows.filter(row => row.owed !== null && row.unit !== null).map(row => ({
      law: row.law, payer: row.payer, day: row.day, unit: row.unit!, owner: 'economy', from: row.payer,
      amount: config.choosePayment(row, balances.get(row.payer)!, random.get('demo.cognition.payment', row.payer)),
    })),
    collect(commands, rows) {
      for (const command of commands) {
        const row = rows.find(r => r.law === command.law && r.payer === command.payer)!
        if (command.owner !== 'economy' || command.unit !== 'bushel' || command.from !== command.payer || command.to !== treasury) throw new Error('Unsupported stub collection command')
        const amount = row.collector && authority.may(row.collector, 'levy', row.payer, row.day)
          ? Math.min(balances.get(command.from)!, command.amount) : 0
        balances.set(command.from, balances.get(command.from)! - amount)
        balances.set(command.to, balances.get(command.to)! + amount)
        paid.set(command.payer, amount)
      }
      return rows.map(row => ({ law: row.law, payer: row.payer, day: row.day, unit: row.unit ?? '',
        paid: row.owed === null ? null : paid.get(row.payer) ?? 0 }))
    },
    acts: day => config.acts(day, random.get('demo.cognition.acts')),
    present: (breach, procedure) => config.present(breach, procedure, random.get('demo.cognition.presentment', breach.act.actor)),
    execute(command) {
      // No invented fine amount, seizure title, recipient, or success. The next
      // host can replace this port when those parameters/outcomes are supplied.
      unresolved.push(`${command.owner}:${command.type}: execution details not supplied`)
      return null
    },
    observe(day, assessments, courts) {
      return people.filter(h => assessments.some(a => a.payer === h.id) || courts.some(c => c.stages.some(v => v.known_to.includes(h.id))))
        .map(h => {
          const before = beliefs.get(h.id)!
          const observed = courts.filter(c => c.stages.some(v => v.known_to.includes(h.id)))
          const update = config.updateBelief({ person: h.id, day: day.day, before, harvest: yields.get(h.id) ?? 0,
            paid: paid.get(h.id) ?? 0, grain: balances.get(h.id)!, annualNeed: needs.get(h.id)!, courts: observed })
          if (!update.cause.trim() || (update.belief !== null && (!nonnegative(update.belief) || update.belief > 1))) throw new Error('Invalid attributed belief update')
          beliefs.set(h.id, update.belief)
          return { person: h.id, before, after: update.belief, cause: update.cause }
        })
    },
    end(day): StubOwnerSnapshot {
      let consumed = 0
      for (const h of people) {
        const amount = Math.min(balances.get(h.id)!, needs.get(h.id)! / day.yearLength)
        consumed += amount; balances.set(h.id, balances.get(h.id)! - amount)
      }
      return { grain: { opening, harvested, consumed, closing: total() }, coinsMoved: 0,
        balances: [...balances].sort(([a], [b]) => compare(a, b)).map(([id, amount]) => ({ id, amount })),
        unresolved: [...unresolved, ...(fixture.variant === 'B' ? ['Granary quantity/deadline/remedy unspecified; no relief inferred'] : [])] }
    },
  }
}
