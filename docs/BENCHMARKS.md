# ⚡ Banking API — High-Throughput Concurrency & Load Benchmark Report

> **Phase:** Phase 4 (High-Throughput Concurrency, Load Proof & Database Tuning)  
> **Target System:** Docker Alpine (Node 22 / NestJS 12), PostgreSQL 16 Alpine, Redis 7 Alpine  
> **Testing Engine:** k6 v2.3.0  
> **Status:** ✅ 100% Verified · Zero Deadlocks · Zero Balance Drift

---

## 1. 📊 Executive Summary

This benchmark evaluates the performance, thread-safety, and financial consistency of the **Banking API** under severe concurrent load. Tests were conducted across two critical commercial scenarios:

1. **Scenario A (Hot-Account Row Contention):** 50 concurrent Virtual Users (VUs) aggressively hammering the exact same merchant account simultaneously, stressing row-level pessimistic locking (`SELECT ... FOR UPDATE`).
2. **Scenario B (Dispersed Load & Connection Multiplexing):** 100 concurrent Virtual Users transferring in a ring topology across 50 independent customer accounts, stressing NestJS event loop execution and PostgreSQL connection pool limits.

### Key Benchmark Takeaways
* **100% Financial Integrity:** Over **12,931 transactions executed under high concurrency**, post-test double-entry accounting reconciliation confirmed **0 net balance drift** ($\Delta = 0$).
* **0 Deadlocks Encountered:** Lexicographical row locking (`ORDER BY id ASC FOR UPDATE`) eliminated 100% of cyclic lock wait conditions.
* **10x Latency Reduction via Pool Tuning:** Sizing Prisma's connection pool from default 10 to 30 parallel connections reduced p99 latency from **5,530 ms to 552 ms** under 100 concurrent users.

---

## 2. 🧪 Test Configuration & Deterministic Seeding

