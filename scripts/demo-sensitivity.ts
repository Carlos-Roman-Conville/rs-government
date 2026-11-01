import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeHarvest } from '../src/demo/acceptance.ts'
import { loadManorFixture } from '../src/demo/fixture.ts'
import type { DemoVariant } from '../src/demo/fixture.ts'
import { createHarvestStubs, runLegitimacyHarvest } from '../src/demo/legitimacy-harvest.ts'
import type { HarvestStubParameters, StubOwnerSnapshot } from '../src/demo/legitimacy-harvest.ts'
import { loadProcedures } from '../src/law/procedure.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
export const seeds = [42, 43] as const
type Label = 'stub (unsourced)' | `sourced (${string})`
interface Input { value: number; label: Label }
export interface SensitivitySetting {
  shockMultiplier: Input
  granaryGrain: Input
  householdGrain: Input
}

function sourceValue(sources: string, slug: string): string {
  const section = sources.split(/^## /m).find(section => section.split(/\r?\n/)[0].trim() === slug)
  const value = section?.match(/^- Value: (.+)$/m)?.[1].trim()
  if (!value) throw new Error(`Missing Value in SOURCES.md#${slug}`)
  return value
}

/** Read only the recorded Value, never dates, percentages, or numbers from source notes. */
export function sensitivityGrid(sources: string): SensitivitySetting[] {
  const harvest = sourceValue(sources, 'harvest-loss-1315')
  const stores = sourceValue(sources, 'peasant-grain-stores')
  const stub = (value: number): Input => ({ value, label: 'stub (unsourced)' })
  const shocks: Input[] = [stub(0.1)]
  if (harvest !== 'null') {
    // The present Value reports retained yield fractions (including range ends), not loss fractions.
    // Fail closed if research switches units rather than treating percentages as multipliers.
    const fractions = [...new Set([...harvest.matchAll(/\b0\.\d+\b/g)].map(match => Number(match[0])))]
    if (!harvest.includes('fraction') || !fractions.length || fractions.some(value => value <= 0 || value >= 1)) {
      throw new Error('Review harvest-loss-1315 units before extending the grid')
    }
    shocks.push(...fractions.map(value => ({ value, label: 'sourced (harvest-loss-1315)' as const })))
  }
  // No sourced stock quantity exists. Do not convert subsistence or seed return into a stock.
  if (stores !== 'null') throw new Error('Review newly sourced peasant-grain-stores units and household/granary scope before extending the grid')
  return shocks.map(shockMultiplier => ({ shockMultiplier, granaryGrain: stub(0), householdGrain: stub(0) }))
}

/** Same host as demo-acceptance.test.ts; only the explicitly labelled input settings vary. */
export function runSensitivitySetting(setting: SensitivitySetting, seed: number) {
  const fixtures = { A: loadManorFixture(root, 'A'), B: loadManorFixture(root, 'B') }
  const first = fixtures.A.households[0].id
  const parameters: HarvestStubParameters = {
    note: `Sensitivity host modelling choices: five 365-day years, harvest day 0, five acres; pay available grain; unchanged 3087 post-levy food-adequacy belief stub. Not validation. Inputs: ${JSON.stringify(setting)}`,
    institution: 'authority.manor-court', domain: 'levy', backingActor: 'office.beadle',
    agents: [first], granaryGrain: setting.granaryGrain.value, shockMultiplier: setting.shockMultiplier.value,
    households: Object.fromEntries(fixtures.A.households.map(h => [h.id,
      { acres: 5, grain: setting.householdGrain.value, belief: 1, weight: 1, capacity: 1 }])),
    choosePayment: (row, available) => Math.min(row.owed!, available),
    updateBelief: experience => ({ belief: Math.min(1, experience.grain / experience.annualNeed),
      cause: `Cognition stub: post-levy grain ${experience.grain} / annual subsistence ${experience.annualNeed}; paid ${experience.paid} attributed to court` }),
    acts: day => day.shock ? [{ actor: first, action: 'steal', object: 'inventory.lord-granary',
      place: fixtures.A.place, day: day.day, attempted: true, succeeded: true }] : [],
    present: (_breach, procedure) => ({ witnesses: procedure ? [first] : [], present: procedure !== null }),
  }
  const traces = runLegitimacyHarvest({ seed, startDay: 0,
    yearLengths: [365, 365, 365, 365, 365], harvestDays: [0, 0, 0, 0, 0],
    institution: parameters.institution, domain: parameters.domain, backingActor: parameters.backingActor,
    fixtures, procedures: loadProcedures(root).procedures,
    providers: (fixture, random) => createHarvestStubs(fixture, random, parameters) })
  return (['A', 'B'] as const).map(variant => {
    const days = traces[variant], post = days.find(day => day.shock)!
    const before = days[days.indexOf(post) - 1]
    const priorUpdate = days.slice(0, days.indexOf(post)).filter(day => day.beliefUpdates.length).at(-1)!
    const treasury = fixtures[variant].laws.find(law => law.tax)!.tax!.treasury
    const grain = (snapshot: StubOwnerSnapshot) => ({
      households: snapshot.balances.filter(balance => balance.id !== treasury).reduce((sum, balance) => sum + balance.amount, 0),
      granary: snapshot.balances.find(balance => balance.id === treasury)!.amount,
    })
    return { setting, variant, ...summarizeHarvest(seed, days),
      grain: { before: grain(before.owners as StubOwnerSnapshot), after: grain(post.owners as StubOwnerSnapshot) },
      evidence: { preDay: priorUpdate.day, postDay: post.day,
        before: priorUpdate.beliefUpdates.find(update => update.person === first)!,
        after: post.beliefUpdates.find(update => update.person === first)!,
        fallingBeliefs: post.beliefUpdates.filter(update => update.after !== null && update.before !== null && update.after < update.before).length,
        unresolved: (post.owners as StubOwnerSnapshot).unresolved },
    }
  })
}

export type SensitivityRow = ReturnType<typeof runSensitivitySetting>[number]
export function runSensitivityGrid(sources: string): SensitivityRow[] {
  return sensitivityGrid(sources).flatMap(setting => seeds.flatMap(seed => runSensitivitySetting(setting, seed)))
}

const number = (value: number | null) => value === null ? 'null' : value.toFixed(6)
const pair = (values: { before: number | null; after: number | null }) => `${number(values.before)} → ${number(values.after)}`
const input = (name: string, value: Input) => `${name} = ${value.value}: ${value.label}`

export function renderSensitivity(sources: string, rows: readonly SensitivityRow[]): string {
  const lines = ['# Harvest host sensitivity (GOV-16)', '',
    'Reproduce with `npx --yes --cache .codex-runs/npm-cache tsx scripts/demo-sensitivity.ts` (tsx is needed because the kernel dependency ships TypeScript). Five years daily, variants A/B, seeds 42/43. Stub-provider evidence only, not engine or historical validation. No laws, belief rule, payment rule, acres, or other host settings were tuned.', '',
    '## Inputs and measurements', '',
    `Recorded [harvest-loss-1315](SOURCES.md#harvest-loss-1315) Value: ${sourceValue(sources, 'harvest-loss-1315')}`, '',
    'The sourced multipliers retain that fraction of normal harvest; 0.1 is the unsourced 90% loss baseline. The sourced figures are rounded national summaries from secondary accounts of Campbell, not manor-specific measurements. Each is applied separately to the single year-3 shock, not as a consecutive 1315–17 sequence.', '',
    `Recorded [peasant-grain-stores](SOURCES.md#peasant-grain-stores) Value: ${sourceValue(sources, 'peasant-grain-stores')}. Only zero initial household stores and zero initial granary grain are tested; neither is sourced. Stocks can accumulate during the run. No sourced storage conclusion is available.`, '',
    'R and backing C are read on days 729 → 730 (immediately before → on the shock). Payment breaches and paid grain compare harvest deadlines 365 → 730. Grain columns are household totals and lord-granary balances at day end, after daily consumption, on days 729 → 730; all grain is in bushels. R and C are computed reads, not stored meters. Backing uses the same single stub agent as the existing demo.', '',
    'Other unchanged unsourced host choices: five 365-day years, harvest day 0, five acres per household, initial belief/weight/capacity 1, pay available grain, one scripted observed theft on the shock day, and the food-adequacy Cognition callback. Yield and annual need use the fixture ranges; uniform sampling remains a modelling stand-in.', '']
  for (const setting of sensitivityGrid(sources)) {
    const group = rows.filter(row => JSON.stringify(row.setting) === JSON.stringify(setting))
    lines.push(`## shockMultiplier ${setting.shockMultiplier.value}`, '',
      [input('shockMultiplier', setting.shockMultiplier), input('granaryGrain', setting.granaryGrain), input('household initial grain', setting.householdGrain)].join('; '), '',
      '| Variant | Seed | Pre-shock R | Post-shock R | Payment breaches (pre → post) | Backing C (pre → post) | Paid grain (pre → post) | Household grain (pre → post) | Granary grain (pre → post) |',
      '|---|---|---|---|---|---|---|---|---|')
    for (const row of group) lines.push(`| ${row.variant} | ${row.seed} | ${number(row.R.before)} | ${number(row.R.after)} | ${row.paymentBreaches.before} → ${row.paymentBreaches.after} | ${pair(row.backing)} | ${pair(row.paidGrain)} | ${pair({ before: row.grain.before.households, after: row.grain.after.households })} | ${pair({ before: row.grain.before.granary, after: row.grain.after.granary })} |`)
    lines.push('')
  }
  const sourcedB = rows.filter(row => row.variant === 'B' && row.setting.shockMultiplier.label.startsWith('sourced'))
  const matching = (row: SensitivityRow, variant: DemoVariant) => rows.find(other => other.seed === row.seed && other.variant === variant && JSON.stringify(other.setting) === JSON.stringify(row.setting))!
  const holding = sourcedB.filter(row => row.R.after !== null && row.R.before !== null && row.R.after >= row.R.before)
  const aboveA = sourcedB.filter(row => row.R.after !== null && matching(row, 'A').R.after !== null && row.R.after > matching(row, 'A').R.after!)
  const mildest = sourcedB.filter(row => row.setting.shockMultiplier.value === Math.max(...sourcedB.map(row => row.setting.shockMultiplier.value)))
  const sourcedA = sourcedB.map(row => matching(row, 'A'))
  lines.push('## Verdict', '', sourcedB.length
    ? `B holds or rises relative to its own pre-shock R in ${holding.length}/${sourcedB.length} sourced-harvest runs; it stays strictly above A at the shock in ${aboveA.length}/${sourcedB.length}. ${holding.length === sourcedB.length ? 'All tested sourced harvest inputs preserve B’s pre-shock R.' : 'The sourced harvest inputs do not consistently preserve B’s pre-shock R: the failure remains, though its size depends on harvest severity.'} No tolerance for “near” was invented: the tables give the actual change for assessing §3 item 2. This checks the immediate shock, not a guarantee about all subsequent years.`
    : 'The harvest-loss-1315 Value is null, so only the unsourced stub shock was tested; no sourced-harvest verdict is possible.', '',
    ...(mildest.length ? [`At the mildest sourced shock (multiplier ${mildest[0].setting.shockMultiplier.value}), B’s R is ${mildest.map(row => `seed ${row.seed}: ${pair(row.R)}`).join('; ')}. These are small changes around the pre-shock level, unlike the large declines at the more severe sourced shocks; a strict hold-or-rise count should not be confused with declaring every decrease a collapse.`, '',
      `For A under sourced shocks, payment breaches rise in ${sourcedA.filter(row => row.paymentBreaches.after > row.paymentBreaches.before).length}/${sourcedA.length} runs and paid grain falls in ${sourcedA.filter(row => row.paidGrain.after < row.paidGrain.before).length}/${sourcedA.length}. Thus the full §3 item 1 chain is not reproduced merely by using sourced harvest losses, even though A’s R declines.`, ''] : []),
    'The A–B comparison addresses the requested direction alongside §3 items 1–2, not full acceptance: seizures and real-engine behaviour remain outside this experiment. B’s laws are labelled level-5 counterfactuals (PLATFORM §4): D-demo-1 is proportional rent with dearth remission; D-demo-2 is the lord’s granary duty. Neither is established historical practice by the recorded sources.', '',
    'The mechanism is the unchanged host Cognition callback: it replaces each observed belief with min(1, post-levy household grain / annual subsistence). It does not smooth with the previous belief, and even a fully remitted rent (paid 0) can leave too little food for that ratio to hold. The trace attributes that food adequacy to the court. The granary keeps collected grain, but the provider records “Granary quantity/deadline/remedy unspecified; no relief inferred”; the duty alone sends no grain back to households. Theft/punishment observations do not enter this callback’s formula. Thus a milder shock can reduce the collapse without supplying the missing relief mechanism.', '',
    '## Attributed trace evidence', '',
    'Each entry quotes the recorded cause for the first household (also the backing agent), with the last pre-shock update at day 365 and the shock update at day 730. Falling-belief counts cover all 60 households. These are trace records, not inferred motives.', '')
  for (const row of rows.filter(row => row.variant === 'B')) {
    const evidence = row.evidence
    lines.push(`- B, seed ${row.seed}, multiplier ${row.setting.shockMultiplier.value} (${row.setting.shockMultiplier.label}), ${evidence.after.person}: ${evidence.fallingBeliefs}/60 beliefs fall. Day ${evidence.preDay}, belief ${number(evidence.before.after)}: \`${evidence.before.cause}\`. Day ${evidence.postDay}, belief ${number(evidence.after.before)} → ${number(evidence.after.after)}: \`${evidence.after.cause}\`.`)
  }
  return `${lines.join('\n')}\n`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = readFileSync(new URL('../data/demo/SOURCES.md', import.meta.url), 'utf8')
  const rows = runSensitivityGrid(sources)
  writeFileSync(new URL('../data/demo/SENSITIVITY.md', import.meta.url), renderSensitivity(sources, rows))
  console.info(`Wrote data/demo/SENSITIVITY.md (${rows.length} rows, ${sensitivityGrid(sources).length} settings)`)
}
