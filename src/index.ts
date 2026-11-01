// @rex/government: the public surface grows unit by unit (DESIGN §1, §2).
import { qualify } from '@rex/kernel'

/** The engine prefix every government id carries. */
export const ENGINE = 'government'

/** Qualify a local id such as `law.statute-of-labourers` as `government/law.statute-of-labourers`. */
export function governmentId(local: string): string {
  return qualify(ENGINE, local)
}
