import { describe, expect, it, vi } from 'vitest'
import { evaluatePredicate, predicateReads, validatePredicate } from '../src/index.ts'
import type { Predicate, PredicateOperator, PredicateScalar } from '../src/index.ts'

const leaf = (op: PredicateOperator, value: PredicateScalar | PredicateScalar[]): Predicate => ({ read: 'port.value', op, value })

describe('predicate evaluation', () => {
  it('evaluates true without reading a port', () => {
    const facts = vi.fn()
    expect(evaluatePredicate(true, facts)).toBe(true)
    expect(facts).not.toHaveBeenCalled()
  })
  it('all requires every child and its empty identity is true', () => {
    expect(evaluatePredicate({ all: [] }, () => undefined)).toBe(true)
    expect(evaluatePredicate({ all: [true, { not: true }] }, () => undefined)).toBe(false)
  })
  it('any requires one child and its empty identity is false', () => {
    expect(evaluatePredicate({ any: [] }, () => undefined)).toBe(false)
    expect(evaluatePredicate({ any: [{ not: true }, true] }, () => undefined)).toBe(true)
  })
  it('not negates a nested predicate', () => expect(evaluatePredicate({ not: { not: true } }, () => undefined)).toBe(true))
  it('logical evaluation short-circuits unused reads', () => {
    const facts = vi.fn()
    expect(evaluatePredicate({ any: [true, leaf('eq', 1)] }, facts)).toBe(true)
    expect(evaluatePredicate({ all: [{ not: true }, leaf('eq', 1)] }, facts)).toBe(false)
    expect(facts).not.toHaveBeenCalled()
  })
  it.each<[PredicateOperator, number, number, boolean]>([
    ['eq', 3, 3, true], ['eq', 3, 4, false], ['ne', 3, 4, true], ['ne', 3, 3, false],
    ['lt', 2, 3, true], ['lt', 3, 3, false], ['lte', 3, 3, true], ['lte', 4, 3, false],
    ['gt', 4, 3, true], ['gt', 3, 3, false], ['gte', 3, 3, true], ['gte', 2, 3, false],
  ])('%s compares %s to %s as %s', (op, actual, expected, result) => expect(evaluatePredicate(leaf(op, expected), () => actual)).toBe(result))
  it.each(['text', true, false, null])('eq and ne compare matching scalar type %j', value => {
    expect(evaluatePredicate(leaf('eq', value), () => value)).toBe(true)
    expect(evaluatePredicate(leaf('ne', value), () => value)).toBe(false)
  })
  it('ordered comparisons support strings without locale dependence', () => expect(evaluatePredicate(leaf('lt', 'b'), () => 'a')).toBe(true))
  it('in tests the scalar read against the operand array', () => {
    expect(evaluatePredicate(leaf('in', ['a', 'b']), () => 'a')).toBe(true)
    expect(evaluatePredicate(leaf('in', ['a', 'b']), () => 'c')).toBe(false)
    expect(evaluatePredicate(leaf('in', []), () => 1)).toBe(false)
  })
  it('has tests the array read for the scalar operand', () => {
    expect(evaluatePredicate(leaf('has', 'a'), () => ['a', 'b'])).toBe(true)
    expect(evaluatePredicate(leaf('has', 'c'), () => ['a', 'b'])).toBe(false)
    expect(evaluatePredicate(leaf('has', 'a'), () => [])).toBe(false)
  })
  it('throws naming the read when a port returns undefined', () => expect(() => evaluatePredicate(leaf('eq', 1), () => undefined)).toThrow(/port.value.*undefined/))
  it('throws naming the read for an unknown operator', () => expect(() => evaluatePredicate({ read: 'port.value', op: 'eval', value: 1 } as unknown as Predicate, () => 1)).toThrow(/port.value.*unknown op/))
  it.each<[PredicateOperator, PredicateScalar | PredicateScalar[], unknown]>([
    ['eq', 1, '1'], ['ne', true, 1], ['eq', null, false], ['lt', 1, '2'], ['gte', '2', 2],
    ['eq', 1, {}], ['eq', 1, [1]], ['eq', 1, NaN], ['eq', 1, Infinity],
    ['in', [1], '1'], ['in', [1], [1]], ['has', 1, 1], ['has', 1, [1, '1']], ['has', 1, [1, {}]],
  ])('throws naming the read on %s type mismatch (%j, %j)', (op, value, fact) => expect(() => evaluatePredicate(leaf(op, value), () => fact)).toThrow(/port.value.*type mismatch/))
  it('uses caller facts on every evaluation without caching state', () => {
    const p = leaf('eq', 1)
    expect(evaluatePredicate(p, () => 1)).toBe(true)
    expect(evaluatePredicate(p, () => 2)).toBe(false)
  })
  it('predicateReads returns sorted unique names from every branch', () => {
    const p: Predicate = { any: [true, { all: [{ read: 'z', op: 'eq', value: 1 }, { not: { read: 'a', op: 'eq', value: 2 } }, { read: 'z', op: 'has', value: 3 }] }] }
    expect(predicateReads(p)).toEqual(['a', 'z'])
    expect(predicateReads(true)).toEqual([])
  })
})

describe('closed predicate grammar', () => {
  it.each([false, null, 'code', [], {}, { all: true }, { any: {} }, { not: false }, { all: [], any: [] },
    { read: 'x', op: 'eq' }, { read: 'x', op: 'eq', value: 1, code: 'run' },
    { read: '', op: 'eq', value: 1 }, { read: 1, op: 'eq', value: 1 },
    { read: 'x', op: 'unknown', value: 1 }, { read: 'x', op: 'eq', value: {} },
    { read: 'x', op: 'eq', value: Infinity }, { read: 'x', op: 'in', value: 1 },
    { read: 'x', op: 'in', value: [1, '1'] }, { read: 'x', op: 'has', value: [1] },
    { read: 'x', op: 'lt', value: true }, { read: 'x', op: 'gt', value: null },
  ])('rejects expressions outside the closed grammar: %j', value => {
    expect(validatePredicate(value).length).toBeGreaterThan(0)
    expect(() => evaluatePredicate(value as Predicate, () => 1)).toThrow()
    expect(() => predicateReads(value as Predicate)).toThrow()
  })
  it('rejects cyclic predicates without overflowing', () => {
    const p: { not?: unknown } = {}
    p.not = p
    expect(validatePredicate(p)).toEqual(['predicate.not: cyclic predicate is not JSON data'])
  })
  it('reports non-string read names even when the invalid value is cyclic', () => {
    const read: { self?: unknown } = {}
    read.self = read
    expect(validatePredicate({ read, op: 'eq', value: 1 })).toEqual(['predicate (read <invalid>): expected non-empty read name'])
  })
  it('allows shared subexpressions without treating them as cycles', () => {
    const p = leaf('eq', 1)
    expect(validatePredicate({ all: [p, p] })).toEqual([])
  })
  it('sorts failures from nested predicates', () => {
    const errors = validatePredicate({ all: [{ read: '', op: 'bad', value: 1 }, false] })
    expect(errors.length).toBe(3)
    expect(errors).toEqual([...errors].sort())
  })
})
