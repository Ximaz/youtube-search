// Provides a complete, valid environment so server/lib modules that call
// useEnv() work in unit tests without real services.
process.env.NODE_ENV ||= 'test'
process.env.DATABASE_URL ||= 'postgresql://app:devpassword@localhost:5432/youtube_search'
process.env.CACHE_URL ||= 'redis://app:devpassword@localhost:6379'
process.env.STORAGE_URL ||= 's3://devaccesskey:devsecretkey0123456789@localhost:8333/youtube-search?region=us-east-1'
process.env.APP_ENCRYPTION_KEY ||= 'test-encryption-key-0123456789-abcdefghij'
process.env.APP_PASSWORD ||= 'devpassword'
process.env.GOOGLE_CLIENT_ID ||= 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET ||= 'test-client-secret'
process.env.OAUTH_REDIRECT_URI ||= 'http://localhost:3000/api/auth/callback'
