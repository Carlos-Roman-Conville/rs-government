import { describe, expect, it } from 'vitest'
import { applyEntry, assessAct, attempt, confirm, createViolation, failExecution,
  obligationStatus, openObligation, refuse, requestCollection, sanctionCommands, startExecution } from '../src/index.ts'
import type { Act, Execution, Law, Report, SanctionKind, TaxAssessment } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'person.subject', action: 'seize', object: 'grain',
  place: 'place.manor', day: 10, attempted: true, succeeded: true }
const ordered = (owner: Execution['owner'] = 'settlement') =>
  startExecution('execution.1', 'order.1', owner, 'pay')
const confirmation = { owner: 'settlement' as const, ref: 'payment.1', day: 12 }
const denial = { owner: 'settlement' as const, reason: 'lacks power', day: 12 }

// These owners alone mutate their holdings. Confirmed refs apply each move once.
function settlementStub() {
  const balances = new Map([['person.subject', 20], ['treasury', 0]])
  const refs = new Set<string>()
  const denialText = 'office.collector lacks power pay'
  return {
    balances, refs, denialText,
    pay(from: string, to: string, amount: number, ref: string, day: number, accepted: boolean) {
      if (!accepted) return { kind: 'refused' as const, owner: 'settlement' as const, reason: denialText, day }
      if (!refs.has(ref)) {
        balances.set(from, balances.get(from)! - amount)
        balances.set(to, balances.get(to)! + amount)
        refs.add(ref)
      }
      return { kind: 'confirmed' as const, owner: 'settlement' as const, ref, day }
    },
  }
}

function economyStub() {
  const inventory = new Map([['person.subject', 20], ['treasury', 0]])
  const refs = new Set<string>()
  return {
    inventory, refs,
    transfer(from: string, to: string, amount: number, ref: string, day: number) {
      if (!refs.has(ref)) {
        inventory.set(from, inventory.get(from)! - amount)
        inventory.set(to, inventory.get(to)! + amount)
        refs.add(ref)
      }
      return { owner: 'economy' as const, ref, day }
    },
  }
}

function holderStub() {
  const holders = new Map([['office.collector', 'person.incumbent']])
  const refs = new Set<string>()
  return {
    holders, refs,
    appoint(office: string, holder: string, ref: string, day: number, accepted: boolean) {
      if (!accepted) return { kind: 'refused' as const, owner: 'settlement' as const, reason: 'lacks power', day }
      if (!refs.has(ref)) {
        holders.set(office, holder)
        refs.add(ref)
      }
      return { kind: 'confirmed' as const, owner: 'settlement' as const, ref, day }
    },
  }
}

function sanctionEnvelope(kind: SanctionKind) {
  const law: Law = { ...lawFixture(),
    consequence: { kind: 'sanctions', sanctions: [{ kind, amount: 5, note: 'Scenario amount' }] } }
  const breach = assessAct([law], act, () => undefined)[0].breach!
  return sanctionCommands(createViolation('violation.1', breach), law)[0]
}

