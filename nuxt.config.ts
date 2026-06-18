// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
  ],
  devtools: { enabled: true },

  // Secrets are read + validated server-side via server/utils/env.ts (works in
  // both the Nitro server and the standalone worker). Nothing secret is ever
  // placed in runtimeConfig.public.
  runtimeConfig: {},
  compatibilityDate: '2025-07-15',

  nitro: {
    // Enable Nitro tasks + a nightly incremental re-sync (03:00). The task
    // queues a job the standalone worker drains.
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '0 3 * * *': ['resync'],
    },
    // Same unused/unread enforcement for the server tsconfig (the app config is
    // covered via `typescript.tsConfig` above).
    typescript: {
      tsConfig: {
        compilerOptions: {
          noUnusedLocals: true,
          noUnusedParameters: true,
        },
      },
    },
  },

  typescript: {
    strict: true,
    // Type-checking runs out-of-band via `pnpm typecheck` (nuxt typecheck) so
    // dev/build stay fast; CI and the Docker build gate on it.
    typeCheck: false,
    // Flag declared-but-never-read locals and parameters at type-check time —
    // the "unread value" class ESLint's no-unused-vars cannot see (e.g. a
    // template-only ref). Merged into the generated tsconfigs.
    tsConfig: {
      compilerOptions: {
        noUnusedLocals: true,
        noUnusedParameters: true,
      },
    },
  },

  // Lint config is authored in TypeScript (eslint.config.ts); enable the
  // built-in @stylistic formatting rules so formatting is lint-driven.
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
