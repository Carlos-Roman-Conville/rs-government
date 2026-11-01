import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// The rules, as data. A failure line quotes the rule's reason.
export const NO_METER_RULES = {
  // DESIGN §1.15, §5 GOV-Q1 (Rex 2026-10-31): no government type is assigned, no independently authoritative
  // power score. Legitimacy is an aggregate of beliefs and is computed on demand, never stored.
  storedMeterName: /^(governmentType|regimeType|legitimacy(Score|Meter|Level)?|stability|rebellion(Threshold|Meter)?|powerScore|authorityScore|corruptionRate)$/i,
  // DESIGN §1.2: authority A is computed from laws, recognition and backing; a stored copy would drift from them.
  // DESIGN §1.8: legitimacy R is computed from beliefs; a cache of it is a second source of truth.
  cacheName: /authority|legitimacy/i,
  cacheInitializer: /\bnew\s+(Map|WeakMap|Set|WeakSet)\b|=\s*\{|=\s*\[|Object\.(create|fromEntries)\b/,
} as const

const REASON_FIELD = 'stored meter field (DESIGN §1.15, GOV-Q1: compute it, never store it)'
const REASON_MODULE = 'module-level stored meter (DESIGN §1.15, GOV-Q1: compute it, never store it)'
const REASON_CACHE = 'module-level cache of authority or legitimacy (DESIGN §1.2, §1.8: compute it, never cache it)'

type Kind = 'top' | 'type' | 'class' | 'obj' | 'fn' | 'other'

// Blank comments and string contents, keeping every newline and the quote characters.
function sanitize(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++ }
    } else if (c === '/' && next === '*') {
      out += '  '; i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '; i += 2
    } else if (c === '"' || c === "'" || c === '`') {
      out += c; i++
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { out += ' '; i++ }
        if (src[i] === '\n' && c !== '`') break
        out += src[i] === '\n' ? '\n' : '_'; i++
      }
      out += c; i++
    } else {
      out += c; i++
    }
  }
  return out
}

function classifyBlock(buf: string, parent: Kind, typeContext: boolean): Kind {
  const text = buf.trim()
  if (parent === 'fn') return 'fn'
  if (parent === 'other') return 'other'
  if (/\b(enum|namespace|module)\b/.test(text)) return 'other'
  if (/\binterface\b/.test(text)) return 'type'
  if (/\bclass\b/.test(text)) return 'class'
  const fnLike = /=>|\bfunction\b|\)\s*(:[^{]*)?$/.test(text)
  if (parent === 'top') {
    if (typeContext) return 'type'
    if (fnLike) return 'fn'
    return /=\s*$|\bdefault\s*$/.test(text) ? 'obj' : 'fn'
  }
  if (parent === 'class') return fnLike ? 'fn' : 'obj'
  if (parent === 'type') return 'type'
  return fnLike ? 'fn' : 'obj'
}

function checkSegment(seg: string, kind: Kind, line: number, found: string[]): void {
  const text = seg.replace(/\s+/g, ' ').trim()
  if (!text) return
  if (kind === 'top') {
    const m = /^(?:export\s+)?(?:declare\s+)?(?:let|const|var)\s+([A-Za-z_$][\w$]*)(.*)$/.exec(text)
    if (!m) return
    const [, name, rest] = m as unknown as [string, string, string]
    const isFunction = /=>|\bfunction\b|=\s*(async\s+)?\(\s*$/.test(rest)
    if (isFunction) return
    if (NO_METER_RULES.storedMeterName.test(name)) found.push(`${line}: ${REASON_MODULE}: ${name}`)
    else if (NO_METER_RULES.cacheName.test(name) && NO_METER_RULES.cacheInitializer.test(rest)) {
      found.push(`${line}: ${REASON_CACHE}: ${name}`)
    }
    return
  }
  if (kind !== 'type' && kind !== 'class' && kind !== 'obj') return
  const opens = (text.match(/\(/g) ?? []).length
  const closes = (text.match(/\)/g) ?? []).length
  if (closes > opens) return
  const m = /^(?:(?:public|private|protected|readonly|static|declare)\s+)*["']?([A-Za-z_$][\w$]*)["']?\s*[?!]?\s*([:=])(.*)$/.exec(text)
  if (!m) return
  const [, name, , rest] = m as unknown as [string, string, string, string]
  if (!NO_METER_RULES.storedMeterName.test(name)) return
  if (/=>/.test(rest)) return
  found.push(`${line}: ${REASON_FIELD}: ${name}`)
}

// Returns "line: reason: name" entries for one source text.
export function scanSource(source: string): string[] {
  const src = sanitize(source)
  const found: string[] = []
  const stack: Kind[] = []
  let buf = ''
  let segKind: Kind = 'top'
  let segLine = 1
  let line = 1
  let typeContext = false
  const top = (): Kind => stack[stack.length - 1] ?? 'top'
  const flush = (): void => {
    checkSegment(buf, segKind, segLine, found)
    buf = ''
    segKind = top()
    segLine = line
  }
  for (const c of src) {
    if (c === '{') {
      if (stack.length === 0) {
        if (/^\s*(export\s+)?type\s/.test(buf)) typeContext = true
      }
      checkSegment(`${buf}{`, segKind, segLine, found)
      stack.push(classifyBlock(buf, top(), typeContext && stack.length === 0))
      buf = ''; segKind = top(); segLine = line
    } else if (c === '}') {
      checkSegment(buf, segKind, segLine, found)
      stack.pop()
      buf = ''; segKind = top(); segLine = line
    } else if (c === ';' || (c === ',' && segKind !== 'top')) {
      flush()
    } else if (c === '\n') {
      if (stack.length === 0) {
        const t = buf.trim()
        if (/^(export\s+)?(declare\s+)?type\s/.test(t)) typeContext = true
        else if (/^(export|const|let|var|function|class|interface|import|enum|async|declare)\b/.test(t)) typeContext = false
      }
      flush()
      line++
      segLine = line
    } else {
      if (buf === '' && /\S/.test(c)) segLine = line
      buf += c
    }
  }
  checkSegment(buf, segKind, segLine, found)
  return found
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
}

export function listSourceFiles(root: string): string[] {
  const src = join(root, 'src')
  const out: string[] = []
  if (existsSync(src)) walk(src, out)
  return out
}

// Sorted failure lines `file:line: <reason>` for every .ts file under <root>/src.
export function scanNoMeter(root: string): string[] {
  const failures: string[] = []
  for (const file of listSourceFiles(root)) {
    const rel = relative(root, file).split('\\').join('/')
    for (const f of scanSource(readFileSync(file, 'utf8'))) failures.push(`${rel}:${f}`)
  }
  return failures.sort()
}
