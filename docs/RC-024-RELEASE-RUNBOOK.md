# ReelClue Release Runbook & Deployment Guide (RC-024)

**Document Version:** 1.0.0  
**Target Release:** MVP (P0)  
**Source of Truth:** `docs/PRD-ReelClue.md`, `docs/BACKLOG.md` (Issue #24)  
**Owner & Release Authority:** Andre Sanjaya  

---

## 1. Outcome & Scope

This runbook provides reproducible, credential-free operational instructions for preparing preview and production deployments of ReelClue on **Vercel** and **Supabase**, verifying resource quotas and costs, rehearsing non-destructive rollbacks, and executing owner-controlled release gates.

> [!IMPORTANT]
> **Owner-Controlled Release Gate**: Production deployment, DNS cutover, and public launch are never executed automatically by AI agents or CI. This ticket prepares all runbooks, checklists, and pre-flight verification tools so Andre has full control over release timing.

---

## 2. Architecture & Hosting Topology

```
                  ┌────────────────────────────────────────┐
                  │              End Users                 │
                  │   (Mobile browsers, Desktop Chrome)    │
                  └──────────────────┬─────────────────────┘
                                     │ HTTPS
                                     ▼
                  ┌────────────────────────────────────────┐
                  │          Vercel Edge Network           │
                  │   - Reverse proxy / TLS termination    │
                  │   - Forwarded IP headers (X-Fwd-For)   │
                  │   - Static assets & App Router RSC     │
                  └──────────────────┬─────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
   ┌────────────────────────────────┐ ┌────────────────────────────────┐
   │     Vercel Serverless Node     │ │     Server-side Sharp          │
   │  - App Router API Routes       │ │  - Dynamic Poster Pipeline     │
   │  - Anonymous Player Auth       │ │  - Gaussian Blur & Transform   │
   │  - Game Lifecycle & Scoring    │ │  - No Source URLs Exposed      │
   └────────────────┬───────────────┘ └────────────────┬───────────────┘
                    │                                 │
                    ▼                                 ▼
   ┌────────────────────────────────┐ ┌────────────────────────────────┐
   │       Supabase Postgres 17     │ │            TMDB API            │
   │  - Connection Pooler (6543)    │ │  - Server-only metadata sync   │
   │  - Row-Level Security (RLS)    │ │  - Bounded concurrency <= 4    │
   │  - Staged Catalog & Snapshots  │ │  - Zero client-side requests   │
   │  - Atomic Rate Limit RPC       │ └────────────────────────────────┘
   └────────────────────────────────┘
```

---

## 3. Step-by-Step Supabase Setup

### 3.1 Project Creation
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project:
   - **Name**: `reelclue-production` (or `reelclue-preview`)
   - **Database Password**: Generate a high-entropy password (store in secure password manager; never commit).
   - **Region**: Choose closest to target audience (e.g. `ap-southeast-1` Singapore for Southeast Asia / Indonesia, or `us-east-1`).
   - **Pricing Plan**: Free Tier ($0/mo) is sufficient for MVP validation; see Section 6 for quota details.

### 3.2 Applying Migrations
Apply all schema migrations in chronological order from `supabase/migrations/`:
1. `202611040001_foundations.sql` — Schema foundations, player tokens, game sessions, rounds, RLS policies.
2. `202611040002_catalog_import.sql` — Catalog versions, movies, staging tables, and `stage_catalog` / `activate_catalog` RPCs.
3. `202611040003_catalog_tiering.sql` — Familiarity tiers, scores, and band constraints.
4. `202611040004_game_lifecycle.sql` — Session creation, hint reveal, skip round, and state machine transitions.
5. `202611040005_game_scoring.sql` — Guess evaluation, normalization, score calculation, and terminal reveal states.
6. `202611040006_catalog_search.sql` — Full-text autocomplete search with opaque choice handles.
7. `202611040007_rate_limits.sql` — Distributed rate-limiting bucket table and atomic `consume_rate_limit` RPC.

> [!TIP]
> Migrations can be applied via the Supabase Dashboard SQL Editor, or via the Supabase CLI (`supabase db push`).

### 3.3 Verifying Database Functions & RPCs
Run the following SQL in the Supabase SQL editor to verify critical RPC existence:
```sql
SELECT proname, prorettype::regtype 
FROM pg_proc 
WHERE proname IN (
  'consume_rate_limit', 
  'purge_expired', 
  'stage_catalog', 
  'activate_catalog'
);
```
Expected output: 4 rows returned.

---

## 4. Step-by-Step Vercel Setup

### 4.1 Project Import & Build Settings
1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New... > Project**.
2. Select repository `andresanjaya/reelclue`.
3. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
   - **Build Command**: `pnpm build` (default `next build`)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Node.js Version**: `22.x`

---

## 5. Private Environment Variable Mapping

Configure the following environment variables in Vercel (**Settings > Environment Variables**):

| Variable Name | Required Scope | Example / Format | Purpose & Privacy Rules |
| :--- | :--- | :--- | :--- |
| `APP_BASE_URL` | Production & Preview | `https://reelclue.vercel.app` | Canonical public origin URL. Never include trailing slash. |
| `SUPABASE_URL` | All Environments | `https://[project-ref].supabase.co` | Server-only Supabase HTTPS endpoint. |
| `SUPABASE_SECRET_KEY` | All Environments | `sb_secret_...` or service role JWT | **Privileged server-only service_role key**. Grants server access to bypass RLS for atomic game transactions. **NEVER expose to browser via `NEXT_PUBLIC_`**. |
| `TMDB_READ_ACCESS_TOKEN` | All Environments | `eyJhbGciOi...` (Bearer token) | Server-only TMDB API v4 Bearer token for metadata imports. |
| `RATE_LIMIT_SECRET` | Production & Preview | 64-char hex string | Dedicated secret key used for HMAC-SHA256 IP/browser bucket hashing. |

> [!CAUTION]
> **No Secrets in Client Bundles**:
> - ReelClue **never** sets or requires `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_TMDB_API_KEY`.
> - All Supabase and TMDB calls occur in server components, API route handlers, or CLI scripts (`server-only`).
> - The browser only receives an opaque, signed `reelclue_player` HTTP-only cookie.

---

## 6. Resource Quotas, Capacity & Cost Verification

| Provider & Service | Free / Current Tier Quota | ReelClue MVP Consumption | Status & Headroom |
| :--- | :--- | :--- | :--- |
| **Vercel: Serverless Executions** | Hobby: 100GB-hrs/mo, 10s default execution timeout (max 15s) | Route handlers execute in $\approx 20\text{–}60\text{ ms}$; Poster transforms in $\approx 100\text{–}250\text{ ms}$. | **Massive Headroom**. Easily accommodates thousands of active sessions. |
| **Vercel: Edge Bandwidth** | Hobby: 100GB/mo | Game payload $\approx 2\text{ KB}$; Transformed poster $\approx 25\text{ KB}$. $\approx 300\text{ KB}$ per full 10-round game. | $\approx 330,000$ complete games per month within free allocation. |
| **Vercel: Image Optimization** | Hobby: 1,000 source images/mo | **0 quota consumed**. ReelClue uses server-side Sharp directly via custom endpoint (`/api/games/[id]/rounds/[roundId]/poster`). | **Zero impact** on Vercel image limits. |
| **Supabase: Database Storage** | Free: 500 MB disk storage | Full catalog (700 movies) $\approx 2.5\text{ MB}$; 10,000 active sessions with rounds $\approx 15\text{ MB}$. Total $\approx 20\text{–}30\text{ MB}$. | **<6% of free tier disk quota**. |
| **Supabase: Connection Pooling** | Free: 60 direct, 200 pooled connections via Supavisor | Serverless functions connect via Supabase JS client. | Use Supavisor connection pooling (port `6543`) if scaling to high concurrency. |
| **TMDB API: Request Limits** | Free: 40 requests per 10 seconds per IP | **0 runtime requests during gameplay**. All games query the local Supabase catalog. Catalog sync runs CLI batch with concurrency $\le 4$. | **Zero risk** of 429 rate-limiting during player games. |

---

## 7. Staged Catalog Activation Procedure

ReelClue uses an atomic, versioned catalog staging pipeline. The database never serves partially imported catalogs or unapproved movies.

### Step 1: Pre-Activation Dry Run (Offline / No DB writes)
Verify provider connectivity, candidate filtering, and tier coverage:
```bash
pnpm catalog:sync --dry-run
```
Expected output:
- `activation: "ready"`
- `shortages: []`
- `tiers`: Easy $\ge 100$, Medium $\ge 100$, Hard $\ge 100$.

### Step 2: Stage and Atomically Activate
Run the sync command targeting the deployment database:
```bash
pnpm catalog:sync --apply
```
The script performs the following in a single atomic database transaction:
1. Stages candidate movies into `catalog_movies` linked to a new `catalog_versions` UUID (`status = 'staging'`).
2. Validates coverage rules (100 movies per tier, 30 per mode per tier).
3. If validated, promotes status to `'active'` via `activate_catalog(p_version)`.
4. Prior active versions transition to `'retired'`. Live games referencing previous versions continue unaffected.

### Step 3: SQL Health Check
Verify active catalog in Supabase SQL editor:
```sql
SELECT id, status, imported_at, summary->>'approved' as movie_count, summary->'tiers' as tiers
FROM catalog_versions 
WHERE status = 'active'
ORDER BY imported_at DESC 
LIMIT 1;
```

---

## 8. Retention & Purge Operations

ReelClue implements strict data minimization according to PRD §14:
- Incomplete sessions expire at 24 hours.
- Raw guesses and audit actions purge after 7 days.
- Completed session snapshots purge after 30 days.
- Anonymous player tokens expire after 30 days.

### Manual Purge Command
```bash
pnpm db:purge --apply
```
Outputs count of purged records:
```json
{"actions":0,"guesses":0,"sessions":0,"players":0,"catalogs":0,"buckets":0}
```

### Optional Automated Purge
To run automatic weekly maintenance:
1. **GitHub Actions Schedule**: Configure a repository secret and run `pnpm db:purge --apply` on a weekly cron workflow.
2. **Vercel Cron**: Configure `vercel.json` with a protected cron endpoint calling `purge_expired`.

---

## 9. Preview Deployment Validation Checklist

Before authorizing production release, verify the preview deployment using this checklist:

- [ ] **Player Identity**:
  - Visit `/play`. Verify browser receives `reelclue_player` cookie (`HttpOnly`, `SameSite=Lax`).
  - Verify player record is created in `players` table with SHA-256 hash.
- [ ] **Mode & Difficulty Selection**:
  - Verify all 6 modes (*Poster Blur, Missing Title, Synopsis, Director & Cast, Genre Detective, Mixed*) can start games.
  - Verify Easy, Medium, and Hard selections respect familiarity tiers.
- [ ] **Transformed Poster Clue Pipeline**:
  - Inspect network tab on Poster Blur round. Verify `/api/games/[id]/rounds/[roundId]/poster?stage=0` returns 300x450 image bytes.
  - Confirm original TMDB image URL and unblurred source are nowhere in response headers or DOM.
- [ ] **Answer Autocomplete & Anti-Leak**:
  - Type in movie title. Verify suggestions show title and year with opaque handles.
  - Inspect DOM and network response: ensure unrevealed movie answers and aliases are completely absent.
- [ ] **Terminal Reveals & Scoring**:
  - Test wrong guesses (decrements attempts, reveals answer at 3 misses with 0 score).
  - Test hint requests (sharpening clue, decrements round score potential, caps at 3 hints).
  - Test skip round (confirmation modal, 0 score, answer revealed).
- [ ] **Results & Replay**:
  - Complete 10 rounds. Verify results page renders score, accuracy percentage, and breakdown.
  - Verify `/stats` reflects completed game aggregates in local storage.
- [ ] **Credits & Attribution Compliance**:
  - Visit `/about`. Verify TMDB attribution badge and disclaimer are visible.
  - Verify external TMDB movie links open safely in new tab (`rel="noopener noreferrer"`).
- [ ] **Mobile Responsiveness**:
  - Inspect on mobile viewport (390px iPhone / 412px Pixel).
  - Confirm all buttons/inputs have $\ge 44\text{ px}$ touch targets and no horizontal scrollbar occurs.

---

## 10. Non-Destructive Rollback Procedures

If an incident or regression occurs post-deployment, follow these non-destructive rollback steps:

### Scenario A: Application Code Regression
1. **Instant Vercel Rollback**:
   - Navigate to Vercel Dashboard > **Deployments**.
   - Locate the previous stable deployment.
   - Click **Instant Rollback** (promotes previous deployment to production in $<10\text{ seconds}$).
2. **Zero Database Impact**:
   - Active games and player sessions continue without interruption.

### Scenario B: Catalog Data Issue (e.g. undesirable movies reported)
1. **Revert Catalog Version (Zero Data Loss)**:
   - Run the following SQL query in Supabase to atomically restore a previous active catalog version:
     ```sql
     -- Find previous stable catalog version
     SELECT id, imported_at, row_count, status 
     FROM catalog_versions 
     ORDER BY imported_at DESC;

     -- Atomically reactivate previous version
     SELECT activate_catalog('<previous-catalog-version-uuid>');
     ```
2. **No Orphaned Games**:
   - Existing active sessions keep their assigned `catalog_version_id`. New game sessions immediately draw from the restored version.

### Scenario C: Compromised Secrets
1. **Database Secret Key Rotation**:
   - In Supabase Dashboard > Project Settings > API, generate a new service role secret.
   - Update `SUPABASE_SECRET_KEY` in Vercel.
   - Trigger redeployment.
2. **Rate Limit Secret Rotation**:
   - Update `RATE_LIMIT_SECRET` in Vercel to a fresh 64-char hex string.
   - Existing rate-limit buckets will reset harmlessly on their next request.

---

## 11. Pre-Flight Verification Tool

ReelClue includes an automated pre-flight verification script that inspects all deployment requirements without printing secrets:

```bash
pnpm verify:deployment
```

### Expected Output:
```
=== ReelClue Pre-Flight Deployment Verification ===

| Category | Item | Status | Details |
| :--- | :--- | :--- | :--- |
| Environment | APP_BASE_URL | PASS | Valid public HTTP(S) URL configured. |
| Environment | SUPABASE_CONFIG | PASS | Valid SUPABASE_URL and privileged service_role secret key detected. |
| Provider | TMDB_CREDENTIALS | PASS | Valid server-only TMDB credentials configured. |
| Security | RATE_LIMIT_SECRET | PASS | Dedicated HMAC secret configured. |
| Database | ACTIVE_CATALOG | PASS | Active catalog version verified with 702 movies. |
| Security | RATE_LIMIT_RPC | PASS | consume_rate_limit stored procedure verified and callable. |
| Database | PURGE_EXPIRED_RPC | PASS | purge_expired retention stored procedure verified and callable. |
| Database | GAME_SESSIONS_TABLE | PASS | game_sessions and dependent tables accessible. |

Status: READY FOR DEPLOYMENT. All pre-flight checks passed.
```

---

## 12. Release Acceptance Gate

Before proceeding to release, Andre confirms:
1. [ ] All P0 tickets (RC-001 through RC-024) merged.
2. [ ] `pnpm verify:deployment` reports **READY FOR DEPLOYMENT**.
3. [ ] Preview deployment smoke checklist verified on phone and desktop.
4. [ ] Production environment variables configured in hosting provider.
5. [ ] Explicit approval granted for production deployment.

