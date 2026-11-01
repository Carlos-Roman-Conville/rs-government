import { listSourceFiles, scanNoMeter } from '../src/nometer.ts'

const root = process.argv[2]
if (!root) {
  console.error('usage: no-meter.ts <root>')
  process.exit(2)
}

const failures = scanNoMeter(root)
if (failures.length > 0) {
  for (const f of failures) console.log(f)
  console.log(`no-meter: ${failures.length} failures`)
  process.exit(1)
}
console.log(`no-meter: ${listSourceFiles(root).length} files scanned, 0 failures`)
