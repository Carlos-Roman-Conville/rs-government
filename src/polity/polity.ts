import { delegationApexes, distribution } from '../authority/distribution.ts'
import type { AuthorityClaimants, AuthorityFormula } from '../authority/distribution.ts'
import type { AuthorityReaders } from '../authority/readers.ts'
import { inForceLaws } from '../law/evaluate.ts'
import type { ActFacts } from '../law/evaluate.ts'
import type { Law, LawId } from '../law/schema.ts'

/** The host supplies jurisdiction identities, their current local authorities and
 * domains to inspect; these are not inferred from place IDs or ruler titles.
 */
export interface PolityJurisdiction {
  id: string
  authority: string | null
  domains: readonly string[]
}
export interface PolityFacts {
  jurisdictions: readonly PolityJurisdiction[]
  readers: AuthorityReaders
  actFacts: ActFacts
  formula?: AuthorityFormula
  claimants?: AuthorityClaimants
}
export interface Polity {
  apex: string
  jurisdictions: string[]
  /** Union of winning places, with per-domain/subject evidence in territory. */
  territory: string[]
}
export interface PolityTerritory {
  jurisdiction: string
  place: string
  domain: string
  person: string
  /** All tied maxima; null if any candidate's authority is unknown. */
  apexes: string[] | null
  note: string | null
}
export interface PolitiesRead {
  polities: Polity[]
  unresolved: { jurisdiction: string; apexes: string[]; note: string }[]
  territory: PolityTerritory[]
}

const ids = (values: readonly string[]): string[] => [...new Set(values)].sort()
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0

/** DESIGN §1.14: no stored polity or territory. Delegation supplies the apex;
 * distribution supplies J/R/C/A (including deJure and the swappable §1.2 formula).
 * Authority is per domain/person: no invented averaging rule collapses those
 * relations into one territorial score. A place can consequently appear in more
 * than one polity. Ties retain every apex, including an all-zero tie.
 */
export function polities(laws: readonly Law[], day: number, facts: PolityFacts): PolitiesRead {
  const jurisdictions = [...facts.jurisdictions].sort((a, b) => compare(a.id, b.id))
  if (new Set(jurisdictions.map(j => j.id)).size !== jurisdictions.length) {
    throw new Error('polities: duplicate jurisdiction ID')
  }
  const roots = delegationApexes(laws, jurisdictions.flatMap(j => j.authority === null ? [] : [j.authority]),
    day, facts.actFacts)
  const grouped = new Map<string, Polity>()
  const unresolved: PolitiesRead['unresolved'] = []
  for (const jurisdiction of jurisdictions) {
    const apexes = jurisdiction.authority === null ? [] : roots.get(jurisdiction.authority)!
    if (apexes.length !== 1) {
      unresolved.push({ jurisdiction: jurisdiction.id, apexes: [...apexes],
        note: jurisdiction.authority === null ? 'Authority is unstated.'
          : apexes.length ? 'Empowerment has multiple apexes.' : 'Empowerment cycle has no apex.' })
      continue
    }
    const apex = apexes[0]
    if (!grouped.has(apex)) grouped.set(apex, { apex, jurisdictions: [], territory: [] })
    grouped.get(apex)!.jurisdictions.push(jurisdiction.id)
  }
  const result = [...grouped.values()].sort((a, b) => compare(a.apex, b.apex))
  // Include unresolved local authorities and candidate roots as competitors, so
  // missing polity structure cannot silently hand territory to a resolved rival.
  const candidates = ids([...roots].flatMap(([actor, apexes]) => apexes.length ? apexes : [actor]))
  const territory: PolityTerritory[] = []
  for (const jurisdiction of jurisdictions) {
    for (const domain of ids(jurisdiction.domains)) {
      const competitors = ids([...candidates, ...(facts.claimants?.[domain] ?? [])])
      const rows = distribution(laws, competitors, [domain], jurisdiction.id, day,
        facts.readers, facts.actFacts, facts.formula, facts.claimants)
      for (const person of ids(rows.filter(row => row.domain === domain).map(row => row.person))) {
        const compared = rows.filter(row => row.domain === domain && row.person === person)
        const unknown = compared.some(row => row.A === null)
        const maximum = Math.max(...compared.map(row => row.A ?? -Infinity))
        const apexes = unknown ? null : compared.filter(row => row.A === maximum).map(row => row.actor)
        const place = facts.actFacts('person.place', { actor: competitors[0], action: domain, object: person,
          place: '', day, attempted: false, succeeded: false })
        if (typeof place !== 'string' || !place.trim()) throw new Error('read "person.place": expected a non-empty place ID')
        territory.push({ jurisdiction: jurisdiction.id, place, domain, person, apexes,
          note: unknown ? 'A candidate has unknown effective authority; no maximum is assigned.' : null })
        for (const polity of result) {
          if (polity.jurisdictions.includes(jurisdiction.id) && apexes?.includes(polity.apex)) {
            polity.territory.push(place)
          }
        }
      }
    }
  }
  for (const polity of result) polity.territory = ids(polity.territory)
  return { polities: result, unresolved, territory }
}

export interface Treaty {
  law: LawId
  parties: string[]
  /** Executable obligations, including scope, exceptions and consequences.
   * Feed the original law set to evaluateAct for breaches; no second evaluator.
   */
  obligations: Law
}

/** A treaty is a bilateral law, not a keyword in its action, title or notes.
 * Each party enforces it (or neither does); no world enforcer is introduced.
 */
export function treaties(laws: readonly Law[], day: number): Treaty[] {
  return inForceLaws(laws, day).filter(law => law.jurisdiction.authorities !== undefined)
    .map(law => ({ law: law.id, parties: ids(law.jurisdiction.authorities!), obligations: structuredClone(law) }))
}
