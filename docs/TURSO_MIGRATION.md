# Turso migration runbook

The app can run on either Cloudflare D1 (current) or Turso Cloud (libSQL).
`src/lib/db.ts` picks Turso when `TURSO_DATABASE_URL` is present and falls back
to the `DB` D1 binding otherwise. The D1 binding stays in `wrangler.jsonc`
during the migration so a bad cutover can be rolled back by removing the two
Turso secrets.

## Why Turso

- D1 free tier: 5M rows read/day, and the public site exhausted it.
- Turso Free: **500M rows read/month, 10M rows written/month**, 5GB storage,
  100 databases, no daily row-read cap.
- The SQL layer is SQLite, so migrations, queries and triggers stay unchanged.

## What the adapter preserves

| D1 API | Turso implementation |
| --- | --- |
| `prepare(sql).bind(...)` | statement wrapper carrying SQL + params |
| `.all<T>()` | `@libsql/client` `execute`, rows mapped to D1-shaped objects + `meta` |
| `.run()` | `execute`, `meta.changes` / `meta.last_row_id` |
| `db.batch([...])` | one atomic `client.batch(..., "deferred")` HTTP request |

The production adapter uses `@libsql/client` (the `workerd` export), whose HTTP
client opens a stream, runs the statement(s) and closes the stream **inside a
single `fetch`**. It therefore keeps no server-side session between calls.

This is deliberate. The earlier `@tursodatabase/serverless` design kept a
`baton` (server-side session) per connection. Opening one connection per request
exhausted Turso's connection limit after roughly 55-85 requests, and closing
connections inside `trackDbMetrics` ran while Astro was still streaming the
response body, which could produce a truncated attempt page. A shared
connection per isolate is not safe either: its `execLock` makes one request
await a promise owned by another request, which the Workers runtime cancels as
a hung request. The stateless HTTP client avoids sessions, locks and batons
entirely, so it is safe to reuse across concurrent requests.

Turso Cloud enables `foreign_keys` by default; the adapter verified
`PRAGMA foreign_keys` returns `1` on a fresh HTTP connection, so no per-request
pragma is needed (and a pragma would not survive stateless HTTP anyway).
`trackDbMetrics` now only records counters; it never owns connection state.

Reads retry once on transient network/HTTP failures because they are
idempotent. Writes are never retried automatically.

## One-time setup

1. Create the database at <https://app.turso.tech> (GitHub login).
   Suggested name: `cuet-mock`, region: Singapore or Mumbai.
2. Copy the database URL (`libsql://...`) and create a database token.
3. Put both in `.dev.vars` (git-ignored):

   ```dotenv
   TURSO_DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=eyJ...
   ```

`TURSO_AUTH_TOKEN` is a database token, not the platform API token.

## Apply schema and data

```bash
# 1. Same migrations as D1, tracked in d1_migrations.
npm run db:turso:migrate

# 2. Export production D1 without the schema (works even when the daily
#    row-read quota is exhausted; it uses D1's export endpoint).
npx wrangler d1 export cuet-blueprint-db --remote --no-schema --output d1-data.sql

# 3. Import rows, restore AUTOINCREMENT sequences and verify every table count.
npm run db:turso:import -- --file d1-data.sql

# 4. Independent consistency check.
npm run db:turso:verify
```

`db:turso:import` refuses to run against a non-empty database. If an earlier
import failed halfway, pass `--reset` to clear the data (the migrated schema and
`d1_migrations` stay in place) and start again:

```bash
npm run db:turso:import -- --file d1-data.sql --reset
```

Three import details matter:

- Migration `0020` seeds the same verified `exam_info` rows that production
  contains, so the importer clears `exam_info` before replaying the dump.
- The `trg_frozen_version_question_insert` trigger correctly rejects new
  membership on a published version, which would also reject the historical
  `mock_questions` rows. The importer drops that one trigger for the replay and
  rebuilds every trigger from the migration files afterwards, in a `finally`
  block, so the guard is never left missing.
- The `d1_migrations` sequence row is not copied from D1: Turso has one more
  migration row than the dump, and restoring the lower D1 counter would make
  the next migration reuse an id.

## Cutover

```bash
npx wrangler secret put TURSO_DATABASE_URL --env production
npx wrangler secret put TURSO_AUTH_TOKEN --env production
```

Then deploy normally (GitHub Actions `auto-deploy` or `npm run deploy`).
Verify:

```bash
curl -s https://cuetfreemocktest.com/api/health
# {"ok":true,"db":"ok","engine":"turso","exams":1,...}
```

The `x-db-rows-read`, `x-db-rows-written` and `x-db-queries` response headers
report per-request database work. The stateless HTTP API does not expose
server-side row counters, so `rows_read` is the number of rows returned (a lower
bound) and `rows_written` mirrors `rowsAffected`; use the Turso dashboard for
billing.

## Rollback

Remove the two secrets and redeploy:

```bash
npx wrangler secret delete TURSO_DATABASE_URL --env production
npx wrangler secret delete TURSO_AUTH_TOKEN --env production
```

The app returns to the D1 binding immediately. Do not delete the D1 database
until the Turso deployment has served production traffic for a full week and a
D1 export has been archived.

## Staging and the separate 2026 worker

Use the same commands with the matching environment:

```bash
npm run db:turso:migrate    # uses the .dev.vars credentials
npx wrangler secret put TURSO_DATABASE_URL --env staging
npx wrangler secret put TURSO_AUTH_TOKEN --env staging
```

For `deploy2026`, point the credentials at a separate Turso database before
setting the secrets; the two workers must not share data.

## Limits to watch

- Turso Free: 10M writes/month. One attempt lifecycle is ~80 writes, so the
  free tier supports roughly 125k attempts/month before overage.
- `attempt_answers` autosave is the largest write source; the capacity model in
  `docs/CAPACITY_MODEL.md` still applies.
- Turso's HTTP request payload limit shapes import batches; the import script
  defaults to 500 KB / 500 statements per request.
