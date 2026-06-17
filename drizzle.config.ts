import { defineConfig } from 'drizzle-kit'

// `generate` works offline (diffs schema vs snapshots); `migrate` needs the DB.
// Migrations are also applied programmatically on app boot (see the migrate
// plugin) — this config backs the `pnpm db:generate` / `pnpm db:migrate` CLIs.
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/index.ts',
  out: './server/database/migrations',
  casing: 'snake_case',
  // Timestamp-prefixed migration filenames (collision-free across branches).
  migrations: {
    prefix: 'timestamp',
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
})
