import { applicableLaws, evaluateAct, lawConditionsHold } from '../law/evaluate.ts'
import type { Act, ActFacts } from '../law/evaluate.ts'
import type { Law, LawId } from '../law/schema.ts'

/** DESIGN §1.11: the regime covers Settlement title and lease commands. */
export const TITLE_COMMANDS = ['transfer', 'inherit', 'lease', 'seize', 'enclose'] as const
export type TitleCommandKind = typeof TITLE_COMMANDS[number]
/** Host adapts its owner command to an act; outcomes are supplied, never decided here. */
export type TitleCommand = Omit<Act, 'day' | 'action'> & { action: TitleCommandKind }
/** A transient title reference with the host's proposed transfer context, not owned state. */
export type TransferTitle = Omit<TitleCommand, 'action' | 'object'> & { id: string }
export type TitleLawfulness = { lawful: true } | { lawful: false; void: LawId[] }

/** Pass the whole law set to preserve supersession, including non-property replacements. */
export function propertyRegime(laws: readonly Law[], command: TitleCommand, day: number,
  facts: ActFacts): Law[] {
  return [...applicableLaws(laws, { ...command, day }, facts).values()].flat()
    .filter(law => (TITLE_COMMANDS as readonly string[]).includes(law.regulated.action))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Only a void consequence prevents recognition; sanctions remain separate breaches. */
export function titleCommandLawful(laws: readonly Law[], command: TitleCommand, day: number,
  facts: ActFacts): TitleLawfulness {
  const voidIds = evaluateAct(laws, { ...command, day }, facts)
    .filter(breach => breach.sanction === null).map(breach => breach.law)
  return voidIds.length ? { lawful: false, void: voidIds } : { lawful: true }
}

/** DESIGN §1.11 / §2.3(6): null preserves Settlement's setup field when no rule speaks.
 * The host supplies actor, place and outcome for this proposed transfer; recipient or
 * title-class predicates are owner reads through facts. Nothing is stored or executed.
 */
export function transferable(laws: readonly Law[], title: TransferTitle, day: number,
  facts: ActFacts): boolean | null {
  const { id, ...context } = title
  const command: TitleCommand = { ...context, action: 'transfer', object: id }
  const act: Act = { ...command, day }
  const speaks = propertyRegime(laws, command, day, facts).some(law =>
    law.regulated.action === 'transfer' && lawConditionsHold(law, act, facts))
  return speaks ? titleCommandLawful(laws, command, day, facts).lawful : null
}
