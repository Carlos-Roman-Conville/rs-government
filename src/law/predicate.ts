/** Values crossing a predicate port are JSON scalars or arrays of scalars. */
export type PredicateScalar = string | number | boolean | null
export type PredicateOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'has'
export type Predicate = true | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate }
  | { read: string; op: PredicateOperator; value: PredicateScalar | PredicateScalar[] }
export type PredicateFacts = (name: string) => unknown

const operators: readonly string[] = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'has']
const ordered = ['lt', 'lte', 'gt', 'gte']
const scalar = (value: unknown): value is PredicateScalar => value === null
  || typeof value === 'string' || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
const kind = (value: PredicateScalar) => value === null ? 'null' : typeof value

/** Validate the closed JSON grammar, including operator operand types. */
export function validatePredicate(value: unknown, path = 'predicate'): string[] {
  const failures: string[] = []
  const ancestors = new Set<object>()
  function visit(p: unknown, at: string): void {
    if (p === true) return
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      failures.push(`${at}: expected true or a predicate object`)
      return
    }
    if (ancestors.has(p)) {
      failures.push(`${at}: cyclic predicate is not JSON data`)
      return
    }
    ancestors.add(p)
    const row = p as Record<string, unknown>
    const keys = Object.keys(row).sort().join(',')
    if (keys === 'all' || keys === 'any') {
      const name = keys
      if (!Array.isArray(row[name])) failures.push(`${at}.${name}: expected array`)
      else row[name].forEach((child, i) => visit(child, `${at}.${name}[${i}]`))
    } else if (keys === 'not') visit(row.not, `${at}.not`)
    else if (keys === 'op,read,value') {
      const label = `${at} (read ${typeof row.read === 'string' ? JSON.stringify(row.read) : '<invalid>'})`
      if (typeof row.read !== 'string' || !row.read.trim()) failures.push(`${label}: expected non-empty read name`)
      if (typeof row.op !== 'string' || !operators.includes(row.op)) failures.push(`${label}: unknown op ${typeof row.op === 'string' ? row.op : '<invalid>'}`)
      else if (row.op === 'in') {
        if (!Array.isArray(row.value) || !row.value.every(scalar)
          || row.value.some(v => kind(v) !== kind((row.value as PredicateScalar[])[0]))) {
          failures.push(`${label}: in value must be a homogeneous array of JSON scalars`)
        }
      } else if (ordered.includes(row.op)) {
        if (!(typeof row.value === 'string' || (typeof row.value === 'number' && Number.isFinite(row.value)))) {
          failures.push(`${label}: ordered value must be a finite number or string`)
        }
      } else if (!scalar(row.value)) failures.push(`${label}: value must be a JSON scalar`)
    } else failures.push(`${at}${typeof row.read === 'string' ? ` (read ${JSON.stringify(row.read)})` : ''}: expected exactly all, any, not, or read/op/value`)
    ancestors.delete(p)
  }
  visit(value, path)
  return failures.sort()
}

function assertPredicate(p: Predicate): void {
  const failures = validatePredicate(p)
  if (failures.length) throw new Error(failures.join('\n'))
}

/** Logical operators short-circuit; evaluated reads must exist and never coerce. */
export function evaluatePredicate(p: Predicate, facts: PredicateFacts): boolean {
  assertPredicate(p)
  function evaluate(node: Predicate): boolean {
    if (node === true) return true
    if ('all' in node) return node.all.every(evaluate)
    if ('any' in node) return node.any.some(evaluate)
    if ('not' in node) return !evaluate(node.not)
    const actual = facts(node.read)
    const fail = (message: string): never => { throw new Error(`read ${JSON.stringify(node.read)}: ${message}`) }
    if (actual === undefined) return fail('returned undefined')
    const expected = node.value
    if (node.op === 'in' || node.op === 'has') {
      const list = node.op === 'in' ? expected : actual
      const item = node.op === 'in' ? actual : expected
      if (!Array.isArray(list) || !scalar(item) || !list.every(v => scalar(v) && kind(v) === kind(item))) {
        return fail(`type mismatch for ${node.op}; expected a scalar and an array of the same scalar type`)
      }
      return list.includes(item)
    }
    if (!scalar(actual) || !scalar(expected) || kind(actual) !== kind(expected)) return fail(`type mismatch for ${node.op}`)
    if (node.op === 'eq') return actual === expected
    if (node.op === 'ne') return actual !== expected
    if ((typeof actual === 'number' && typeof expected === 'number')
      || (typeof actual === 'string' && typeof expected === 'string')) {
      switch (node.op) {
        case 'lt': return actual < expected
        case 'lte': return actual <= expected
        case 'gt': return actual > expected
        case 'gte': return actual >= expected
      }
    }
    return fail(`type mismatch for ${node.op}`)
  }
  return evaluate(p)
}

/** Include reads in every branch, even branches skipped during evaluation. */
export function predicateReads(p: Predicate): string[] {
  assertPredicate(p)
  const reads = new Set<string>()
  function visit(node: Predicate): void {
    if (node === true) return
    if ('all' in node) node.all.forEach(visit)
    else if ('any' in node) node.any.forEach(visit)
    else if ('not' in node) visit(node.not)
    else reads.add(node.read)
  }
  visit(p)
  return [...reads].sort()
}
