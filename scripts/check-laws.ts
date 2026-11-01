import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { checkLaws, loadLaws } from '../src/law/load.ts'
import { toDay } from './calendar.ts'
import { loadProcedures } from '../src/law/procedure.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
try {
  const loaded = loadLaws(root, toDay)
  let reads: string[] = []
  try {
    reads = readFileSync(new URL('../data/laws/READS.md', import.meta.url), 'utf8')
      .split(/\r?\n/).map(line => line.split(' — ')[0]).filter(Boolean)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const failures = checkLaws(loaded, loadProcedures(root), reads)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else console.log(`laws: ${loaded.laws.length} records, 0 failures`)
} catch (error) {
  console.error(`laws: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
