# Security Architecture & Cryptographic Standards

*Platform: CUETFreeMockTest.com*  
*Document verified: November 2026 (Fix R8)*

---

## 0. Sign-in Model (November 2026)

Sign-in is **Google OAuth only**. Email/password signup, login and password-reset
flows have been retired: their pages redirect to `/login`, the corresponding API
routes (`/api/auth/signup`, `/api/auth/forgot`, `/api/auth/reset`,
`/api/account/password`) were removed, and no new password hashes are written.
The PBKDF2 machinery below is kept for legacy stored hashes only. Consequences:

- **Google OAuth credentials are required** for any sign-in to work
  (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`).
- Accounts are matched by verified Google email; existing email-registered users
  reclaim their history by signing in with the same email address.
- Password-reset email delivery (Brevo) is no longer used by any flow.

---

## 1. Password Hashing Specification

The application implements standard, zero-dependency WebCrypto password hashing natively compatible with Cloudflare Workers (workerd runtime).

### Cryptographic Parameters
- **Algorithm**: `PBKDF2-HMAC-SHA256`
- **Hash Serialization Format**: `pbkdf2${iterations}${salt_base64}${derived_key_base64}`
- **Iteration Count**: **100,000 iterations**
- **Salt Length**: **16 bytes** (128 bits), cryptographically secure random (`crypto.getRandomValues`)
- **Derived Key Length**: **32 bytes** (256 bits)
- **Implementation File**: [`src/lib/auth/password.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/src/lib/auth/password.ts)
- **Automated Verification**: [`tests/unit/password.test.ts`](file:///e:/AA%20Projects/New Full/CUET Mock/tests/unit/password.test.ts)

### Platform Constraint & Iteration Cap
Cloudflare Workers' WebCrypto subsystem enforces a hard ceiling of 100,000 iterations on `PBKDF2` operations. Attempting to execute `crypto.subtle.deriveBits` with iteration counts above 100,000 throws:
```
OperationError: iteration counts above 100000 are not supported
```
To ensure predictable edge compute latency (sub-50ms CPU time per request) and prevent worker termination under load, the iteration count is pinned to the maximum platform allowance of 100,000.

### Brute-Force & Rate-Limiting Compensation
Because the iteration count is capped at 100,000, online brute-force attacks are counterbalanced by Workers KV rate limiting (`src/lib/auth/rate-limit.ts`):
1. **Fixed-Window Counters**: Login (`POST /api/auth/login`) is gated by a `login` bucket keyed `ip:email` — maximum 10 attempts per 15 minutes, returning `HTTP 429 Too Many Requests` (response body only; no `Retry-After` header is sent). Other public endpoints (signup, password reset, attempt start/submit, discussions, share checks) carry their own buckets; see the `rateLimit(...)` call sites.
2. **Known Trade-offs**: The counter is a KV-backed fixed window, not a sliding window, and is eventually consistent under concurrent requests; on a KV error it **fails open** so an outage never locks users out. Treat it as a speed bump rather than a hard lock.
3. **Fail-Closed Hash Verification**: `verifyPassword` rejects any stored hash with fewer than 100,000 iterations or a malformed/undecodable format, so a legacy or tampered row can never authenticate. There is deliberately no rehash-on-login path; a future algorithm upgrade would be a migration, not a transparent re-encode.

---

## 2. Implemented Admin Role Hierarchy

Role-based access control (RBAC) is enforced at the middleware layer (`src/middleware.ts`) and within API route handlers (`src/lib/auth/admin.ts`).

The platform implements exactly four distinct roles:

| Role Name | Scope & Responsibilities | Assigned Permissions |
| :--- | :--- | :--- |
| **`super`** | **Super Administrator**.<br>Unrestricted master administrative access. Manages administrator accounts, platform configuration, bulk database imports/exports, direct SQLite hotfixes, and trash restoration. | All 25 system permissions (`questions.*`, `mocks.*`, `taxonomy.*`, `media.*`, `seo.*`, `exam_info.*`, `announcements.*`, `leaderboards.*`, `moderation.*`, `attempts.*`, `users.*`, `admins.manage`, `settings.write`, `data.manage`, `trash.manage`, `revisions.restore`, `audit.*`). |
| **`editor`** | **Content Editor**.<br>Full question bank and mock test management. Creates, reviews, edits, publishes, and soft-deletes questions, passages, mock tests, syllabi, exam guides, announcements, and media assets. | 16 permissions (`questions.write/publish/delete`, `mocks.write/publish`, `taxonomy.write`, `media.write`, `seo.write`, `exam_info.write`, `announcements.write`, `leaderboards.write`, `moderation.write`, `attempts.view`, `users.view`, `revisions.restore`, `audit.own`). |
| **`moderator`** | **Community Moderator**.<br>Manages user interaction and discussions. Reviews reported comments, mutes abusive accounts, hides inappropriate discussion posts, and inspects user profiles. | 3 permissions (`moderation.write`, `users.view`, `users.mute`). |
| **`contributor`** | **Content Contributor**.<br>Drafts question propositions and suggests revisions. Cannot publish directly to production. | 2 permissions (`questions.write`, `media.write`). |

*Implementation File*: [`src/lib/auth/admin.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/src/lib/auth/admin.ts)  
*Unit Tests*: [`tests/unit/admin-permissions.test.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/admin-permissions.test.ts)

---

## 3. Production Hardening & Security Guards

The following automated guards prevent accidental privilege escalation, data leakage, and administrative bypass in production:

### 1. Rejection of `ADMIN_AUTH_MODE=session` in Production
- In staging and local development, admin authentication may use browser session cookies (`ADMIN_AUTH_MODE=session`).
- In production, administrative routes (`/admin/*`) are designed to require **Cloudflare Access Zero Trust JWT validation** (`ADMIN_AUTH_MODE=access`; the value `cloudflare_access` is not accepted by the code).
- If `ADMIN_AUTH_MODE=session` is passed to the production worker without the explicit override (`ADMIN_ALLOW_SESSION_IN_PROD=1`), `src/middleware.ts` rejects all admin requests with `HTTP 503 Service Unavailable`.
- Verified in: [`tests/unit/production-guards.test.ts:36-43`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/production-guards.test.ts#L36-L43).
- **Current deployment status**: Cloudflare Access is not provisioned yet, so production runs in session mode behind the explicit `ADMIN_ALLOW_SESSION_IN_PROD=1` override (`wrangler.jsonc`). Provisioning Access and removing the override remains a launch-runbook requirement.

### 2. Super Admin Bootstrap Protection
- The `bootstrapSuperAdmin()` function and `scripts/admin-create.mjs` script allow creating the initial administrator.
- Both mechanisms query `SELECT COUNT(*) FROM admins WHERE role = 'super'`. If an active super admin already exists, bootstrap creation is permanently locked and returns `null` or exits with error code 1.
- Verified in: [`tests/unit/production-guards.test.ts:24-34`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/production-guards.test.ts#L24-L34).

### 3. Development Routes Isolation (`/dev/*`)
- Internal debug tools (`/dev/styleguide`, test harness endpoints) are blocked in production (`src/middleware.ts` returns `HTTP 404 Not Found`).
- Excluded from web crawlers via `src/pages/robots.txt.ts` (`Disallow: /dev` and `Disallow: /dev/`).
- Verified in: [`tests/unit/production-guards.test.ts:18-22`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/production-guards.test.ts#L18-L22).

### 4. Answer-Key Leakage Prevention
- Public mock detail endpoints (`GET /api/mocks/:slug`) and server-rendered HTML payloads omit `correct_option` and `explanation`.
- Active mock attempts (`/attempt/:id`) never send answer keys to the client. Scoring is performed exclusively on the server upon `POST /api/attempts/:id/submit`.
- Verified in E2E security suite: [`tests/e2e/api-contracts.spec.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/e2e/api-contracts.spec.ts) and [`tests/e2e/security.spec.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/e2e/security.spec.ts).

