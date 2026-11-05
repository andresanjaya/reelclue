# Reverse Proxy Forwarded IP Trust & Rate Limiting Architecture

Source: ReelClue PRD §16, §21; Ticket RC-022.

## Deployment Assumption

ReelClue operates behind a trusted reverse proxy / CDN (such as Vercel Edge Network or AWS CloudFront) that controls incoming HTTP headers:
- `x-forwarded-for`: The reverse proxy appends or replaces client IP values. ReelClue extracts the first (leftmost) IP address from `x-forwarded-for`, falling back to `x-real-ip` or `127.0.0.1`.
- **Untrusted Direct Access**: If the application server were exposed directly to raw internet traffic without a reverse proxy, clients could forge `x-forwarded-for` headers. In production deployment, direct access to the Node application port must be blocked; all traffic must pass through the edge proxy.

## Rate Limiting Topology: Dual-Bucket Strategy

Public anonymous apps face two conflicting abuse-prevention challenges:
1. **Shared IP False Positives**: Cellular carriers (CGNAT) and institutional Wi-Fi (universities, corporate offices) multiplex thousands of independent users behind a single shared external IP address. Strict per-IP rate limits would block legitimate players sharing the same network.
2. **Botnet / Distributed Denial**: Attackers can rotate browser cookies or spoof identities to evade per-browser restrictions.

ReelClue solves this using a **dual-bucket strategy**:
- **Primary Bucket (Per-Browser)**: Identified by the cryptographic 256-bit anonymous `reelclue_player` cookie. Hashed with HMAC-SHA256 (`browser:<token>`). Limits normal user interaction rates without penalizing other players on the same network.
- **Secondary Backstop (Per-IP)**: Identified by the client IP address. Hashed with HMAC-SHA256 (`ip:<ip>`). Configured with wider, multi-user thresholds (e.g., 30 creates/10 min, 120 searches/min) to absorb concurrent benign users while stopping automated brute-force attacks.

## Database-Backed Distributed Counters

- Rate limit counters reside in Postgres (`public.rate_limit_buckets`) and increment atomically via the `consume_rate_limit` stored procedure (`INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`).
- Counters are synchronized across all serverless instances and regions; no in-memory or single-instance isolation leaks occur.
- Bucket rows automatically expire (`expires_at <= 24 hours`) and are periodically cleaned by `purge_expired()` bounded to 10,000 rows per run.

## Telemetry & Redaction Policies

To guarantee player privacy and prevent leaking sensitive data:
1. **No Raw IPs**: Only keyed HMAC SHA-256 hashes are stored in rate buckets or included in structured logs.
2. **No Player Tokens**: Raw 256-bit cookie secrets are never serialized in log payloads or error responses.
3. **No Free-Text Guesses**: User-typed guesses are never recorded in telemetry.
4. **No Unrevealed Answers**: Movie titles, aliases, or future round sequences are never included in operational logs or client error payloads.
5. **No Stack Traces / Internal DB Errors**: 5xx exceptions return a generic envelope (`INTERNAL_ERROR: An unexpected error occurred`) with `Retry-After: 5` and `Cache-Control: private, no-store`.
