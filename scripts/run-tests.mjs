import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const directory = '.test-build'
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  return result.status ?? 1
}

try {
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
  writeFileSync(directory + '/package.json', '{"type":"commonjs"}\n')
  const compile = run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'])
  process.exitCode = compile || run(['--test', 'tests/round.test.cjs'])
} finally {
  rmSync(directory, { recursive: true, force: true })
}
