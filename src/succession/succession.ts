import { applicableLaws } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import { evaluatePredicate } from '../law/predicate.ts'
import type { Law, LawId, SuccessionRule } from '../law/schema.ts'

/** A query snapshot supplied by Settlement's host; never retained or changed. */
export interface SuccessionOffice { id: string; place: string }
export interface SuccessionClaimant {
  person: string; law: LawId; basis: SuccessionRule
  through?: string[]
  coparcener?: true
}
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
  /** Recorded choices, by law: [] confirms none; null means unknown.
   * Several IDs preserve a disputed outcome. The host checks the named superior/body.
   */
  choice?: (law: Law) => readonly string[] | null
}

const unresolved = (reason: string): UnresolvedSuccession => ({ kind: 'unresolved', reason })
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const isId = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

// Missing evidence is an unresolved decision; malformed provider data is an error.
class UnknownSuccession extends Error {}
function unknown(reason: string): never { throw new UnknownSuccession(reason) }
type Read = (name: string, subject: string) => unknown
type Heir = Pick<SuccessionClaimant, 'person' | 'through' | 'coparcener'>

function familyReads(read: Read, day: number) {
  const required = (name: string, subject: string): unknown => {
    const value = read(name, subject)
    return value == null ? unknown(`missing ${name}: ${subject}`) : value
  }
  const ids = (name: string, subject: string): string[] => {
    const value = required(name, subject)
    if (!Array.isArray(value) || !value.every(isId)) throw new Error(`${name}: expected person IDs or null`)
    return [...new Set<string>(value)].sort()
  }
  const id = (name: string, subject: string): string => {
    const value = required(name, subject)
    if (!isId(value)) throw new Error(`${name}: expected person ID or null`)
    return value
  }
  const flag = (name: string, subject: string): boolean => {
    const value = required(name, subject)
    if (typeof value !== 'boolean') throw new Error(`${name}: expected boolean or null`)
    return value
  }
  const parents = (person: string): { father: string | null; mother: string | null } => {
    const value = required('kin.parents', person)
    if (value === null || typeof value !== 'object' || Array.isArray(value)
      || !('father' in value) || !('mother' in value)
      || !(value.father === null || isId(value.father)) || !(value.mother === null || isId(value.mother))) {
      throw new Error('kin.parents: expected {father, mother}, each an ID or null')
    }
    return { father: value.father, mother: value.mother }
  }
  const parent = (person: string, side: 'father' | 'mother'): string =>
    parents(person)[side] ?? unknown(`missing kin.parents: ${person} (${side})`)
  const born = (person: string): number => {
    const value = required('person.born', person)
    if (typeof value !== 'number' || !Number.isFinite(value) || value > day) {
      throw new Error('person.born: expected a finite birth day no later than the query day')
    }
    return value
  }
  const sex = (person: string): string => id('person.sex', person)
  const children = (person: string) => ids('kin.children', person)
  const alive = (person: string) => flag('person.alive', person)
  const eldest = (people: readonly string[]): string[] => {
    const rows = people.map(person => ({ person, born: born(person) }))
    const first = Math.min(...rows.map(row => row.born))
    return rows.filter(row => row.born === first).map(row => row.person)
  }
  return { required, ids, id, flag, parents, parent, born, sex, children, alive, eldest }
}
type Family = ReturnType<typeof familyReads>