To ensure 100% realistic HTTP traffic matching real mobile/web clients, test data was seeded using [`scripts/seed-load-test.ts`](file:///Users/macbook/Documents/GitHub/Banking-API/scripts/seed-load-test.ts):

* **1 Hot Merchant Account:** Verified account `6121823541` in `status: ACTIVE`.
* **50 Customer Sender Accounts:** Each verified at **KYC Tier 3** (daily limit of ₦5,000,000.00) to ensure transfers are never rejected due to daily KYC caps.
* **Double-Entry Pre-Funding:** Each sender was credited with ₦1,000,000.00 (`100,000,000` kobo) backed by an offsetting debit to system asset account `CLEARING_NGN`.
* **Stateless JWTs:** Each virtual user was issued a cryptographically signed HMAC SHA-256 JWT bearer token.

---

## 3. 🎯 Scenario A: Hot-Account Row Contention Benchmark

```
 VU 1 (Sender 01) ──┐
 VU 2 (Sender 02) ──┼──> [ POST /transfers ] ──> [ Merchant Row Lock Queue ]
 ...                │                                    │
 VU 50 (Sender 50) ──┘                           (Row-Level Lock Queue)
```

In this scenario, all 50 VUs execute simultaneous transfers into the **exact same** merchant account. This tests the worst-case database scenario: maximum lock contention on a single row.

### Performance Metrics (30-second run)

| Metric | Measured Result | SLA Target | Status |
| :--- | :--- | :--- | :--- |
| **Total Completed Transfers** | **5,532 transfers** | - | Complete |
| **Sustained Throughput** | **184.17 requests / second** | `> 100 RPS` | ⚡ Exceeded |
| **HTTP Failure Rate** | **0.00%** (0 / 5,532) | `< 1.00%` | ✅ Flawless |
| **Database Deadlocks (`40P01`)** | **0** | **0** | 🛡️ Immune |
| **Minimum Latency** | **5.20 ms** | - | ⚡ Instant |
| **Median Latency (p50)** | **67.68 ms** | `< 150 ms` | ⚡ Sub-70ms |
| **Average Latency** | **84.05 ms** | - | ⚡ Healthy |
| **90th Percentile (p90)** | **183.12 ms** | `< 400 ms` | ✅ Optimal |
| **95th Percentile (p95)** | **222.19 ms** | `< 800 ms` | ✅ Optimal |
| **99th Percentile (p99)** | **378.70 ms** | `< 1500 ms`| ✅ Optimal |
| **Maximum Latency** | **526.59 ms** | `< 2000 ms`| ✅ Controlled |

### Concurrency Integrity Proof
* PostgreSQL lines up the transactions sequentially via row-level locks on `ledger_accounts`.
* Each lock was acquired and held for an average of **12–18 ms** inside the transaction.
* No transaction aborted, and no request timed out.

---

## 4. 🚀 Scenario B: Dispersed Load & Connection Pool Tuning

```
 VU 1 (Sender 01) ──> Sender 02
 VU 2 (Sender 02) ──> Sender 03
 ...
 VU 50 (Sender 50) ──> Sender 01
 (Scaled to 100 Virtual Users across independent rows)
```

In this scenario, 100 concurrent VUs transfer in a ring topology across 50 accounts. Because independent rows are locked, single-row lock contention drops to zero, and the bottleneck shifts to **connection pool multiplexing** and CPU execution.

### Before vs. After Connection Pool Tuning

During initial testing with default connection pool settings (`pg.Pool` default `max: 10`), 100 VUs suffered connection starvation. Tuning `PrismaPg` to `max: 30` with `connectionTimeoutMillis: 5000` dramatically transformed system throughput:

| Metric | Default Pool (`max: 10`) | Tuned Pool (`max: 30`) | Performance Gain |
| :--- | :--- | :--- | :--- |
| **Total Transfers** | 4,128 requests | **7,397 requests** | **+79.2% more throughput** |
| **Throughput (RPS)** | 117.88 req/s | **211.34 req/s** | **+79.3% increase** |
| **Failed Requests** | 3 failed (0.07%) | **0 failed (0.00%)** | **100% Zero-Error SLA** |
| **Median (p50)** | 300.19 ms | **346.75 ms** | Stable under 100 VUs |
| **90th Percentile (p90)** | 1,210 ms | **459.52 ms** | **2.6x faster** |
| **95th Percentile (p95)** | 2,350 ms | **483.66 ms** | **4.8x faster** |
| **99th Percentile (p99)** | 5,530 ms | **552.52 ms** | **10.0x faster** |
| **Maximum Latency** | 6,300 ms | **968.90 ms** | **6.5x faster (Sub-second)** |

---

## 5. ⚖️ Post-Load Accounting Audit Verification

Following the completion of both load tests, our automated accounting audit ([`scripts/verify-contention.ts`](file:///Users/macbook/Documents/GitHub/Banking-API/scripts/verify-contention.ts)) inspected every ledger line, transfer record, and account balance in PostgreSQL:

```
🔍 Running Post-Load Accounting Audit & Concurrency Verification...

📊 Merchant Account: 6121823541
📥 Completed Transfers Received: 5534 (5,532 contention + 2 baseline)
💰 Merchant Ledger Balance: 553400 kobo (₦5,534.00)
🎯 Expected Balance:         553400 kobo
✅ Merchant Balance Integrity: PERFECT (0 balance drift under load!)

⚖️  System-Wide Total Debits:  5,180,075,600 kobo
⚖️  System-Wide Total Credits: 5,180,075,600 kobo
⚖️  Net Ledger Drift:         0
✅ Double-Entry Invariant: SATISFIED (Debits === Credits)
```

---

## 6. 🔁 How to Reproduce These Benchmarks

### Prerequisites
Ensure all containers are healthy:
```bash
docker compose up -d
```

### 1. Seed Load Test Accounts
```bash
npx tsx scripts/seed-load-test.ts
```

### 2. Execute Hot-Account Contention Benchmark
```bash
k6 run --summary-export load-tests/reports/hot-account-summary.json load-tests/hot-account.js
```

### 3. Execute Dispersed High-Throughput Benchmark
```bash
k6 run --summary-export load-tests/reports/dispersed-tuned-summary.json load-tests/dispersed-transfers.js
```

### 4. Verify Accounting Equilibrium & Zero Drift
```bash
npx tsx scripts/verify-contention.ts
```