describe('execution records at the owner boundary', () => {
  it('(e1) only an owner confirmation turns an attempt into an execution', () => {
    const initial = ordered()
    expect(initial).toEqual({ type: 'government.execution', id: 'execution.1', order: 'order.1',
      owner: 'settlement', command: 'pay', status: 'ordered', reason: null, confirmation: null,
      attemptedOn: null, closedOn: null })
    expect(() => confirm(initial, confirmation)).toThrow(/attempted/)
    const pending = attempt(initial, 10)
    for (const day of [11, 100, 1000000]) {
      // Advancing the host's day has no automatic execution transition.
      const host = { day, execution: pending }
      expect(host.execution).toMatchObject({ status: 'attempted', attemptedOn: 10, closedOn: null,
        confirmation: null, reason: null })
    }
    expect(confirm(pending, confirmation)).toEqual({ ...pending, status: 'executed',
      confirmation: 'payment.1', closedOn: 12 })
    expect(pending.status).toBe('attempted')
  })

  it('(e2) confirmation, refusal and failure require the execution owner, including replay', () => {
    const owners = ['settlement', 'economy', 'world', 'host'] as const
    for (const owner of owners) {
      const pending = attempt(ordered(owner), 10)
      const completed = confirm(pending, { ...confirmation, owner })
      for (const other of owners.filter(candidate => candidate !== owner)) {
        expect(() => confirm(pending, { ...confirmation, owner: other })).toThrow(/owner mismatch/)
        expect(() => confirm(completed, { ...confirmation, owner: other })).toThrow(/owner mismatch/)
        expect(() => refuse(pending, { ...denial, owner: other })).toThrow(/owner mismatch/)
        expect(() => failExecution(pending, { ...denial, owner: other })).toThrow(/owner mismatch/)
      }
    }
  })

  it('(e3) final states reject transitions except identical confirmation replay; empty reasons throw', () => {
    const initial = ordered(), pending = attempt(initial, 10)
    expect(() => attempt(pending, 11)).toThrow(/ordered/)
    for (const close of [refuse, failExecution]) {
      expect(() => close(initial, denial)).toThrow(/attempted/)
      for (const reason of ['', ' \t\n']) expect(() => close(pending, { ...denial, reason })).toThrow(/reason/)
      expect(close(pending, { ...denial, reason: '  owner text\n' })).toMatchObject({ reason: '  owner text\n' })
    }
    const completed = confirm(pending, confirmation)
    const replay = confirm(completed, { ...confirmation, day: 99 })
    expect(replay).toEqual(completed)
    expect(replay).not.toBe(completed)
    for (const final of [completed, refuse(pending, denial), failExecution(pending, denial)]) {
      expect(() => attempt(final, 13)).toThrow()
      expect(() => refuse(final, denial)).toThrow()
      expect(() => failExecution(final, denial)).toThrow()
      expect(() => confirm(final, { ...confirmation, ref: 'different' })).toThrow()
      if (final.status !== 'executed') expect(() => confirm(final, confirmation)).toThrow()
      expect(final).toMatchObject({ attemptedOn: 10, closedOn: 12 })
      if (final.status !== 'executed') expect(final.confirmation).toBeNull()
    }
  })

  it('(e4) corporal and detention sanctions request physically resolved world enforcement actions', () => {
    for (const kind of ['corporal', 'detention'] as const) {
      const command = sanctionEnvelope(kind)
      expect(command).toEqual({ owner: 'world', type: 'enforcement-action', kind,
        violation: 'violation.1', law: lawFixture().id, actor: act.actor, object: act.object,
        amount: 5, note: 'Scenario amount' })
      expect(command).not.toMatchObject({ owner: 'life', type: 'injury' })
      expect(command).not.toMatchObject({ owner: 'host', type: 'detention' })
    }
  })

  it('(e5) all transitions are deterministic new values; discarding results completely rolls back', () => {
    const initial = Object.freeze(ordered())
    const pending = Object.freeze(attempt(initial, 10))
    const report = Object.freeze({ ...confirmation }), refusal = Object.freeze({ ...denial })
    const snapshot = structuredClone({ initial, pending, report, refusal })
    const operations = [
      () => startExecution(initial.id, initial.order, initial.owner, initial.command),
      () => attempt(initial, 10), () => confirm(pending, report),
      () => refuse(pending, refusal), () => failExecution(pending, refusal),
      () => confirm(confirm(pending, report), report),
    ]
    for (const operation of operations) {
      operation() // Discarded: there is no hidden state or owner side effect.
      const first = operation(), second = operation()
      expect(first).toEqual(second)
      expect(first).not.toBe(second)
      expect(first).not.toBe(initial)
      expect(first).not.toBe(pending)
      expect(JSON.parse(JSON.stringify(first))).toEqual(first)
      first.reason = 'changed returned record'
      expect(second.reason).not.toBe(first.reason)
    }
    expect({ initial, pending, report, refusal }).toEqual(snapshot)
  })

  it('(e6) a fine executes only on the ledger confirmation, with one payment per ref', () => {
    const ledger = settlementStub(), command = sanctionEnvelope('fine')
    if (command.type !== 'pay') throw new Error('Expected fine pay envelope')
    const initial = startExecution('fine.1', command.violation, command.owner, command.type)
    const pending = attempt(initial, 10)
    expect(ledger.balances).toEqual(new Map([['person.subject', 20], ['treasury', 0]]))
    const pay = () => ledger.pay(command.actor, 'treasury', command.amount!, 'fine.payment.1', 12, true)
    const report = pay()
    if (report.kind !== 'confirmed') throw new Error('Expected owner confirmation')
    const executed = confirm(pending, report)
    const replay = pay()
    if (replay.kind !== 'confirmed') throw new Error('Expected replay confirmation')
    expect(confirm(executed, replay)).toEqual(executed)
    expect([initial.status, pending.status, executed.status]).toEqual(['ordered', 'attempted', 'executed'])
    expect(executed.confirmation).toBe('fine.payment.1')
    expect(ledger.balances).toEqual(new Map([['person.subject', 15], ['treasury', 5]]))
    expect([...ledger.balances.values()].reduce((sum, value) => sum + value, 0)).toBe(20)
    expect(ledger.refs.size).toBe(1)
  })

  it('(f1) an unauthorised take can succeed physically and breach law, with no duplicate goods move', () => {
    const economy = economyStub()
    const law: Law = { ...lawFixture('take'), modality: 'prohibit', regulated: { action: 'take', object: 'any' },
      exceptions: [{ condition: { read: 'authority.grant', op: 'eq', value: true }, reason: 'Actor holds a grant' }] }
    const event = { ...act, action: 'take' }
    const pending = attempt(startExecution('take.1', 'act.take.1', 'economy', event.action), event.day)
    const move = () => economy.transfer('person.subject', 'treasury', 5, 'take.transfer.1', 12)
    const executed = confirm(pending, move())
    expect(executed.status).toBe('executed')
    const assessments = assessAct([law], event, () => false)
    expect(assessments).toHaveLength(1)
    expect(assessments[0]).toMatchObject({ result: 'breach', breach: { act: event, stage: 'breach' } })
    expect(confirm(executed, move())).toEqual(executed)
    expect(economy.inventory).toEqual(new Map([['person.subject', 15], ['treasury', 5]]))
    expect([...economy.inventory.values()].reduce((sum, value) => sum + value, 0)).toBe(20)
    expect(economy.refs.size).toBe(1)
  })

  it('(f2) an authorised levy resisted moves no inventory and leaves the obligation outstanding', () => {
    const economy = economyStub(), before = new Map(economy.inventory)
    const law: Law = { ...lawFixture('levy'), modality: 'prohibit', regulated: { action: 'take', object: 'any' },
      exceptions: [{ condition: { read: 'authority.grant', op: 'eq', value: true }, reason: 'Authorised levy' }] }
    expect(assessAct([law], { ...act, action: 'take', succeeded: false }, () => true)[0].result).toBe('no-breach')
    const assessment: TaxAssessment = { type: 'government.tax_assessment', law: law.id, payer: act.actor,
      base: 20, baseRead: 'economy.harvest', owed: 5, unit: 'grain', day: 10, reason: null,
      treasury: 'treasury', collector: 'office.collector', act }
    const obligation = openObligation(assessment, 12)
    const request = { ref: 'collection.1', amount: 5, from: act.actor, owner: 'economy' as const }
    const envelope = requestCollection(obligation, [], request)!
    expect(envelope).toMatchObject({ owner: 'economy', type: 'transfer', amount: 5 })
    // The host attempts physical collection through world before any Economy transfer.
    const pending = attempt(startExecution('levy.1', request.ref, 'world', envelope.type), 11)
    const failed = failExecution(pending, { owner: 'world', reason: 'resisted', day: 12 })
    expect(failed).toMatchObject({ status: 'failed', reason: 'resisted', confirmation: null })
    const updated = applyEntry(obligation, { kind: 'failed-transfer', ref: failed.id,
      reason: failed.reason!, day: failed.closedOn! })
    expect(updated.entries).toHaveLength(1)
    expect(obligationStatus(updated)).toEqual(obligationStatus(obligation))
    expect(obligationStatus(updated).outstanding).toBe(5)
    expect(economy.inventory).toEqual(before)
    expect(economy.refs.size).toBe(0)
  })

  it('(f4) an announcement without an accepted appoint changes no holder and executes no appointment', () => {
    const settlement = holderStub(), before = new Map(settlement.holders)
    const announcement: Report = { id: 'report.appointment', by: ['person.claimant'], to: 'public', day: 10,
      form: 'announcement', claim: { accused: 'person.claimant', action: 'appoint',
        object: 'office.collector', day: 10, law: null }, quantity: null }
    const records = [announcement]
    const initial = startExecution('appointment.1', announcement.id, 'settlement', 'appoint')
    const pending = attempt(initial, 11)
    expect(settlement.holders).toEqual(before)
    const report = settlement.appoint('office.collector', 'person.claimant', 'appoint.1', 12, false)
    if (report.kind !== 'refused') throw new Error('Expected custodian refusal')
    const rejected = refuse(pending, report)
    expect(records[0].form).toBe('announcement')
    expect([initial, pending, rejected].filter(e => e.command === 'appoint' && e.status === 'executed')).toEqual([])
    expect(settlement.holders).toEqual(before)
    expect(settlement.refs.size).toBe(0)
  })

  it('(f5) an unauthorised payment refused by Settlement preserves its denial text and ledger', () => {
    const ledger = settlementStub(), before = new Map(ledger.balances)
    const pending = attempt(startExecution('payment.1', 'order.payment.1', 'settlement', 'pay'), 10)
    const report = ledger.pay('person.subject', 'treasury', 5, 'payment.1', 12, false)
    if (report.kind !== 'refused') throw new Error('Expected custodian refusal')
    const rejected = refuse(pending, report)
    expect(rejected).toMatchObject({ status: 'refused', reason: ledger.denialText,
      confirmation: null, attemptedOn: 10, closedOn: 12 })
    expect(ledger.balances).toEqual(before)
    expect(ledger.refs.size).toBe(0)
  })
})
