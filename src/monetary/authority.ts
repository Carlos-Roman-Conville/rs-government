import type { LawId } from '../law/schema.ts'
import type { AuthorityProvider } from '../ports/authority-provider.ts'

interface MonetaryContext {
  /** Host-supplied provenance, not a grant: may alone decides permission.
   * null means the host has no law reference; never infer one from a boolean. */
  law: LawId | null
  office: string
  holder: string
  day: number
}
export interface MonetaryRequest extends MonetaryContext {
  currency: string
  amount: number
  note: string
}
/** Structurally compatible with Settlement commands; no engine import or write. */
export type MonetaryCommand = {
  holder: string
  amount: number
  currency: string
  note: string
} & ({ type: 'credit'; process: 'government.monetary.issue' }
  | { type: 'debit'; process: 'government.monetary.retire' })

export interface MintCommand {
  type: 'mint'
  office: string
  holder: string
  metal: string
  metalUnits: number
  coin: string
  coinUnits: number
  day: number
}
export interface MintRequest extends MonetaryContext, Omit<MintCommand, 'type'> {
  /** Units of this metal per coin unit, supplied from the coin good's data. */
  metalContent: number | null
}
export interface MonetaryEvent extends MonetaryContext {
  type: 'government.monetary'
  action: 'issue' | 'retire' | 'mint'
  currency: string
  amount: number
  outcome: 'command' | 'refused'
  reason: string | null
  /** Refusals are flagged for the host; they do not adjudicate a breach. */
  flagged: boolean
}
export interface MintEvent extends MonetaryEvent {
  metal: string
  metalUnits: number
  coin: string
  coinUnits: number
  metalContent: number | null
}
export interface MonetaryResult<C, E extends MonetaryEvent = MonetaryEvent> {
  commands: [] | [C]
  events: [E]
}

const positive = (amount: number): boolean => Number.isFinite(amount) && amount > 0

function permission(request: MonetaryContext, authority: AuthorityProvider,
  power: 'issue' | 'mint', subject: string): string | null {
  if (!Number.isFinite(request.day)) throw new Error('Monetary day must be finite')
  return authority.may(request.office, power, subject, request.day)
    ? null : `AuthorityProvider.may refused ${power} for ${subject}`
}

function event(request: MonetaryContext, action: MonetaryEvent['action'],
  currency: string, amount: number, reason: string | null): MonetaryEvent {
  const { law, office, holder, day } = request
  return { type: 'government.monetary', action, law, office, currency, holder, amount, day,
    outcome: reason === null ? 'command' : 'refused', reason, flagged: reason !== null }
}

function money(request: MonetaryRequest, authority: AuthorityProvider,
  action: 'issue' | 'retire'): MonetaryResult<MonetaryCommand> {
  const reason = permission(request, authority, 'issue', request.currency)
    ?? (positive(request.amount) ? null : 'Amount must be finite and greater than zero')
  const { holder, amount, currency, note } = request
  const command: MonetaryCommand = action === 'issue'
    ? { type: 'credit', holder, amount, currency, process: 'government.monetary.issue', note }
    : { type: 'debit', holder, amount, currency, process: 'government.monetary.retire', note }
  return { commands: reason === null ? [command] : [],
    events: [event(request, action, currency, amount, reason)] }
}

/** Return intent and its log for the host to carry; no balance is stored or changed. */
export function issue(request: MonetaryRequest, authority: AuthorityProvider): MonetaryResult<MonetaryCommand> {
  return money(request, authority, 'issue')
}

/** Retirement uses the same issue power, never a separate retire grant. */
export function retire(request: MonetaryRequest, authority: AuthorityProvider): MonetaryResult<MonetaryCommand> {
  return money(request, authority, 'retire')
}

/** The host resolves this as a metal-to-coin transfer. Exact equality is required;
 * no content default, rounding allowance, metal creation or money command. */
export function mint(request: MintRequest, authority: AuthorityProvider): MonetaryResult<MintCommand, MintEvent> {
  const { office, holder, metal, metalUnits, coin, coinUnits, day, metalContent } = request
  const reason = permission(request, authority, 'mint', coin)
    ?? (metalContent === null ? 'Missing coin metal content'
      : !positive(metalContent) ? 'Coin metal content must be finite and greater than zero'
      : !positive(metalUnits) || !positive(coinUnits) ? 'Mint quantities must be finite and greater than zero'
      : metalContent * coinUnits !== metalUnits ? 'Coin metal content times coinUnits must equal metalUnits'
      : null)
  return {
    commands: reason === null ? [{ type: 'mint', office, holder, metal, metalUnits, coin, coinUnits, day }] : [],
    events: [{ ...event(request, 'mint', coin, coinUnits, reason),
      metal, metalUnits, coin, coinUnits, metalContent }],
  }
}
