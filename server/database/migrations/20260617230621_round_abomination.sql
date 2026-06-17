-- Immutable wrapper (hand-added): array_to_string is only STABLE, so it can't be
-- used directly in a generated column. Joining a text[] with a constant
-- separator is genuinely deterministic, so an IMMUTABLE wrapper is safe.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[]) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;--> statement-breakpoint
DROP INDEX "channels_title_trgm_idx";--> statement-breakpoint
DROP INDEX "videos_title_trgm_idx";--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "title_norm_text" text GENERATED ALWAYS AS (immutable_array_to_string(title_norm)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "title_norm_text" text GENERATED ALWAYS AS (immutable_array_to_string(title_norm)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "description_norm_text" text GENERATED ALWAYS AS (immutable_array_to_string(description_norm)) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "channels_title_norm_text_trgm_idx" ON "channels" USING gin ("title_norm_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "videos_title_norm_text_trgm_idx" ON "videos" USING gin ("title_norm_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "videos_description_norm_text_trgm_idx" ON "videos" USING gin ("description_norm_text" gin_trgm_ops);