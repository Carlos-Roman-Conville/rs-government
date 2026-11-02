import type { Law } from '../law/schema.ts'
import type { ContestMode } from './schema.ts'
import type { SuccessionClaimant, SuccessionHost } from './succession.ts'

export interface ContestReads {
  choice?: SuccessionHost['choice']
  /** Bound by the host to the outgoing holder, office, place and query day. */
  read: (name: 'treaty.recognised-heir' | 'contest.victor') => unknown
}
export type ContestSettlement =
  | { status: 'settled'; claimant: SuccessionClaimant; via: ContestMode }
  | { status: 'open'; claimants: SuccessionClaimant[]; mode: ContestMode }
  | { status: 'unresolved'; reason: string }

/** Consume an external ending, never simulate a judgment, treaty or battle. (5330) */
export function settleContest(law: Law, claimants: readonly SuccessionClaimant[], reads: ContestReads): ContestSettlement {
  const unresolved = (reason: string): ContestSettlement => ({ status: 'unresolved', reason })
  const contest = law.succession?.contest
  if (contest == null) return unresolved(`contest not stated: ${law.id}`)
  const { mode } = contest
  const rivals = structuredClone([...claimants]).sort((a, b) =>
    a.person < b.person ? -1 : a.person > b.person ? 1 : a.law < b.law ? -1 : a.law > b.law ? 1 : 0)
  const open = (): ContestSettlement => ({ status: 'open', claimants: rivals, mode })
  let person: string
  if (mode === 'arbitration') {
    const judgment = reads.choice?.(law)
    if (judgment == null) return unresolved(`host arbitration choice not supplied: ${law.id}`)
    if (!Array.isArray(judgment) || !judgment.every(id => typeof id === 'string' && id.trim())) {
      throw new Error('arbitration choice: expected person IDs or null')
    }
    const people = [...new Set<string>(judgment)]
    if (!people.length) return open()
    if (people.some(id => !rivals.some(claimant => claimant.person === id))) {
      return unresolved(`arbitration choice is not a claimant: ${people.filter(id => !rivals.some(c => c.person === id)).sort().join(', ')}`)
    }
    if (people.length > 1) return open()
    person = people[0]
  } else {
    const name = mode === 'treaty' ? 'treaty.recognised-heir' : 'contest.victor'
    const value = reads.read(name)
    if (value == null) return mode === 'force' ? open() : unresolved(`missing ${name}: ${law.id}`)
    if (mode === 'treaty' && value === '') return open()
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}: expected person ID or null`)
    person = value
  }
  const claimant = rivals.find(claimant => claimant.person === person)
  if (!claimant) return unresolved(`${mode} choice is not a claimant: ${person}`)
  return { status: 'settled', claimant, via: mode }
}
