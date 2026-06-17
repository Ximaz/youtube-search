import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { channels } from './channels'

// Singleton: the one connected YouTube account (self-hosted, single-user).
export const oauthAccount = pgTable('oauth_account', {
  id: integer().primaryKey().default(1),
  googleSub: text(),
  email: text(),
  ownChannelId: text().references(() => channels.id), // basis for own-comment matching
  // AES-256-GCM packed blob (nonce | tag | ciphertext), base64-encoded.
  refreshTokenEnc: text(),
  accessToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  tokenInvalid: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, () => [
  check('oauth_account_singleton', sql`id = 1`),
])
