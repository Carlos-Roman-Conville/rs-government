/** Government records the boundary; owners execute and report physical outcomes. */
export interface Execution {
  type: 'government.execution'
  id: string
  /** Host reference to an order, violation or collection request; not resolved here. */
  order: string
  owner: 'settlement' | 'economy' | 'world' | 'host'
  command: string
  status: 'ordered' | 'attempted' | 'executed' | 'refused' | 'failed'
  reason: string | null
  confirmation: string | null
  attemptedOn: number | null
  closedOn: number | null
}

export function startExecution(id: string, order: string, owner: Execution['owner'], command: string): Execution {
  return { type: 'government.execution', id, order, owner, command, status: 'ordered',
    reason: null, confirmation: null, attemptedOn: null, closedOn: null }
}

function requireStatus(e: Execution, status: Execution['status']): void {
  if (e.status !== status) throw new Error(`Execution must be ${status}, got ${e.status}`)
}

function requireOwner(e: Execution, owner: Execution['owner']): void {
  if (owner !== e.owner) throw new Error(`Execution owner mismatch: expected ${e.owner}, got ${owner}`)
}

/** An attempt is never a result, regardless of elapsed kernel days. */
export function attempt(e: Execution, day: number): Execution {
  requireStatus(e, 'ordered')
  return { ...e, status: 'attempted', attemptedOn: day }
}

/** Same-owner, same-ref replay preserves the original closure in a new value. */
export function confirm(e: Execution, report: { owner: Execution['owner']; ref: string; day: number }): Execution {
  requireOwner(e, report.owner)
  if (e.status === 'executed') {
    if (e.confirmation !== report.ref) throw new Error('Conflicting execution confirmation ref')
    return { ...e }
  }
  requireStatus(e, 'attempted')
  return { ...e, status: 'executed', confirmation: report.ref, closedOn: report.day }
}

function closeUnsuccessful(e: Execution, status: 'refused' | 'failed',
  report: { owner: Execution['owner']; reason: string; day: number }): Execution {
  requireOwner(e, report.owner)
  requireStatus(e, 'attempted')
  if (!report.reason.trim()) throw new Error('Execution refusal or failure requires a reason')
  return { ...e, status, reason: report.reason, closedOn: report.day }
}

/** Custodian denial at its command boundary, with its reason carried verbatim. */
export function refuse(e: Execution, report: { owner: Execution['owner']; reason: string; day: number }): Execution {
  return closeUnsuccessful(e, 'refused', report)
}

/** Owner-reported physical failure, never an outcome resolved by Government. */
export function failExecution(e: Execution,
  report: { owner: Execution['owner']; reason: string; day: number }): Execution {
  return closeUnsuccessful(e, 'failed', report)
}
