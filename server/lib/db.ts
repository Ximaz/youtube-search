import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'
import { useEnv } from './env'

// `casing: 'snake_case'` makes runtime query-building map camelCase schema keys
// to the snake_case columns the migrations created.
function createDb() {
  const sql = postgres(useEnv().DATABASE_URL, { max: 10 })
  return drizzle(sql, { schema, casing: 'snake_case' })
}

export type Database = ReturnType<typeof createDb>

let cached: Database | null = null

export function useDb(): Database {
  if (!cached) cached = createDb()
  return cached
}
