# Environment Matrix & Operational Verification (Fix R4)

_Machine-verified environment mapping and boundary separation for CUETFreeMockTest.com._

---

## 1. Environment Matrix

| Environment | D1 Database Name (ID) | KV Namespaces (Session / Media) | R2 or Fallback | Deployed? | Last Applied Migration | Seeded with Content? | Auth Mode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Local** | `local-d1-db`<br>`(.wrangler/...sqlite)` | Local Miniflare<br>`SESSION` / `MEDIA_KV` | Fallback<br>(KV-backed `MEDIA_KV`) | **Local runtime**<br>(Miniflare / `wrangler dev` :4321) | `0020_exam_info_seed.sql`<br>**(20 / 20 applied)** | **Yes**<br>(214 practice papers, 16,846 questions) | `session` |
| **Staging** | `cuet-d1-staging`<br>(`c527f20e...5d0f`) | Remote Cloudflare KV<br>`2e758fe3...00f9` / `3f9c70ce...3d4` | Fallback<br>(KV-backed `MEDIA_KV`) | **Configured**<br>(Worker `cuet-astro-staging`) | `0020_exam_info_seed.sql`<br>**(20 / 20 applied)** | **Seeded**<br>(Capacity testing & clean practice set) | `session` |
| **Production** | `cuet-blueprint-db`<br>(`77ed64bd...ced8`) | Remote Cloudflare KV<br>`7ea13818...e577` / `0c268f3e...0f46` | Fallback<br>(KV-backed `MEDIA_KV`) | **Live Worker**<br>(Worker `cuet-astro-production`) | `0015_ranked_practice_library.sql`<br>**(0016–0020 pending apply)** | **Yes**<br>(0 user rows, baseline content) | `access`<br>(Cloudflare Access) |

---

## 2. Remote Migration Verification Evidence

Remote migration checks executed via `npm run check:migrations-remote` (`node scripts/check-migrations-remote.mjs`):

### Staging Database (`cuet-d1-staging`)
- **Binding:** `DB` in `env.staging`
- **Database ID:** `c527f20e-4401-4d35-9db0-8b7433105d0f`
- **Wrangler Status:** Online and queried.
- **Applied Migrations:** `0001_init.sql` through `0020_exam_info_seed.sql` (20 / 20 applied; `No migrations to apply`).
- **Seeded Content:** Capacity measurement items and schema initialized.

### Production Database (`cuet-blueprint-db`)
- **Binding:** `DB` in root / production
- **Database ID:** `77ed64bd-006b-475b-9389-504c1639ced8`
- **Wrangler Status:** Online and queried.
- **Applied Migrations:** `0001_init.sql` through `0015_ranked_practice_library.sql` (15 applied).
- **Pending Migrations:** `0016_subject_rollup_index.sql` through `0020_exam_info_seed.sql` (5 migrations pending apply).
- **Production Guard:** Remote production database is never migrated or mutated without explicit owner confirmation (Global Rule 4).

---

## 3. Resource Separation Guarantees

1. **Strictly Distinct Database IDs:**
   - Staging (`c527f20e...5d0f`) and Production (`77ed64bd...ced8`) are physically isolated Cloudflare D1 databases.
   - Enforced by automated CI script `scripts/check-env-separation.mjs`.

2. **Session and Media KV Isolation:**
   - Staging Session KV (`2e758fe3...00f9`) vs Production Session KV (`7ea13818...e577`).
   - Staging Media KV (`3f9c70ce...3d4`) vs Production Media KV (`0c268f3e...0f46`).

3. **Data Boundary & Anti-Pollution Protection:**
   - Fixture isolation rules (Fix R5) guarantee that automated E2E test runs never insert test sessions or mock rows into remote environments.
   - Content export script `scripts/export-content.mjs` exports ONLY sanitized content tables (excluding all user accounts, passwords, sessions, attempt answers, discussions, and fixture rows).
