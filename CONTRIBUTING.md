# Contributing

This repository is public. Use synthetic conversations, names, screenshots, fixtures and logs only. Never include real workspace data, private transcripts, account information, environment files, credentials or local SQLite files in issues, PRs or artifacts.

Use Node 26.5.x and `npm ci`. Changes require strict TypeScript, ESLint, unit/integration tests and a production build. UI/workflow changes also require Playwright (`npx playwright install chromium`, `npm run test:e2e`). Write domain/backend tests before implementation. Use the approved spec under `docs/specs` and design context `.impeccable.md`.

Authentication, stage admission, source identity, export formats and migrations are sticky contracts. Record changes in an ADR; never silently widen scopes, auto-approve pairing, relax origin validation or enable unverified live execution. Do not import private/hashed OpenClaw distribution files; public pinned package entrypoints only. New migrations are append-only with a rollback tested on disposable data. A rollback may discard data; never run it automatically.

All original contributions are MIT. Include third-party notices and font licenses. No commercial Untitled UI PRO source, paid art assets or external font/CDN dependencies. Do not modify generated/parent-owned media without checking provenance.

PR descriptions must state test commands/results, known gaps and deploy requirements: local server/frontend rebuild, applicable local schema migration, no remote deployment. Draft PRs are not releases. A real Gateway compatibility claim requires a separately authorized fixture test and reproducible evidence; a mocked protocol server does not establish it.
