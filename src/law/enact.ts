import { deJure } from '../authority/distribution.ts'
import type { ActFacts } from './evaluate.ts'
import type { Law, LawId } from './schema.ts'

// Distribute Omit across the modality union to retain the empower power field.
type WithoutEnactment<T = Law> = T extends Law ? Omit<T, 'enactment'> : never
export type LawDraft = WithoutEnactment & {
  /** Place of enactment; regulated.action is the draft's action domain. */
  place: string
  /** Optional subject for grants restricted by their object predicate. */
  subject?: string | null
}
export type EnactmentOutcome = { kind: 'decree' }
  | { kind: 'body'; quorate: boolean; adopted: boolean }
export type EnactmentResult =
  | { law: null; failure: 'not-quorate' | 'not-adopted' }
  | { law: Law; failure: null; recognised: boolean; ineffective: LawId[] }

/** Record the host's procedural outcome without choosing votes or obedience.
 * day is the enactment day; the draft retains its stated effective dates/status.
 * Recognition is a read of existing laws, never of the new law itself. The host
 * owns persistence; neither the draft nor the supplied law set is changed.
 */
export function enact(laws: readonly Law[], draft: LawDraft, outcome: EnactmentOutcome,
  eventId: string, day: number, facts: ActFacts): EnactmentResult {
  if (outcome.kind === 'body') {
    if (!outcome.quorate) return { law: null, failure: 'not-quorate' }
    if (!outcome.adopted) return { law: null, failure: 'not-adopted' }
  }
  if (!eventId.trim()) throw new Error('Enactment event id must be non-empty')
  if (!Number.isFinite(day)) throw new Error('Enactment day must be finite')
  const { place, subject = null, ...fields } = draft
  const recognised = draft.issuer !== null && deJure(laws, draft.issuer, 'legislate',
    { id: subject, place }, day, facts, draft.regulated.action) === 1
  const law: Law = structuredClone({ ...fields, enactment: eventId })
  // Match the evaluator's authority/issuer boundary; keep supersedes as written.
  const ineffective = [...new Set(laws.filter(previous => law.supersedes.includes(previous.id)
    && (law.jurisdiction.authority === null || previous.jurisdiction.authority === null
      || law.jurisdiction.authority !== previous.jurisdiction.authority
      || law.issuer !== previous.issuer)).map(previous => previous.id))].sort()
  return { law, failure: null, recognised, ineffective }
}
