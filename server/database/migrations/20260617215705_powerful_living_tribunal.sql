-- Extensions (hand-added): pgvector for vector(512) columns, pg_trgm for the
-- gin_trgm_ops fuzzy-text indexes. bit_count()/tsvector are core in PG14+.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "oauth_account" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"google_sub" text,
	"email" text,
	"own_channel_id" text,
	"refresh_token_enc" text,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"token_invalid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_account_singleton" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_norm" text[] DEFAULT '{}'::text[] NOT NULL,
	"handle" text,
	"description" text,
	"subscriber_count" bigint,
	"subscriber_count_hidden" boolean DEFAULT false NOT NULL,
	"subscriber_floor_sigfig" smallint DEFAULT 3 NOT NULL,
	"video_count" bigint,
	"view_count" bigint,
	"avatar_phash" bit(64),
	"avatar_clip" vector(512),
	"avatar_s3_key" text,
	"avatar_source_res" text,
	"etag" text,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text,
	"title" text NOT NULL,
	"title_norm" text[] DEFAULT '{}'::text[] NOT NULL,
	"title_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, ''))) STORED NOT NULL,
	"description" text,
	"description_norm" text[] DEFAULT '{}'::text[] NOT NULL,
	"description_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(description, ''))) STORED NOT NULL,
	"published_at" timestamp with time zone,
	"duration_seconds" integer,
	"is_live_or_upcoming" boolean DEFAULT false NOT NULL,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint,
	"stats_hidden" boolean DEFAULT false NOT NULL,
	"thumb_phash" bit(64),
	"thumb_clip" vector(512),
	"thumb_s3_key" text,
	"thumb_source_res" text,
	"comments_scanned_at" timestamp with time zone,
	"comments_disabled" boolean DEFAULT false NOT NULL,
	"privacy_status" text,
	"deleted_from_youtube" boolean DEFAULT false NOT NULL,
	"etag" text,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"privacy_status" text,
	"kind" text DEFAULT 'user' NOT NULL,
	"item_count" integer,
	"etag" text,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"playlist_id" text NOT NULL,
	"video_id" text NOT NULL,
	"position" integer,
	"added_at" timestamp with time zone,
	"playlist_item_id" text,
	CONSTRAINT "playlist_items_playlist_video_uniq" UNIQUE("playlist_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"parent_id" text,
	"author_channel_id" text NOT NULL,
	"text_display" text NOT NULL,
	"text_norm" text[] DEFAULT '{}'::text[] NOT NULL,
	"text_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text_display, ''))) STORED NOT NULL,
	"published_at" timestamp with time zone,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_blobs" (
	"s3_key" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"resolution" text NOT NULL,
	"source_url" text NOT NULL,
	"phash" bit(64),
	"dhash" bit(64),
	"content_type" text,
	"bytes" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"phase" text DEFAULT 'idle' NOT NULL,
	"current_playlist_id" text,
	"page_token" text,
	"pending_video_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"pending_channel_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"likes_cap_hit" boolean DEFAULT false NOT NULL,
	"last_full_sync_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_singleton" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_own_channel_id_channels_id_fk" FOREIGN KEY ("own_channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_title_norm_idx" ON "channels" USING gin ("title_norm");--> statement-breakpoint
CREATE INDEX "channels_title_trgm_idx" ON "channels" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "channels_subscriber_count_idx" ON "channels" USING btree ("subscriber_count");--> statement-breakpoint
CREATE INDEX "videos_title_norm_idx" ON "videos" USING gin ("title_norm");--> statement-breakpoint
CREATE INDEX "videos_description_norm_idx" ON "videos" USING gin ("description_norm");--> statement-breakpoint
CREATE INDEX "videos_title_tsv_idx" ON "videos" USING gin ("title_tsv");--> statement-breakpoint
CREATE INDEX "videos_description_tsv_idx" ON "videos" USING gin ("description_tsv");--> statement-breakpoint
CREATE INDEX "videos_title_trgm_idx" ON "videos" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "videos_published_at_idx" ON "videos" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "videos_view_count_idx" ON "videos" USING btree ("view_count");--> statement-breakpoint
CREATE INDEX "videos_like_count_idx" ON "videos" USING btree ("like_count");--> statement-breakpoint
CREATE INDEX "videos_comment_count_idx" ON "videos" USING btree ("comment_count");--> statement-breakpoint
CREATE INDEX "videos_duration_idx" ON "videos" USING btree ("duration_seconds");--> statement-breakpoint
CREATE INDEX "videos_channel_id_idx" ON "videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "playlists_kind_idx" ON "playlists" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "playlist_items_video_id_idx" ON "playlist_items" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "playlist_items_playlist_id_idx" ON "playlist_items" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "video_comments_text_norm_idx" ON "video_comments" USING gin ("text_norm");--> statement-breakpoint
CREATE INDEX "video_comments_text_tsv_idx" ON "video_comments" USING gin ("text_tsv");--> statement-breakpoint
CREATE INDEX "video_comments_video_id_idx" ON "video_comments" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "image_blobs_entity_idx" ON "image_blobs" USING btree ("entity_type","entity_id");