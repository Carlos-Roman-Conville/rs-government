import { evaluatePredicate } from './predicate.ts'
import type { Law } from './schema.ts'
import type { Breach } from './violation.ts'

export interface Act {
  actor: string
  action: string
  object: string | null
  place: string
  day: number
  attempted: boolean
  succeeded: boolean
}

/** The host resolves named owner reads for this act's actor, object and outcome. */
export type ActFacts = (name: string, act: Readonly<Act>) => unknown

const byId = (a: Law, b: Law) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Jurisdiction only: every authority remains visible, including conflicting rules. */
export function applicableLaws(laws: readonly Law[], act: Act, facts: ActFacts): Map<string, Law[]> {
  const active = laws.filter(law => law.status === 'in-force'
    && (law.jurisdiction.from === null || law.jurisdiction.from <= act.day)
    && (law.jurisdiction.until === null || law.jurisdiction.until > act.day))
  const covered = active.filter(law => !active.some(replacement => replacement.id !== law.id
    && law.jurisdiction.authority !== null
    && replacement.jurisdiction.authority !== null
    && replacement.issuer === law.issuer
    && replacement.jurisdiction.authority === law.jurisdiction.authority
    && replacement.supersedes.includes(law.id)))
    .filter(law => (law.jurisdiction.places === 'all' || law.jurisdiction.places.includes(act.place))
      && (law.jurisdiction.persons === 'all'
        || evaluatePredicate(law.jurisdiction.persons, name => facts(name, act))))
    .sort(byId)
  const groups = new Map<string, Law[]>()
  const groupKey = (law: Law) => law.jurisdiction.authority ?? `unstated:${law.id}`
  for (const authority of [...new Set(covered.map(groupKey))].sort()) {
    groups.set(authority, covered.filter(law => groupKey(law) === authority))
  }
  return groups
}

/** Objective breaches; the host attaches kernel record IDs with createViolation. */
export function evaluateAct(laws: readonly Law[], act: Act, facts: ActFacts): Breach[] {
  const read = (name: string) => facts(name, act)
  return [...applicableLaws(laws, act, facts).values()].flat().sort(byId)
    .filter(law => (law.modality === 'prohibit' && law.regulated.action === act.action)
      || (law.modality === 'require' && `omit:${law.regulated.action}` === act.action))
    .filter(law => (law.regulated.object === 'any' || evaluatePredicate(law.regulated.object, read))
      && evaluatePredicate(law.condition, read)
      && !law.exceptions.some(exception => evaluatePredicate(exception.condition, read)))
    .map(law => ({
      law: law.id, act: { ...act }, stage: 'breach', known_to: [], reason: null,
      sanction: law.consequence.kind === 'sanctions'
        ? law.consequence.sanctions.map(item => ({ ...item })) : null,
    }))
}
