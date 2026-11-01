import { fileURLToPath } from 'node:url'
import { checkLaws, loadLaws } from '../src/law/load.ts'
import { toDay } from './calendar.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
try {
  const loaded = loadLaws(root, toDay)
  const failures = checkLaws(loaded)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else console.log(`laws: ${loaded.laws.length} records, 0 failures`)
} catch (error) {
  console.error(`laws: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
