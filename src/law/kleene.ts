import { evaluatePredicate, validatePredicate } from './predicate.ts'
import type { Predicate, PredicateFacts } from './predicate.ts'

export type Kleene = 'true' | 'false' | 'unknown'
/** Only unknown results carry reads, sorted and de-duplicated. */
export interface Truth { value: Kleene; reads: string[] }

function combine(truths: readonly Truth[], dominating: 'true' | 'false'): Truth {
  const reads = new Set<string>()
  for (const truth of truths) {
    if (truth.value === dominating) return { value: dominating, reads: [] }
    if (truth.value === 'unknown') truth.reads.forEach(read => reads.add(read))
  }
  return reads.size ? { value: 'unknown', reads: [...reads].sort() }
    : { value: dominating === 'false' ? 'true' : 'false', reads: [] }
}

export function and3(...truths: Truth[]): Truth { return combine(truths, 'false') }
export function or3(...truths: Truth[]): Truth { return combine(truths, 'true') }
export function not3(truth: Truth): Truth {
  return truth.value === 'unknown' ? { value: 'unknown', reads: [...new Set(truth.reads)].sort() }
    : { value: truth.value === 'true' ? 'false' : 'true', reads: [] }
}

/** Validate before reading; null is missing, while known leaves retain existing comparisons. */
export function evaluatePredicateKleene(p: Predicate, facts: PredicateFacts): Truth {
  const failures = validatePredicate(p)
  if (failures.length) throw new Error(failures.join('\n'))
  function evaluate(node: Predicate): Truth {
    if (node === true) return and3()
    if ('all' in node || 'any' in node) {
      const conjunction = 'all' in node
      const children = 'all' in node ? node.all : node.any
      const truths: Truth[] = []
      for (const child of children) {
        const truth = evaluate(child)
        if (truth.value === (conjunction ? 'false' : 'true')) return truth
        truths.push(truth)
      }
      return conjunction ? and3(...truths) : or3(...truths)
    }
    if ('not' in node) return not3(evaluate(node.not))
    const actual = facts(node.read)
    if (actual === null) return { value: 'unknown', reads: [node.read] }
    return { value: evaluatePredicate(node, () => actual) ? 'true' : 'false', reads: [] }
  }
  return evaluate(p)
}
