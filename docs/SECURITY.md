# Security Architecture & Cryptographic Standards

*Platform: CUETFreeMockTest.com*  
*Document verified: November 2026 (Fix R8)*

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
Because the iteration count is capped at 100,000, offline and online brute-force attacks are counterbalanced through multi-layer rate limiting:
1. **Workers KV Rate Limiting**: All login attempts (`POST /api/auth/login`) are gated by Cloudflare Workers KV sliding window counters (`src/lib/auth/rate-limit.ts`):
   - **IP Window**: Maximum 10 failed login attempts per 15 minutes per IP address.
   - **Account Window**: Maximum 5 failed login attempts per 15 minutes per email address.
   - **Exceeded Action**: Returns `HTTP 429 Too Many Requests` with `Retry-After` header.
2. **Rehash-on-Login Path**: The `verifyPassword` function checks whether a legacy hash requires re-encoding. Any future upgrade to alternative algorithms (e.g., Argon2id once WebCrypto/Wasm natively support it in Workers) can be migrated transparently on successful user authentication without mass password resets.

---

## 2. Implemented Admin Role Hierarchy

Role-based access control (RBAC) is enforced at the middleware layer (`src/middleware.ts`) and within API route handlers (`src/lib/auth/admin.ts`).

The platform implements exactly four distinct roles:

| Role Name | Scope & Responsibilities | Assigned Permissions |
| :--- | :--- | :--- |
| **`super`** | **Super Administrator**.<br>Unrestricted master administrative access. Manages administrator accounts, platform configuration, bulk database imports/exports, direct SQLite hotfixes, and trash restoration. | All 24 system permissions (`questions.*`, `mocks.*`, `taxonomy.*`, `media.*`, `seo.*`, `exam_info.*`, `announcements.*`, `leaderboards.*`, `moderation.*`, `attempts.*`, `users.*`, `admins.manage`, `settings.write`, `data.manage`, `trash.manage`, `revisions.restore`, `audit.*`). |
| **`editor`** | **Content Editor**.<br>Full question bank and mock test management. Creates, reviews, edits, publishes, and soft-deletes questions, passages, mock tests, syllabi, exam guides, announcements, and media assets. | 16 content permissions (`questions.*`, `mocks.*`, `taxonomy.write`, `media.write`, `seo.write`, `exam_info.write`, `announcements.write`, `leaderboards.write`, `attempts.view`, `revisions.restore`, `audit.own`). |
| **`moderator`** | **Community Moderator**.<br>Manages user interaction and discussions. Reviews reported comments, mutes abusive accounts, hides inappropriate discussion posts, and inspects user profiles. | 5 moderation permissions (`moderation.write`, `users.view`, `users.mute`, `attempts.view`, `audit.own`). |
| **`contributor`** | **Content Contributor**.<br>Drafts question propositions and suggests revisions. Cannot publish directly to production. | 3 drafting permissions (`questions.write`, `revisions.restore`, `audit.own`). |

*Implementation File*: [`src/lib/auth/admin.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/src/lib/auth/admin.ts)  
*Unit Tests*: [`tests/unit/admin-permissions.test.ts`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/admin-permissions.test.ts)

---

## 3. Production Hardening & Security Guards

The following automated guards prevent accidental privilege escalation, data leakage, and administrative bypass in production:

### 1. Rejection of `ADMIN_AUTH_MODE=session` in Production
- In staging and local development, admin authentication may use browser session cookies (`ADMIN_AUTH_MODE=session`).
- In production, administrative routes (`/admin/*`) strictly require **Cloudflare Access Zero Trust JWT validation** (`ADMIN_AUTH_MODE=cloudflare_access`).
- If `ADMIN_AUTH_MODE=session` is erroneously passed to the production worker without explicit override (`ALLOW_SESSION_IN_PROD=1`), `src/middleware.ts` rejects all requests with `HTTP 503 Service Unavailable: Administrative session authentication is disabled in production. Cloudflare Access Zero Trust required.`
- Verified in: [`tests/unit/production-guards.test.ts:36-43`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/tests/unit/production-guards.test.ts#L36-L43).

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

