import { fileURLToPath } from 'node:url'
import { checkProcedures, loadProcedures } from '../src/law/procedure.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
try {
  const loaded = loadProcedures(root)
  const failures = checkProcedures(loaded)
  if (failures.length) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  } else console.log(`procedures: ${loaded.procedures.length} records, 0 failures`)
} catch (error) {
  console.error(`procedures: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
