import type { ActFacts } from './evaluate.ts'
import { lawInForce } from './evaluate.ts'
import type { Law, LawId, LawJurisdiction } from './schema.ts'

/** DESIGN §1.7 communication kinds; carry-message is the action spelling. */
export const COMMUNICATION_KINDS = ['speak', 'write', 'print', 'assemble', 'carry-message'] as const
export type CommunicationKind = typeof COMMUNICATION_KINDS[number]

/** Provisional §1.7/§2.2 owner command; Society must confirm the payload contract. */
export interface CommRestrictionCommand {
  owner: 'society'
  type: 'comm_restriction'
  law: LawId
  action: CommunicationKind
  object: Law['regulated']['object']
  places: LawJurisdiction['places']
  from: number | null
  until: number | null
}

/** Emit each temporally in-force communication prohibition/requirement as data.
 * There is no concrete sender/message here: object predicates remain unevaluated,
 * and the law reference retains persons, modality, conditions and exceptions.
 * facts is reserved for the confirmed Society contract; no actor is fabricated.
 * These commands do not decide compliance, detection or communication success.
 */
export function commRestrictions(laws: readonly Law[], day: number, _facts: ActFacts): CommRestrictionCommand[] {
  return laws.filter(law => lawInForce(law, day)
    && (law.modality === 'prohibit' || law.modality === 'require')
    && (COMMUNICATION_KINDS as readonly string[]).includes(law.regulated.action))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(law => ({ owner: 'society', type: 'comm_restriction', law: law.id,
      action: law.regulated.action as CommunicationKind, object: structuredClone(law.regulated.object),
      places: structuredClone(law.jurisdiction.places), from: law.jurisdiction.from, until: law.jurisdiction.until }))
}
