import { applicableLaws } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { evaluatePredicate } from '../law/predicate.ts'
import type { Law, LawId, SuccessionRule } from '../law/schema.ts'

/** A query snapshot supplied by Settlement's host; never retained or changed. */
export interface SuccessionOffice { id: string; place: string }
export interface SuccessionClaimant { person: string; law: LawId; basis: SuccessionRule }
export interface UnresolvedSuccession { kind: 'unresolved'; reason: string }
export type SuccessionClaimants =
  | { kind: 'claimants'; claimants: SuccessionClaimant[] }
  | UnresolvedSuccession
export type SuccessionResolution = UnresolvedSuccession
  | { kind: 'contested'; office: string; claimants: SuccessionClaimant[] }
  | { type: 'government.succession_event'; office: string; successor: string; basis: SuccessionRule; law: LawId }
  | { type: 'settlement.vacate'; office: string }
export interface SuccessionHost {
  recognises: (law: Law) => boolean | null
  /** Appointment/election outcomes, by law: [] confirms none; null means unknown.
   * Several IDs preserve a disputed outcome. The host checks the named superior/body.
   */
  choice?: (law: Law) => readonly string[] | null
}

const unresolved = (reason: string): UnresolvedSuccession => ({ kind: 'unresolved', reason })
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const isId = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

function successionLaws(laws: readonly Law[], office: SuccessionOffice, holder: string,
  day: number, facts: ActFacts): Law[] {
  if (!Number.isFinite(day)) throw new Error('Succession day must be finite')
  const act: Act = { actor: holder, action: 'succeed', object: office.id, place: office.place,
    day, attempted: false, succeeded: false }
  const read = (name: string) => facts(name, act)
  return [...applicableLaws(laws, act, facts).values()].flat()
    .filter(law => law.modality === 'establish' && law.regulated.action === 'succeed'
      && law.regulated.object !== 'any' && evaluatePredicate(law.regulated.object, read)
      && evaluatePredicate(law.condition, read)
      && !law.exceptions.some(exception => evaluatePredicate(exception.condition, read)))
    .sort((a, b) => compare(a.id, b.id))
}

function collect(laws: readonly Law[], office: SuccessionOffice, holder: string, day: number,
  facts: ActFacts, choice?: SuccessionHost['choice']): SuccessionClaimants {
  if (!laws.length) return unresolved('no applicable succession law')
  const claimants: SuccessionClaimant[] = []
  const read = (name: string, person: string) => facts(name, {
    actor: holder, action: 'succeed', object: person, place: office.place,
    day, attempted: false, succeeded: false,
  })
  for (const law of laws) {
    const basis = law.succession
    if (!basis) return unresolved(`succession rule not stated: ${law.id}`)
    let people: readonly string[]
    if (basis.rule === 'primogeniture') {
      if (basis.prefer === undefined) return unresolved(`primogeniture preference not stated: ${law.id}`)
      const children = read('kin.children', holder)
      if (children == null) return unresolved(`missing kin.children: ${holder}`)
      if (!Array.isArray(children) || !children.every(isId)) throw new Error('kin.children: expected child IDs or null')
      const living: { person: string; born: number; preferred: boolean }[] = []
      for (const person of [...new Set<string>(children)].sort()) {
        const alive = read('person.alive', person)
        if (alive == null) return unresolved(`missing person.alive: ${person}`)
        if (typeof alive !== 'boolean') throw new Error('person.alive: expected boolean or null')
        if (!alive) continue
        const born = read('person.born', person)
        if (born == null) return unresolved(`missing person.born: ${person}`)
        if (typeof born !== 'number' || !Number.isFinite(born) || born > day) {
          throw new Error('person.born: expected a finite birth day no later than the query day')
        }
        const sex = basis.prefer === 'male' ? read('person.sex', person) : null
        if (basis.prefer === 'male' && sex == null) return unresolved(`missing person.sex: ${person}`)
        if (basis.prefer === 'male' && !isId(sex)) throw new Error('person.sex: expected a non-empty string or null')
        living.push({ person, born, preferred: basis.prefer === 'male' && sex === 'male' })
      }
      if (!living.length) return unresolved('no direct heir: representation and collateral heirs not built')
      const pool = living.some(child => child.preferred) ? living.filter(child => child.preferred) : living
      const oldest = Math.min(...pool.map(child => child.born))
      // Equal birth dates remain rival claims; ID order never invents seniority.
      people = pool.filter(child => child.born === oldest).map(child => child.person)
    } else if (basis.rule === 'appointment' || basis.rule === 'election') {
      const selected = choice?.(law)
      if (selected == null) return unresolved(`host ${basis.rule} choice not supplied: ${law.id}`)
      if (!Array.isArray(selected) || !selected.every(isId)) throw new Error('succession choice: expected person IDs or null')
      people = selected
    } else {
      return unresolved('open contest requires negotiation, procedure or force; resolution not built')
    }
    for (const person of [...new Set(people)].sort()) claimants.push({ person, law: law.id, basis: { ...basis } })
  }
  return { kind: 'claimants', claimants: claimants.sort((a, b) => compare(a.person, b.person) || compare(a.law, b.law)) }
}

/** Direct living children only. Appointment/election await resolveSuccession's
 * host choice; missing rules/facts and unbuilt contests never imply vacancy.
 * Predicate reads use object=office; kin/person reads use object=person.
 */
export function successionClaimants(laws: readonly Law[], office: SuccessionOffice, holder: string,
  day: number, facts: ActFacts): SuccessionClaimants {
  return collect(successionLaws(laws, office, holder, day, facts), office, holder, day, facts)
}

/** Pure decision: the host maps succession_event to Settlement appoint and
 * settlement.vacate to vacate. No owner commands are executed here.
 * Unknown recognition blocks a decision; known rejection or distinct rival
 * persons produces a contest. Multiple bases for one person are not rivals;
 * the first law by ID supplies the event's basis when all laws are recognised.
 */
export function resolveSuccession(laws: readonly Law[], office: SuccessionOffice, holder: string,
  day: number, facts: ActFacts, host: SuccessionHost): SuccessionResolution {
  const applicable = successionLaws(laws, office, holder, day, facts)
  const result = collect(applicable, office, holder, day, facts, host.choice)
  if (result.kind === 'unresolved') return result
  const recognition = applicable.map(law => host.recognises(law))
  if (recognition.some(value => value === null)) return unresolved('recognition not supplied')
  if (recognition.some(value => typeof value !== 'boolean')) throw new Error('recognises: expected boolean or null')
  const { claimants } = result
  if (recognition.includes(false) || new Set(claimants.map(claimant => claimant.person)).size > 1) {
    return { kind: 'contested', office: office.id, claimants }
  }
  if (!claimants.length) return { type: 'settlement.vacate', office: office.id }
  const claimant = [...claimants].sort((a, b) => compare(a.law, b.law))[0]
  return { type: 'government.succession_event', office: office.id, successor: claimant.person,
    basis: { ...claimant.basis }, law: claimant.law }
}
