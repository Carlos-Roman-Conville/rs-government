import { describe, expect, it } from 'vitest'
import { createViolation, detect, drop, evaluateAct, fail, prosecute, sanction, sanctionCommands } from '../src/index.ts'
import type { Act, Law, SanctionKind, Violation, ViolationStage } from '../src/index.ts'
import { lawFixture } from './law-fixture.ts'

const act: Act = { actor: 'person.subject', action: 'seize', object: 'title.field',
  place: 'place.town', day: 10, attempted: true, succeeded: true }
function breach(law = lawFixture()): Violation {
  return createViolation('government/violation.fixture', evaluateAct([law], act, () => undefined)[0])
}

describe('violation records', () => {
  it('a new breach has a host-supplied id and no knowledge or outcome', () => {
    expect(breach()).toEqual({ id: 'government/violation.fixture', law: lawFixture().id,
      act, stage: 'breach', known_to: [], sanction: null, reason: null })
  })
  it('separate occurrences of identical acts can receive different kernel ids', () => {
    const record = evaluateAct([lawFixture()], act, () => undefined)[0]
    expect(createViolation('government/violation.one', record).id).not.toBe(createViolation('government/violation.two', record).id)
    expect(() => createViolation('', record)).toThrow(/id/)
  })
  it('breach, detection, prosecution and sanction remain separate immutable records', () => {
    const initial = breach()
    const detected = detect(initial, 'office.reeve')
    const prosecuted = prosecute(detected)
    const sanctioned = sanction(prosecuted)
    expect([initial, detected, prosecuted, sanctioned].map(v => v.stage)).toEqual(['breach', 'detected', 'prosecuted', 'sanctioned'])
    expect(initial.known_to).toEqual([])
    expect(sanctioned.known_to).toEqual(['office.reeve'])
    sanctioned.act.actor = 'copy'
    sanctioned.known_to.push('copy')
    expect(prosecuted.act.actor).toBe(act.actor)
    expect(prosecuted.known_to).toEqual(['office.reeve'])
  })
  it('detection records sorted unique enforcers without inventing observers', () => {
    const detected = detect(detect(detect(breach(), 'z'), 'a'), 'z')
    expect(detected.known_to).toEqual(['a', 'z'])
    expect(() => detect(breach(), '')).toThrow(/Enforcer/)
  })
  it('a detected case may be dropped without prosecution, retaining the reason', () => {
    const detected = detect(breach(), 'office.reeve')
    expect(drop(detected, 'Enforcer declined')).toEqual({ ...detected, stage: 'dropped', reason: 'Enforcer declined' })
    expect(detected.reason).toBeNull()
  })
  it.each(['Insufficient capacity', 'Successful resistance'])('a prosecuted sanction may fail: %s', reason => {
    const prosecuted = prosecute(detect(breach(), 'office.reeve'))
    expect(fail(prosecuted, reason)).toEqual({ ...prosecuted, stage: 'failed', reason })
  })
  it('drop and fail require an explicit reason', () => {
    const detected = detect(breach(), 'office.reeve')
    expect(() => drop(detected, ' ')).toThrow(/reason/)
    expect(() => fail(prosecute(detected), '')).toThrow(/reason/)
  })

  const stages: ViolationStage[] = ['breach', 'detected', 'prosecuted', 'sanctioned', 'dropped', 'failed']
  const transitions: [string, (v: Violation) => Violation, ViolationStage[]][] = [
    ['detect', v => detect(v, 'office.reeve'), ['breach', 'detected']],
    ['prosecute', prosecute, ['detected']],
    ['sanction', sanction, ['prosecuted']],
    ['drop', v => drop(v, 'Declined'), ['detected']],
    ['fail', v => fail(v, 'Capacity'), ['prosecuted']],
  ]
  for (const [name, transition, allowed] of transitions) {
    it.each(stages.filter(stage => !allowed.includes(stage)))(`${name} refuses the illegal transition from %s`, stage => {
      const v = { ...breach(), stage }
      const before = structuredClone(v)
      expect(() => transition(v)).toThrow(/Illegal violation transition/)
      expect(v).toEqual(before)
    })
  }
})

describe('sanction command data', () => {
  it.each<[SanctionKind, string, string]>([
    ['fine', 'settlement', 'pay'], ['seizure', 'settlement', 'transfer'], ['corporal', 'life', 'injury'],
    ['detention', 'host', 'detention'], ['outlawry', 'host', 'outlawry'], ['exile', 'host', 'exile'],
  ])('%s becomes an owner command without executing anything', (kind, owner, type) => {
    const law: Law = { ...lawFixture(), consequence: { kind: 'sanctions', sanctions: [{ kind, amount: 5, note: 'Fixture amount' }] } }
    const v = prosecute(detect(breach(law), 'office.reeve'))
    const before = structuredClone({ law, v })
    const commands = sanctionCommands(v, law)
    expect(commands).toEqual([{ owner, type, violation: v.id, law: law.id,
      actor: act.actor, object: act.object, amount: 5, note: 'Fixture amount',
      ...(kind === 'seizure' ? { kind: 'seizure' } : {}),
    }])
    expect(JSON.parse(JSON.stringify(commands))).toEqual(commands)
    expect({ law, v }).toEqual(before)
    expect(v.stage).toBe('prosecuted')
  })
  it('void returns the exact host void-act command', () => {
    expect(sanctionCommands(breach(), lawFixture())).toEqual([{ owner: 'host', type: 'void-act' }])
  })
  it('unknown amounts stay null with their explanatory note', () => {
    const law: Law = { ...lawFixture(), consequence: { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: null, note: 'No amount supplied' }] } }
    expect(sanctionCommands(breach(law), law)).toEqual([expect.objectContaining({ amount: null, note: 'No amount supplied' })])
  })
  it('command order preserves the prescribed consequence order and empty sanctions return no commands', () => {
    const law: Law = { ...lawFixture(), consequence: { kind: 'sanctions', sanctions: [
      { kind: 'seizure', amount: null, note: 'Unspecified' }, { kind: 'fine', amount: 2, note: 'Fixture amount' },
    ] } }
    expect(sanctionCommands(breach(law), law).map(c => c.type)).toEqual(['transfer', 'pay'])
    law.consequence = { kind: 'sanctions', sanctions: [] }
    expect(sanctionCommands(breach(law), law)).toEqual([])
  })
  it('transitions deep-copy prescribed sanctions so later records cannot change earlier ones', () => {
    const law: Law = { ...lawFixture(), consequence: { kind: 'sanctions', sanctions: [{ kind: 'fine', amount: 2, note: 'Fixture amount' }] } }
    const initial = breach(law)
    const detected = detect(initial, 'office.reeve')
    detected.sanction![0].amount = 3
    expect(initial.sanction![0].amount).toBe(2)
  })
  it('a command cannot be generated from an unrelated law', () => {
    expect(() => sanctionCommands(breach(), lawFixture('other'))).toThrow(/does not refer/)
  })
})
