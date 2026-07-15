---
name: Drizzle push prompts
description: drizzle-kit push blocks on interactive prompts in this repo
---
Rule: `pnpm --filter @workspace/db run push` can hang on interactive prompts (e.g. adding a unique constraint asks truncate yes/no), silently leaving new columns unapplied.
**Why:** push is interactive; unrelated pending schema diffs (shifts unique constraint) trigger prompts every time.
**How to apply:** For simple additive changes, run the ALTER TABLE directly via psql `$DATABASE_URL`, keep schema/*.ts in sync, and add a matching manual SQL file in lib/db/migrations (repo convention: numbered files for views/indexes/manual DDL). Always verify with information_schema after push.
