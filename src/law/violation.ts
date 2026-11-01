import type { Act } from './evaluate.ts'
import type { Law, LawId, Sanction } from './schema.ts'

export type ViolationStage = 'breach' | 'detected' | 'prosecuted' | 'sanctioned' | 'dropped' | 'failed'
export interface Violation {
  id: string
  law: LawId
  act: Act
  stage: ViolationStage
  known_to: string[]
  /** Prescribed sanctions, not proof of execution; null for a void consequence. */
  sanction: Sanction[] | null
  reason: string | null
}
export type Breach = Omit<Violation, 'id' | 'stage'> & { stage: 'breach' }

/** IDs come from the host/kernel, so identical acts can be separate occurrences. */
export function createViolation(id: string, breach: Breach): Violation {
  if (!id.trim()) throw new Error('Violation id must be non-empty')
  return copy({ ...breach, id, stage: 'breach', known_to: [], reason: null })
}

function copy(v: Violation): Violation {
  return { ...v, act: { ...v.act }, known_to: [...v.known_to],
    sanction: v.sanction?.map(item => ({ ...item })) ?? null }
}

function transition(v: Violation, stage: ViolationStage, from: ViolationStage[]): Violation {
  if (!from.includes(v.stage)) throw new Error(`Illegal violation transition: ${v.stage} -> ${stage}`)
  return { ...copy(v), stage }
}

/** Further observations may add enforcers while the record is detected. */
export function detect(v: Violation, enforcer: string): Violation {
  if (!enforcer.trim()) throw new Error('Enforcer must be non-empty')
  const next = transition(v, 'detected', ['breach', 'detected'])
  next.known_to = [...new Set([...v.known_to, enforcer])].sort()
  return next
}

export function prosecute(v: Violation): Violation {
  return transition(v, 'prosecuted', ['detected'])
}

/** Record the host's confirmed outcome; this function executes no consequence. */
export function sanction(v: Violation): Violation {
  return transition(v, 'sanctioned', ['prosecuted'])
}

export function drop(v: Violation, reason: string): Violation {
  if (!reason.trim()) throw new Error('Dropped violation requires a reason')
  return { ...transition(v, 'dropped', ['detected']), reason }
}

export function fail(v: Violation, reason: string): Violation {
  if (!reason.trim()) throw new Error('Failed sanction requires a reason')
  return { ...transition(v, 'failed', ['prosecuted']), reason }
}

interface CommandDetails {
  violation: string
  law: LawId
  actor: string
  object: string | null
  amount: number | null
  note: string
}
export type SanctionCommand =
  | (CommandDetails & { owner: 'settlement'; type: 'pay' })
  | (CommandDetails & { owner: 'settlement'; type: 'transfer'; kind: 'seizure' })
  | (CommandDetails & { owner: 'life'; type: 'injury' })
  | (CommandDetails & { owner: 'host'; type: 'detention' | 'outlawry' | 'exile' })
  | { owner: 'host'; type: 'void-act' }

/** Translate prescribed consequences only. Owners/host resolve execution details. */
export function sanctionCommands(v: Violation, law: Law): SanctionCommand[] {
  if (v.law !== law.id) throw new Error(`Violation ${v.id} does not refer to law ${law.id}`)
  if (law.consequence.kind === 'void') return [{ owner: 'host', type: 'void-act' }]
  return law.consequence.sanctions.map(item => {
    const details: CommandDetails = { violation: v.id, law: v.law, actor: v.act.actor,
      object: v.act.object, amount: item.amount, note: item.note }
    switch (item.kind) {
      case 'fine': return { ...details, owner: 'settlement', type: 'pay' }
      case 'seizure': return { ...details, owner: 'settlement', type: 'transfer', kind: 'seizure' }
      case 'corporal': return { ...details, owner: 'life', type: 'injury' }
      default: return { ...details, owner: 'host', type: item.kind }
    }
  })
}
