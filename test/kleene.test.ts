import { describe, expect, it, vi } from 'vitest'
import { and3, or3, not3, evaluatePredicate, evaluatePredicateKleene } from '../src/index.ts'
import type { Predicate, PredicateOperator, Truth } from '../src/index.ts'

const leaf = (read = 'x', op: PredicateOperator = 'eq', value: boolean | number | string = true): Predicate => ({ read, op, value })
const yes: Truth = { value: 'true', reads: [] }
const no: Truth = { value: 'false', reads: [] }
const missing: Truth = { value: 'unknown', reads: ['x'] }

describe('strong Kleene predicate evaluation', () => {
  it('(k1) null is unknown for every operator, including null eq null', () => {
    for (const op of ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'has'] as const) {
      expect(evaluatePredicateKleene({ read: 'x', op, value: op === 'in' ? [1] : 1 }, () => null)).toEqual(missing)
    }
    expect(evaluatePredicateKleene({ read: 'x', op: 'eq', value: null }, () => null)).toEqual(missing)
  })

  it('(k2) empty strings and lists are known values', () => {
    expect(evaluatePredicateKleene(leaf('x', 'eq', ''), () => '')).toEqual(yes)
    expect(evaluatePredicateKleene(leaf('x', 'has', 'grant'), () => [])).toEqual(no)
    expect(evaluatePredicateKleene({ read: 'x', op: 'in', value: [] }, () => '')).toEqual(no)
  })

  it('(k3) false dominates all, otherwise unknown survives true children', () => {
    expect(evaluatePredicateKleene({ all: [leaf(), { not: true }] }, () => null)).toEqual(no)
    expect(evaluatePredicateKleene({ all: [true, leaf(), true] }, () => null)).toEqual(missing)
    const read = vi.fn(() => null)
    expect(evaluatePredicateKleene({ all: [{ not: true }, leaf()] }, read)).toEqual(no)
    expect(read).not.toHaveBeenCalled()
    expect(and3(missing, no)).toEqual(no)
    expect(and3(yes, missing)).toEqual(missing)
    expect(and3()).toEqual(yes)
  })

  it('(k4) true dominates any, otherwise unknown survives false children', () => {
    expect(evaluatePredicateKleene({ any: [leaf(), true] }, () => null)).toEqual(yes)
    expect(evaluatePredicateKleene({ any: [{ not: true }, leaf()] }, () => null)).toEqual(missing)
    const read = vi.fn(() => null)
    expect(evaluatePredicateKleene({ any: [true, leaf()] }, read)).toEqual(yes)
    expect(read).not.toHaveBeenCalled()
    expect(or3(missing, yes)).toEqual(yes)
    expect(or3(no, missing)).toEqual(missing)
    expect(or3()).toEqual(no)
  })

  it('(k5) negation preserves unknown reads and unions sort and de-duplicate them', () => {
    expect(evaluatePredicateKleene({ not: leaf() }, () => null)).toEqual(missing)
    for (const p of [{ all: [leaf('z'), leaf('a'), leaf('z')] }, { any: [leaf('z'), leaf('a'), leaf('z')] }]) {
      expect(evaluatePredicateKleene(p, () => null)).toEqual({ value: 'unknown', reads: ['a', 'z'] })
    }
    const z: Truth = { value: 'unknown', reads: ['z'] }
    expect(and3(z, missing, z)).toEqual({ value: 'unknown', reads: ['x', 'z'] })
    expect(or3(z, missing, z)).toEqual({ value: 'unknown', reads: ['x', 'z'] })
    expect(not3(missing)).toEqual(missing)
    expect(not3(yes)).toEqual(no)
    expect(not3(no)).toEqual(yes)
  })

  it('(k6) undefined and non-null type mismatches retain existing errors', () => {
    expect(() => evaluatePredicateKleene(leaf(), () => undefined)).toThrow('read "x": returned undefined')
    expect(() => evaluatePredicateKleene(leaf('x', 'eq', 1), () => '1')).toThrow('read "x": type mismatch for eq')
    expect(() => evaluatePredicateKleene(leaf('x', 'has', 1), () => ['1']))
      .toThrow('read "x": type mismatch for has; expected a scalar and an array of the same scalar type')
    const read = vi.fn()
    const invalid = { any: [true, { read: 'x', op: 'unknown', value: 1 }] } as unknown as Predicate
    expect(() => evaluatePredicateKleene(invalid, read)).toThrow('unknown op unknown')
    expect(read).not.toHaveBeenCalled()
  })

  it('(k7) complete facts agree with the two-valued evaluator over every operator and nesting', () => {
    const values: Record<string, unknown> = { x: 2, word: 'b', items: ['a', 'b'] }
    const facts = (name: string) => values[name]
    const predicates: Predicate[] = [
      true, { all: [] }, { any: [] },
      leaf('x', 'eq', 2), leaf('x', 'eq', 3), leaf('x', 'ne', 2), leaf('x', 'ne', 3),
      leaf('x', 'lt', 3), leaf('x', 'lte', 2), leaf('x', 'gt', 3), leaf('x', 'gte', 2),
      leaf('word', 'lt', 'c'), leaf('word', 'gte', 'c'),
      { read: 'x', op: 'in', value: [1, 2] }, { read: 'x', op: 'in', value: [] },
      leaf('items', 'has', 'b'), leaf('items', 'has', 'c'),
      { all: [leaf('x', 'eq', 2), leaf('word', 'eq', 'b')] },
      { any: [leaf('x', 'eq', 3), leaf('word', 'eq', 'b')] },
      { not: leaf('x', 'eq', 2) },
      { not: { all: [true, { any: [leaf('x', 'eq', 3), { not: leaf('word', 'eq', 'c') }] }] } },
    ]
    for (const p of predicates) {
      expect(evaluatePredicateKleene(p, facts)).toEqual({ value: String(evaluatePredicate(p, facts)), reads: [] })
    }
  })
})
