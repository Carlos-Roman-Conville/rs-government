import { applicableLaws } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import type { Law, TenderPurpose } from '../law/schema.ts'

/** Host-supplied scope: jurisdiction identities are not place IDs. Omit authority
 * to include all competing sets; otherwise use an applicableLaws authority key,
 * including unstated:<law id>. Facts resolve person predicates for this actor.
 */
export interface TenderJurisdiction {
  authority?: string
  actor: string
  place: string
  facts: ActFacts
}

/** Computed on every read; the evaluator owns dates, supersession and coverage. */
export function legalTender(laws: readonly Law[], jurisdiction: TenderJurisdiction,
  day: number, purpose: TenderPurpose): string[] {
  const act: Act = { actor: jurisdiction.actor, place: jurisdiction.place,
    action: 'accept-payment', object: null, day, attempted: false, succeeded: false }
  const groups = applicableLaws(laws, act, jurisdiction.facts)
  const covered = jurisdiction.authority === undefined
    ? [...groups.values()].flat() : groups.get(jurisdiction.authority) ?? []
  return [...new Set(covered.filter(law => law.modality === 'require'
    && law.tender?.purposes.includes(purpose)).flatMap(law => law.tender!.assets))].sort()
}
