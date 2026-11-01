import { deJure } from '../authority/distribution.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import type { Law } from '../law/schema.ts'

export interface AuthorityProvider {
  may(office: string, power: string, subject: string | null, day: number): boolean
}

/** Resolve an office ID to the identifier used by actor.office grant predicates.
 * Hosts using the same IDs in Settlement and laws can supply the identity function.
 * null means the office is unknown. This resolves identity, never the holder.
 */
export type OfficeOf = (office: string) => string | null

/** Pure reads over host-owned snapshots. Facts receive the office as actor and
 * the subject as object (including null). Location is read as person.place for a
 * subject, or office.seat for null, with action=power and place='' before location
 * is known. Predicate reads then receive the grant's action and resolved place.
 * actor.office is supplied by officeOf; all other reads go to facts. Neither
 * callback may mutate state. Missing locations throw, as missing predicates do.
 */
export function createAuthorityProvider(laws: readonly Law[], facts: ActFacts,
  officeOf: OfficeOf): AuthorityProvider {
  return {
    may(office, power, subject, day) {
      const grantOffice = officeOf(office)
      if (grantOffice === null) return false
      const reads: ActFacts = (name, act) => name === 'actor.office' ? grantOffice : facts(name, act)
      const act: Act = { actor: office, action: power, object: subject, place: '', day,
        attempted: false, succeeded: false }
      const location = subject === null ? 'office.seat' : 'person.place'
      const place = facts(location, act)
      if (typeof place !== 'string' || !place.trim()) {
        throw new Error(`read ${JSON.stringify(location)}: expected a non-empty place ID`)
      }
      // deJure uses applicableLaws on the entire law set, including replacements.
      return deJure(laws, office, power, { id: subject, place }, day, reads) === 1
    },
  }
}

/** Settlement's setup rule; vacancy and holder checks belong to Settlement. */
export function defaultAuthorityProvider(
  offices: readonly { readonly id: string; readonly powers: readonly string[] }[],
): AuthorityProvider {
  return {
    may(office, power) {
      return offices.find(entry => entry.id === office)?.powers.includes(power) ?? false
    },
  }
}
