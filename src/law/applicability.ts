import { inForceLaws } from './evaluate.ts'
import type { Act, ActFacts } from './evaluate.ts'
import { and3, or3, not3, evaluatePredicateKleene } from './kleene.ts'
import type { Truth } from './kleene.ts'
import type { Law, LawId } from './schema.ts'
import type { Breach } from './violation.ts'

export interface ActAssessment {
  law: LawId
  authority: string
  result: 'breach' | 'no-breach' | 'unknown'
  reads: string[]
  breach: Breach | null
}
export interface AssessmentOptions {
  /** 'in-force' is a declared scenario assumption, never an inferred start date. */
  unsourcedStart?: 'unknown' | 'in-force'
}

/** Objective legal assessment only; neither permission, observation nor execution. */
export function assessAct(
  laws: readonly Law[], act: Act, facts: ActFacts, options: AssessmentOptions = {},
): ActAssessment[] {
  // Reuse existing temporal exclusions and same-authority supersession exactly.
  const active = new Set(inForceLaws(laws, act.day))
  const read = (name: string) => facts(name, act)
  return laws.filter(law => (law.modality === 'prohibit' && law.regulated.action === act.action)
    || (law.modality === 'require' && `omit:${law.regulated.action}` === act.action))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(law => {
      const stages: (() => Truth)[] = [
        () => !active.has(law) ? or3()
          : law.jurisdiction.from === null && options.unsourcedStart !== 'in-force'
            ? { value: 'unknown', reads: [`law.from:${law.id}`] } : and3(),
        () => law.jurisdiction.places !== 'all' && !law.jurisdiction.places.includes(act.place)
          ? or3() : law.jurisdiction.persons === 'all' ? and3()
            : evaluatePredicateKleene(law.jurisdiction.persons, read),
        () => law.regulated.object === 'any' ? and3() : evaluatePredicateKleene(law.regulated.object, read),
        () => evaluatePredicateKleene(law.condition, read),
        () => {
          let exceptions = or3()
          for (const exception of law.exceptions) {
            exceptions = or3(exceptions, evaluatePredicateKleene(exception.condition, read))
            if (exceptions.value === 'true') break
          }
          return not3(exceptions)
        },
      ]
      let truth = and3()
      for (const stage of stages) {
        truth = and3(truth, stage())
        if (truth.value === 'false') break
      }
      const result = truth.value === 'true' ? 'breach' : truth.value === 'false' ? 'no-breach' : 'unknown'
      return {
        law: law.id, authority: law.jurisdiction.authority ?? `unstated:${law.id}`,
        result, reads: truth.reads,
        breach: result === 'breach' ? {
          law: law.id, act: { ...act }, stage: 'breach', known_to: [], reason: null,
          sanction: law.consequence.kind === 'sanctions'
            ? law.consequence.sanctions.map(item => ({ ...item })) : null,
        } : null,
      }
    })
}

/** Retain every assessment under its authority, without choosing between rivals. */
export function assessByAuthority(rows: readonly ActAssessment[]): Map<string, ActAssessment[]> {
  return new Map([...new Set(rows.map(row => row.authority))].sort()
    .map(authority => [authority, rows.filter(row => row.authority === authority)]))
}
