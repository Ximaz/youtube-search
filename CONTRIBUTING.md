# Contributing to YouTube Deep-Search

Thanks for taking the time to contribute! This is a small, self-hosted,
privacy-first project, and the bar for changes is simple: keep it focused, keep
it typed, and don't break the "your data never leaves your machine" promise.

This guide explains how to set up the project, the standards your changes need to
meet, and how to get them reviewed and merged.

---

## Code of conduct

Be respectful and assume good faith. Keep discussion technical and on-topic.
Harassment or abuse of any kind isn't welcome here.

---

## Ways to contribute

- **Report a bug** — open a [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Suggest a feature** — open a
  [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Improve the docs** — typos, clarifications and missing steps are all welcome.
- **Send code** — fixes and features via a pull request.

> **Open an issue before large changes.** For anything beyond a small fix, please
> open (or comment on) an issue first so we can agree on the approach before you
> invest time. This mirrors the project's working rule: *if a change is
> ambiguous, ask — don't silently pick a direction.*

---

## Project philosophy

A few principles guide what gets merged:

- **Minimal diff.** Touch only what the change requires. If you find yourself
  wanting to widen the scope, raise it in the issue/PR first.
- **No speculative features.** Add code for a need that exists now, not one that
  might exist later.
- **Read-only on the user's account, local-only for their data.** Nothing should
  ever write to a user's YouTube account, and no user data should leave their
  machine.
- **TypeScript everywhere.** The source tree is TypeScript-only by rule (see
  below).

---

## Development setup

### Prerequisites

- **Node.js >= 22** (the repo is tested on Node 22).
- **pnpm 10** — enable it with Corepack: `corepack enable`.
- **Docker + Docker Compose** — to run the backing services (PostgreSQL with
  `pgvector`, Valkey, SeaweedFS).
- **A Google Cloud OAuth client** if you want to exercise the YouTube sync.
  Follow [the README's "Get YouTube API credentials" section](README.md#1-get-youtube-api-credentials).

### 1. Install dependencies

```bash
pnpm install
```

`postinstall` runs `nuxt prepare` (which generates types and the Nuxt-aware
ESLint config) and installs the Git hooks via lefthook.

### 2. Configure secrets

Secrets live under `secrets/`, split by concern. Copy each example and fill it in
— see [the README's "Configure secrets" section](README.md#2-configure-secrets)
for what each value means:

```bash
cp secrets/database/database.env.example secrets/database/database.env
cp secrets/cache/cache.env.example       secrets/cache/cache.env
cp secrets/storage/storage.env.example   secrets/storage/storage.env
cp secrets/app/app.env.example           secrets/app/app.env
```

Those four files are read by Docker Compose. To run the **app and worker from
source** (steps 3–4) you also need a root `.env` — the same settings, but with
the hosts pointing at the services exposed on `localhost`:

```bash
cp .env.example .env
```

Keep the credentials in `.env` in sync with the `database`/`cache`/`storage`
secrets above.

### 3. Start the backing services

Run just the infrastructure in Docker, and run the app/worker from source so you
get hot reload:

```bash
docker compose up -d database cache storage
```

### 4. Run the app and worker

```bash
pnpm dev          # Nuxt dev server on http://localhost:3000
pnpm worker:dev   # the ingestion / image-hashing worker (separate terminal)
```

Database migrations are applied automatically at app boot, so there's nothing to
run by hand. If you change the Drizzle schema, generate a new migration with
`pnpm db:generate` and commit the produced SQL.

---

## Coding standards

### TypeScript only

The source tree is **TypeScript-only** — no `.js`/`.mjs`/`.cjs` source files
(config like `eslint.config.ts` is authored in TS and loaded via jiti).
`pnpm check:no-js` enforces this in CI.

### Formatting & linting

Formatting is owned by **ESLint** (`@stylistic`), not a separate formatter. The
rules that matter most:

- **single quotes**, **no semicolons**, **2-space indent** (see `.editorconfig`).
- **No unused bindings** (`@typescript-eslint/no-unused-vars` is an error). If a
  binding is intentionally unused, prefix it with `_` (e.g. `_event`).

Fix everything auto-fixable with:

```bash
pnpm lint:fix
```

If you use VS Code, the workspace settings already make ESLint the formatter and
fix on save (install the recommended `dbaeumer.vscode-eslint` extension).

### Internationalisation (i18n)

The UI is fully translated. **Any user-facing string must be added to every
locale.** `app/i18n/locales/en.ts` is the source of truth — its shape defines the
`Messages` type, and `fr.ts` must satisfy that type, so a missing French key
fails `pnpm typecheck`. Add your key to `en.ts` first, then translate it in
`fr.ts`.

### Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Use a type prefix and an imperative summary:

```
feat: add duration tolerance to the search filters
fix: request the comments scope during OAuth
docs: document the local dev setup
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.

---

## Git hooks

lefthook is installed during `pnpm install` and runs automatically:

- **pre-commit** — `lint-staged` (ESLint `--fix` on staged `.ts/.vue/.json/.yml`).
- **pre-push** — `typecheck`, `check:no-js`, and `test` in parallel.

If a hook blocks a push, run the failing command locally to see the details. Only
bypass hooks (`--no-verify`) when you have a genuine reason — CI runs the same
checks and will fail anyway.

---

## Before you open a pull request

Run the same gate CI runs:

```bash
pnpm verify   # lint + typecheck + check:no-js
pnpm test     # vitest
pnpm build    # nuxt build
```

If you touched the worker, also run `pnpm build:worker`.

A good PR:

- targets `main` and is focused on a single concern;
- keeps the diff minimal and avoids unrelated reformatting;
- updates docs (README/this file) when behaviour or setup changes;
- adds or updates tests under `test/` when it changes logic;
- adds both EN and FR strings for any new UI text.

When you open the PR, the
[pull request template](.github/PULL_REQUEST_TEMPLATE.md) walks you through a
short checklist. CI will run lint, typecheck, the TypeScript-only check, tests,
the app/worker builds, and a Docker image build on your PR. Image **publishing**
only happens after a change lands on `main`.

---

## Reporting a security issue

Please **don't** open a public issue for security problems. Instead, use GitHub's
private vulnerability reporting:
[**Report a vulnerability**](https://github.com/Ximaz/youtube-search/security/advisories/new).

---

## License

This project is released into the public domain under
[The Unlicense](LICENSE). By contributing, you agree that your contributions are
dedicated to the public domain under the same terms.
