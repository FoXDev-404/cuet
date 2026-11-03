# Environment Separation & Resource Mapping

This document details the configuration, isolation boundaries, and Cloudflare resource IDs for each deployment environment of CUETFreeMockTest.com.

---

## 1. Environment Architecture & Isolation Matrix

| Environment | Purpose | Worker Name | D1 Database Name | D1 Database ID | Session KV ID | Media KV ID | Auth Mode | `ENV` Var |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Local** | Local developer testing & Miniflare | `cuet-astro` | `local-d1-db` | `.wrangler/state/v3/d1` (Local SQLite) | Local Miniflare KV | Local Miniflare KV | `session` | `development` |
| **Staging** | Pre-production testing, QA & CI smoke runs | `cuet-astro-staging` | `cuet-d1-staging` | `c527f20e-4401-4d35-9db0-8b7433105d0f` | `2e758fe3a6ea411da5741750e84900f9` | `3f9c70ce7bb54e0c931f0ecedfdfb3d4` | `session` | `staging` |
| **Production** | Live public production traffic | `cuet-astro-production` | `cuet-blueprint-db` | `77ed64bd-006b-475b-9389-504c1639ced8` | `7ea138189e80421db764cab62751e577` | `0c268f3ee06c4ee6928493f58c6e0f46` | `access` | `production` |

---

## 2. Resource Separation Guarantees

1. **Strictly Distinct Database IDs:**
   - Staging and Production databases are independently provisioned and physically separated on Cloudflare D1.
   - Verified: `c527f20e-4401-4d35-9db0-8b7433105d0f` (Staging) != `77ed64bd-006b-475b-9389-504c1639ced8` (Production).
   - Automated CI check in `scripts/check-env-separation.mjs` verifies that staging and production bindings never share the same database or KV namespace ID.

2. **Session and Media Isolation:**
   - User sessions, rate-limit counters, and media caches in staging cannot pollute or evict production sessions or assets.

3. **Data Boundary Protection:**
   - Production database contains strictly curated content.
   - Any destructive migration, seed wipe, or test data purge script (`scripts/purge-test-data.mjs`) is hard-coded to refuse running against the production database unless `--confirm-production` and explicit interactive confirmation are passed.

4. **Content Export Pipeline:**
   - To seed staging or production, only `scripts/export-content.mjs` is used, which dumps content tables in strict foreign-key order and completely ignores all user accounts, sessions, attempt answers, discussions, and personal logs.

---

## 3. Operational Commands

### Staging Operations
```bash
# Deploy to staging
npx wrangler deploy --env staging

# Run migrations against remote staging D1
npx wrangler d1 migrations apply cuet-d1-staging --remote

# Export content from local to staging
node scripts/export-content.mjs --output staging-content.sql
```

### Production Operations
```bash
# Check environment separation guard
node scripts/check-env-separation.mjs

# Deploy to production (requires owner approval)
npx wrangler deploy --env production

# Run migrations against remote production D1
npx wrangler d1 migrations apply cuet-blueprint-db --remote
```