/** Canons 1–4, shared by the issue and each whole-blood collateral stock. */
function englishDescent(f: Family, holder: string, office: string): Heir[] {
  function lines(people: string[], through: string[] = [], path: string[] = [holder]): Heir[] {
    const rows = people.map(person => {
      if (path.includes(person)) throw new Error(`kin.children: cyclic descent at ${person}`)
      const sex = f.sex(person)
      if (sex !== 'male' && sex !== 'female') unknown(`unsupported person.sex: ${person}`)
      return { person, sex, born: f.born(person) }
    })
    function branch(person: string): Heir[] {
      if (f.alive(person)) return [{ person, ...(through.length ? { through: [...through] } : {}) }]
      return lines(f.children(person), [...through, person], [...path, person])
    }
    const sons = rows.filter(row => row.sex === 'male').sort((a, b) => a.born - b.born || compare(a.person, b.person))
    for (const birth of [...new Set(sons.map(row => row.born))]) {
      const heirs = sons.filter(row => row.born === birth).flatMap(row => branch(row.person))
      if (heirs.length) return heirs
    }
    return rows.filter(row => row.sex === 'female').flatMap(row => branch(row.person))
      .map(heir => ({ ...heir, coparcener: true }))
  }
  const issue = lines(f.children(holder))
  if (issue.length) return issue
  const purchaser = f.id('estate.first-purchaser', office)
  const halfBlood = new Set<string>()
  const ancestry = new Map<string, boolean>()
  function purchaserBlood(person: string, path: string[] = []): boolean {
    if (purchaser === holder || person === purchaser) return true
    if (ancestry.has(person)) return ancestry.get(person)!
    if (path.includes(person)) throw new Error(`kin.parents: cyclic ancestry at ${person}`)
    const parents = f.parents(person)
    if (parents.father === purchaser || parents.mother === purchaser) return true
    let missing: UnknownSuccession | undefined
    for (const ancestor of [parents.father, parents.mother]) {
      try {
        if (ancestor === null) unknown(`missing kin.parents: ${person}`)
        if (purchaserBlood(ancestor, [...path, person])) { ancestry.set(person, true); return true }
      } catch (error) {
        if (!(error instanceof UnknownSuccession)) throw error
        missing = error
      }
    }
    if (missing) throw missing
    ancestry.set(person, false)
    return false
  }
  function surviving(person: string, path: string[] = []): boolean {
    if (path.includes(person)) throw new Error(`kin.children: cyclic descent at ${person}`)
    return f.alive(person) || f.children(person).some(child => surviving(child, [...path, person]))
  }
  function stock(child: string): { heirs: Heir[]; couple: string[] } {
    const father = f.parent(child, 'father'), mother = f.parent(child, 'mother')
    const whole: string[] = []
    for (const person of [...new Set([...f.children(father), ...f.children(mother)])].sort()) {
      if (person === child) continue // This branch's issue was already exhausted; never ascend.
      const parents = f.parents(person)
      if (parents.father === null || parents.mother === null) unknown(`missing kin.parents: ${person}`)
      if (parents.father === father && parents.mother === mother) whole.push(person)
      else halfBlood.add(person)
    }
    // If the purchaser belongs to a different known side, none of this stock is of that blood.
    const eligible = whole.filter(person => purchaserBlood(person))
    return { heirs: lines(eligible), couple: [father, mother] }
  }
  const siblings = stock(holder)
  if (siblings.heirs.length) return siblings.heirs
  if (siblings.couple.includes(purchaser)) {
    return [...halfBlood].some(person => surviving(person))
      ? unknown('only half-blood kin remain: succession not stated') : []
  }
  // A known purchaser on the maternal side confines canon 5's search to that side.
  const paternal = f.parents(siblings.couple[0]), maternal = f.parents(siblings.couple[1])
  const grandparents = [paternal.father, paternal.mother, maternal.father, maternal.mother]
  const sides = grandparents.slice(2).includes(purchaser) ? [siblings.couple[1]]
    : grandparents.slice(0, 2).includes(purchaser) ? [siblings.couple[0]] : siblings.couple
  for (const side of sides) {
    const kin = stock(side)
    if (kin.heirs.length) return kin.heirs
  }
  if ([...halfBlood].some(person => surviving(person))) return unknown('only half-blood kin remain: succession not stated')
  if (grandparents.includes(purchaser)) return []
  return unknown('collateral stocks beyond grandparents: succession not stated')
}

function chosen(law: Law, choice?: SuccessionHost['choice']): string[] {
  const people = choice?.(law)
  if (people == null) return unknown(`host ${law.succession!.rule} choice not supplied: ${law.id}`)
  if (!Array.isArray(people) || !people.every(isId)) throw new Error('succession choice: expected person IDs or null')
  if (!people.length) return unknown(`no ${law.succession!.rule} choice: ${law.id}`)
  return [...new Set(people)].sort()
}

function tanistry(f: Family, law: Law, holder: string, choice?: SuccessionHost['choice']): Heir[] {
  const basis = law.succession!
  if (basis.kin == null) return unknown(`kin not stated: ${law.id}`)
  if (basis.line == null) return unknown(`line not stated: ${law.id}`)
  let ancestor = holder
  for (let n = 0; n < (basis.kin === 'derbfine' ? 3 : 2); n++) ancestor = f.parent(ancestor, 'father')
  const eligible = new Set<string>()
  function visit(person: string, path: string[]): void {
    if (path.includes(person)) throw new Error(`kin.children: cyclic descent at ${person}`)
    const male = f.sex(person) === 'male'
    if (basis.line === 'male' && !male) return
    if (person !== holder && male && f.alive(person)
      && f.flag('person.full-age', person) && !f.flag('person.blemished', person)) eligible.add(person)
    for (const child of f.children(person)) visit(child, [...path, person])
  }
  visit(ancestor, [])
  if (!eligible.size) return unknown(`no eligible tanist: ${law.id}`)
  const people = chosen(law, choice)
  for (const person of people) if (!eligible.has(person)) return unknown(`ineligible tanist: ${person}`)
  return people.map(person => ({ person }))
}

