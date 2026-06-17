// Fails (exit 1) if any plain JavaScript file exists in source. TypeScript-only
// source is a hard project rule; generated build artifacts are exempt.
//
// Run by CI, the Docker build stage, and the pre-push git hook.
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

const IGNORED_DIRS = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  '.output-worker',
  '.nitro',
  '.cache',
  '.data',
  'dist',
  'coverage',
  '.git',
])

const FORBIDDEN = /\.(js|mjs|cjs)$/

const offenders: string[] = []

function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      walk(join(dir, entry.name))
    }
    else if (FORBIDDEN.test(entry.name)) {
      offenders.push(relative(ROOT, join(dir, entry.name)))
    }
  }
}

walk(ROOT)

if (offenders.length > 0) {
  console.error('✖ Forbidden JavaScript files in source (this is a TypeScript-only project):')
  for (const file of offenders) console.error(`  - ${file}`)
  console.error('\nRewrite these as .ts, or move generated artifacts into an ignored directory.')
  process.exit(1)
}

console.log('✓ No JavaScript files in source.')
