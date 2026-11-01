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

/** Bilateral scope is part of jurisdiction identity, regardless of party order. */
export function sameLawAuthority(a: Law, b: Law): boolean {
  return a.jurisdiction.authority !== null && b.jurisdiction.authority !== null
    && a.issuer === b.issuer && a.jurisdiction.authority === b.jurisdiction.authority
    && JSON.stringify([...(a.jurisdiction.authorities ?? [])].sort())
      === JSON.stringify([...(b.jurisdiction.authorities ?? [])].sort())
}

/** From is inclusive, until exclusive, and null bounds are unbounded. */
export function lawInForce(law: Law, day: number): boolean {
  return law.status === 'in-force'
    && (law.jurisdiction.from === null || law.jurisdiction.from <= day)
    && (law.jurisdiction.until === null || law.jurisdiction.until > day)
}

/** Temporal force and same-issuer/same-jurisdiction supersession, without an act. */
export function inForceLaws(laws: readonly Law[], day: number): Law[] {
  const active = laws.filter(law => lawInForce(law, day))
  return active.filter(law => !active.some(replacement => replacement.id !== law.id
    && sameLawAuthority(replacement, law)
    && replacement.supersedes.includes(law.id)))
    .sort(byId)
}

/** Jurisdiction only: every authority remains visible, including conflicting rules. */
export function applicableLaws(laws: readonly Law[], act: Act, facts: ActFacts): Map<string, Law[]> {
  const covered = inForceLaws(laws, act.day)
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
  return [...applicableLaws(laws, act, facts).values()].flat().sort(byId)
    .filter(law => (law.modality === 'prohibit' && law.regulated.action === act.action)
      || (law.modality === 'require' && `omit:${law.regulated.action}` === act.action))
    .filter(law => lawConditionsHold(law, act, facts))
    .map(law => ({
      law: law.id, act: { ...act }, stage: 'breach', known_to: [], reason: null,
      sanction: law.consequence.kind === 'sanctions'
        ? law.consequence.sanctions.map(item => ({ ...item })) : null,
    }))
}

/** Shared object/condition/exception matching after jurisdiction and action selection. */
export function lawConditionsHold(law: Law, act: Act, facts: ActFacts): boolean {
  const read = (name: string) => facts(name, act)
  return (law.regulated.object === 'any' || evaluatePredicate(law.regulated.object, read))
    && evaluatePredicate(law.condition, read)
    && !law.exceptions.some(exception => evaluatePredicate(exception.condition, read))
}
