import { evaluateAct, inForceLaws } from '../law/evaluate.ts'
import type { Law, TenderPurpose } from '../law/schema.ts'
import type { Breach } from '../law/violation.ts'
import { legalTender } from './legal-tender.ts'
import type { TenderJurisdiction } from './legal-tender.ts'

/** Structural projection of Economy's outcome; no cross-engine import. Currency
 * names the offered asset. Missing identity or purpose cannot establish a breach.
 */
export interface RefusalOutcome {
  type: 'shared.action.outcome'
  status: 'completed' | 'failed'
  payload: {
    type: string
    reason?: string
    refusedBy?: string | null
    currency?: string | null
    purpose?: TenderPurpose | null
  }
}

/** The host supplies the outcome day and resolves jurisdiction to a real place.
 * The obligated actor comes only from refusedBy, never from the payer or market.
 */
export interface RefusalContext extends Omit<TenderJurisdiction, 'actor'> { day: number }

/** Objective breaches only. Hosts assign IDs with createViolation and carry out
 * detection, prosecution and the law's consequence through the existing chain.
 */
export function refusalBreaches(laws: readonly Law[], outcome: RefusalOutcome,
  context: RefusalContext): Breach[] {
  const { payload } = outcome
  if (outcome.type !== 'shared.action.outcome' || outcome.status !== 'failed'
    || payload.type !== 'refused' || payload.reason !== 'not-accepted'
    || (payload.purpose !== 'tax' && payload.purpose !== 'debt')
    || !payload.refusedBy?.trim() || !payload.currency?.trim()) return []
  const { refusedBy: actor, currency: asset, purpose } = payload
  const { day, place, authority, facts } = context
  if (!Number.isFinite(day)) throw new Error('Refusal day must be finite')
  if (!place.trim()) throw new Error('Refusal requires a host-resolved place')
  if (!legalTender(laws, { actor, place, authority, facts }, day, purpose).includes(asset)) return []

  // Resolve supersession on the full law set before selecting tender obligations:
  // a replacement need not itself be a tender law. Keep rival sets separate.
  const obligations = inForceLaws(laws, day).filter(law => law.modality === 'require'
    && law.regulated.action === 'accept-payment'
    && law.tender?.purposes.includes(purpose) && law.tender.assets.includes(asset)
    && (authority === undefined || authority === (law.jurisdiction.authority ?? `unstated:${law.id}`)))
  return evaluateAct(obligations, { actor, object: asset, action: 'omit:accept-payment',
    place, day, attempted: false, succeeded: false }, facts)
}
