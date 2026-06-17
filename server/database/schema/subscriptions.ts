import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { channels } from './channels'

// The authenticated user's own subscriptions (page-all + cache). Subscribe
// status is answered locally from this table; `subscribed=false` soft-deletes
// rows that disappear on re-sync.
export const subscriptions = pgTable('subscriptions', {
  channelId: text().primaryKey().references(() => channels.id, { onDelete: 'cascade' }),
  subscribed: boolean().notNull().default(true),
  lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
