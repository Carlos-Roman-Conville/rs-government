// @rex/government: the public surface grows unit by unit (DESIGN §1, §2).
import { qualify } from '@rex/kernel'

export { evaluatePredicate, predicateReads, validatePredicate } from './law/predicate.ts'
export type { Predicate, PredicateFacts, PredicateOperator, PredicateScalar } from './law/predicate.ts'
export { validateLaw, validateLawData } from './law/schema.ts'
export type { CalendarPoint, ToDay } from './law/calendar.ts'
export type { Law, LawData, LawId, LawModality, LawStatus, LawJurisdiction, LawException, Consequence, Sanction, SanctionKind, Citation } from './law/schema.ts'
export { loadLaws, checkLaws } from './law/load.ts'
export type { LoadedLaw, LoadedLaws } from './law/load.ts'
export { applicableLaws, evaluateAct } from './law/evaluate.ts'
export type { Act, ActFacts } from './law/evaluate.ts'
export { createViolation, detect, prosecute, sanction, drop, fail, sanctionCommands } from './law/violation.ts'
export type { Breach, Violation, ViolationStage, SanctionCommand } from './law/violation.ts'
export { deJure, delegationChain, recognition, backing, strongestRival, effectiveAuthority, provisionalF, distribution } from './authority/distribution.ts'
export type { AuthoritySubject, AuthorityClaimants, AuthorityFlag, AuthorityInputs, AuthorityFormula, AuthorityRow } from './authority/distribution.ts'
export type { BeliefReader, WeightReader, CapacityReader, AgentsReader, PopulationReader, AuthorityReaders } from './authority/readers.ts'
export { createAuthorityProvider, defaultAuthorityProvider } from './ports/authority-provider.ts'
export type { AuthorityProvider, OfficeOf } from './ports/authority-provider.ts'

/** The engine prefix every government id carries. */
export const ENGINE = 'government'

/** Qualify a local id such as `law.statute-of-labourers` as `government/law.statute-of-labourers`. */
export function governmentId(local: string): string {
  return qualify(ENGINE, local)
}