function rotation(f: Family, law: Law, holder: string, office: string): Heir[] {
  const ladder = law.succession!.ladder
  if (ladder == null) return unknown(`ladder not stated: ${law.id}`)
  const rung = ladder.indexOf(office)
  if (rung < 0) return unknown(`office not on ladder: ${office}`)
  const past = f.ids('office.past-holders', ladder[0])
  const eligible = (person: string) => f.sex(person) === 'male' && f.alive(person)
    && past.includes(f.parent(person, 'father'))
  let people: string[]
  if (rung > 0) {
    if (rung === ladder.length - 1) return unknown(`lowest rung: ${office}`)
    const next = f.required('office.holder', ladder[rung + 1])
    if (next !== '' && !isId(next)) throw new Error('office.holder: expected holder ID, empty string or null')
    if (next === '' || !eligible(next)) return unknown(`ineligible next rung holder: ${ladder[rung + 1]}`)
    people = [next]
  } else {
    const father = f.parent(holder, 'father')
    const brothers = f.children(father).filter(person => f.sex(person) === 'male'
      && f.parent(person, 'father') === father)
    people = f.eldest(brothers.filter(person => person !== holder && eligible(person)))
    if (!people.length) {
      const reigning = f.eldest(brothers.filter(person => past.includes(person)))
      people = reigning.flatMap(person => f.eldest(f.children(person).filter(eligible)))
    }
    if (!people.length) return unknown(`no eligible rota successor: ${office}`)
  }
  return [...new Set(people)].sort().map(person => ({ person }))
}

function designation(f: Family, law: Law, office: string, choice?: SuccessionHost['choice']): Heir[] {
  const people = chosen(law, choice)
  const past = f.ids('office.past-holders', office)
  for (const person of people) {
    if (!f.flag('person.prince', person)) return unknown(`ineligible designee: ${person}`)
    const parents = f.parents(person)
    if (parents.father === null || parents.mother === null) return unknown(`missing kin.parents: ${person}`)
    for (const parent of [parents.father, parents.mother].filter(parent => past.includes(parent))) {
      const princes = f.children(parent).filter(child => f.sex(child) === 'male')
      if (f.eldest(princes).includes(person)) return unknown(`firstborn prince: ${person}`)
    }
  }
  return people.map(person => ({ person }))
}

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
      if (!living.length) return unresolved('no direct heir: primogeniture does not specify representation or collateral heirs')
      const pool = living.some(child => child.preferred) ? living.filter(child => child.preferred) : living
      const oldest = Math.min(...pool.map(child => child.born))
      // Equal birth dates remain rival claims; ID order never invents seniority.
      people = pool.filter(child => child.born === oldest).map(child => child.person)
    } else if (basis.rule === 'appointment' || basis.rule === 'election') {
      const selected = choice?.(law)
      if (selected == null) return unresolved(`host ${basis.rule} choice not supplied: ${law.id}`)
      if (!Array.isArray(selected) || !selected.every(isId)) throw new Error('succession choice: expected person IDs or null')
      people = selected
    } else if (basis.rule === 'english-descent' || basis.rule === 'tanistry'
      || basis.rule === 'rotation' || basis.rule === 'designation') {
      try {
        const f = familyReads(read, day)
        const heirs = basis.rule === 'english-descent' ? englishDescent(f, holder, office.id)
          : basis.rule === 'tanistry' ? tanistry(f, law, holder, choice)
          : basis.rule === 'rotation' ? rotation(f, law, holder, office.id)
          : designation(f, law, office.id, choice)
        for (const heir of heirs) claimants.push({ ...heir, law: law.id, basis: structuredClone(basis) })
      } catch (error) {
        if (error instanceof UnknownSuccession) return unresolved(error.message)
        throw error
      }
      continue
    } else {
      return unresolved('open contest requires negotiation, procedure or force; resolution not built')
    }
    for (const person of [...new Set(people)].sort()) claimants.push({ person, law: law.id, basis: structuredClone(basis) })
  }
  return { kind: 'claimants', claimants: claimants.sort((a, b) => compare(a.person, b.person) || compare(a.law, b.law)) }
}

/** Primogeniture keeps its direct-child scope; English descent represents dead
 * heirs. Recorded choices await resolveSuccession's host; missing evidence never implies vacancy.
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
  if (result.claimants.some(claimant => claimant.coparcener)) {
    return unresolved('coparceners: joint holding of one office not stated')
  }
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
    basis: structuredClone(claimant.basis), law: claimant.law }
}
