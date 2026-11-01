import { applicableLaws, evaluateAct } from './evaluate.ts'
import type { Act, ActFacts } from './evaluate.ts'
import type { Law } from './schema.ts'
import type { Breach } from './violation.ts'

export interface JurisdictionSet {
  /** Includes the evaluator's unstated:<law id> key for unsourced authorities. */
  authority: string
  laws: Law[]
  breaches: Breach[]
}

/** DESIGN §1.6: expose every applicable set; enforcement never chooses a winner here. */
export function jurisdictionSets(laws: readonly Law[], act: Act, facts: ActFacts): JurisdictionSet[] {
  const groups = applicableLaws(laws, act, facts)
  const breaches = evaluateAct(laws, act, facts)
  return [...groups].map(([authority, laws]) => {
    const ids = new Set(laws.map(law => law.id))
    return { authority, laws, breaches: breaches.filter(breach => ids.has(breach.law)) }
  })
}
