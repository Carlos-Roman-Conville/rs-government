import type { HarvestTraceDay } from './legitimacy-harvest.ts'

/** Stub evidence only. Pre-shock revenue/breaches use the preceding harvest deadline. */
export function summarizeHarvest(seed: number, days: readonly HarvestTraceDay[]) {
  const index = days.findIndex(day => day.shock)
  if (index < 1) throw new Error('Expected a shock with a preceding day')
  const pre = days.slice(0, index).filter(day => day.harvest).at(-1)!
  const post = days[index]
  return {
    seed,
    R: { before: days[index - 1].R, after: post.R },
    backing: { before: days[index - 1].backing.C, after: post.backing.C },
    paymentBreaches: { before: pre.breaches.filter(b => b.act.action === 'omit:pay').length,
      after: post.breaches.filter(b => b.act.action === 'omit:pay').length },
    paidGrain: { before: pre.payments.reduce((sum, p) => sum + (p.paid ?? 0), 0),
      after: post.payments.reduce((sum, p) => sum + (p.paid ?? 0), 0) },
    breachingHouseholds: [...new Set(days.flatMap(day => day.breaches
      .filter(b => b.act.action === 'omit:pay').map(b => b.act.actor)))].sort(),
  }
}

/** Replay command debits/credits independently against the stub's daily account snapshots.
 * Needs are observations from the unchanged host belief callback, not new parameters.
 */
export function harvestLedgerDay(day: HarvestTraceDay, opening: ReadonlyMap<string, number>,
  annualNeeds: ReadonlyMap<string, number>) {
  const balances = new Map(opening)
  const input = day.input as { harvests: { id: string; amount: number }[] }
  for (const harvest of input.harvests) balances.set(harvest.id, balances.get(harvest.id)! + harvest.amount)
  let coins = 0
  for (const command of day.commands) {
    if (command.owner === 'economy' && command.type === 'transfer') {
      balances.set(command.from, balances.get(command.from)! - command.amount)
      balances.set(command.to, balances.get(command.to)! + command.amount)
    } else if (command.owner === 'settlement' && command.type === 'pay' && command.amount !== null) {
      coins += command.amount
    }
  }
  let consumed = 0
  for (const [id, need] of annualNeeds) {
    const amount = Math.min(balances.get(id)!, need / day.yearLength)
    consumed += amount
    balances.set(id, balances.get(id)! - amount)
  }
  return { balances, consumed, coins,
    harvested: input.harvests.reduce((sum, h) => sum + h.amount, 0) }
}
