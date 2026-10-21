# 🧪 Verified Test Results & Concurrency Evidence Logbook

> **Certified Run Stamped:** `2026-10-21T18:10:33.820Z`  
> **Git Reference:** Branch `master` · Commit `4f3c689`  
> **Environment:** Node.js `v26.11.0` · OS `darwin (arm64)` · Docker Alpine  
> **Integrity Status:** ✅ **100% Passing · Zero Deadlocks · Zero Balance Drift**

This document serves as an immutable, reproducible audit log of test executions, concurrency stress runs, and database load benchmarks for public inspection.

---

## 📑 Verification Summary Matrix

| Quality Gate / Benchmark | Tested Invariant | Measured Result | Verdict |
|---|---|---|:---:|
| **Unit Test Suites** | Modular isolated business logic | **18 suites / 71 tests passed** (100%) | ✅ **PASSED** |
| **E2E Concurrency Suite** | 20 parallel cross-transfers (A->B & B->A) | **Zero deadlocks (`40P01`) · Exact balances** | ✅ **PASSED** |
| **Hot-Account Contention (k6)** | 50 VUs hammering single merchant row | **5,532 txs @ 184.17 RPS · 0 deadlocks** | ✅ **PASSED** |
| **Dispersed Load Benchmark (k6)** | 100 VUs across 50 accounts (Tuned pool: 30) | **7,397 txs @ 211.34 RPS · 0 errors** | ✅ **PASSED** |
| **Double-Entry Equilibrium** | System-wide Ledger Conservation | **Total Debits === Total Credits (Drift = 0)** | ✅ **PASSED** |

---

## 1. 🧪 Unit Test Suite Verification (Vitest)

* **Test Framework:** Vitest 4 with Native ESM
* **Execution Time:** ~2.5 seconds across 18 test suites
* **Rule Count:** 71 isolated unit tests covering Auth, KYC, Accounts, Nuban, Ledger, Transfers, Notifications, and Error Filters.

<details>
<summary><b>🔍 Click to expand Unit Test Console Output</b></summary>

```text
RUN  v4.1.12 /Users/macbook/Documents/GitHub/Banking-API

 ✓ src/modules/customers/customers.controller.spec.ts (1 test) 164ms
 ✓ src/modules/ledger/ledger-reconciliation.service.spec.ts (3 tests) 115ms
 ✓ src/modules/accounts/accounts.service.spec.ts (1 test) 114ms
 ✓ src/infrastructure/prisma/prisma.service.spec.ts (1 test) 127ms
 ✓ src/modules/notifications/notifications.service.spec.ts (3 tests) 113ms
 ✓ src/modules/ledger/ledger.service.spec.ts (6 tests) 165ms
 ✓ src/modules/auth/auth.service.spec.ts (1 test) 166ms
[32m[Nest] 76401  - [39m10/21/2026, 11:10:35 AM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying NIN: 12345[39m
[32m[Nest] 76401  - [39m10/21/2026, 11:10:35 AM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying NIN: 12345678901[39m
[32m[Nest] 76401  - [39m10/21/2026, 11:10:35 AM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying BVN: 12345678901[39m
[32m[Nest] 76401  - [39m10/21/2026, 11:10:35 AM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying Proof of Address: https://docs.bank.com/bill.pdf[39m
[32m[Nest] 76401  - [39m10/21/2026, 11:10:35 AM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying biometric liveness session[39m
 ✓ src/modules/kyc/kyc.service.spec.ts (12 tests) 13ms
 ✓ src/common/filters/global-exception.filter.spec.ts (6 tests) 11ms
 ✓ src/modules/customers/customers.service.spec.ts (1 test) 95ms
 ✓ src/app.controller.spec.ts (2 tests) 95ms
 ✓ src/modules/transfers/transfers.service.spec.ts (14 tests) 13ms
 ✓ src/modules/accounts/accounts.controller.spec.ts (1 test) 74ms
 ✓ src/modules/auth/auth.controller.spec.ts (1 test) 90ms
 ✓ src/modules/accounts/nuban.service.spec.ts (3 tests) 3ms
 ✓ src/common/idempotency/idempotency.service.spec.ts (8 tests) 7ms
 ✓ src/modules/kyc/kyc.controller.spec.ts (4 tests) 3ms
 ✓ src/modules/transfers/transfers.controller.spec.ts (3 tests) 3ms

 Test Files  18 passed (18)
      Tests  71 passed (71)
   Start at  11:10:34
   Duration  2.17s (transform 767ms, setup 0ms, import 7.20s, tests 1.37s, environment 1ms)
```

</details>

---

## 2. ⚡ End-to-End Concurrency Stress Suite (Vitest E2E)

Tests the core banking engine under simultaneous cross-account transfer conditions (`Promise.all`), verifying that lexicographical lock sorting (`ORDER BY id ASC FOR UPDATE`) prevents database deadlocks.

* **Key Assertion:** 20 parallel cross-transfers (A -> B and B -> A simultaneously).
* **Deadlock Detection (`40P01`):** **0 occurrences**.
* **Overdraft Prevention:** Balances strictly cannot drop below zero.

<details>
<summary><b>🔍 Click to expand E2E Stress Test Console Output</b></summary>

```text
RUN  v4.1.12 /Users/macbook/Documents/GitHub/Banking-API

 ✓ test/app.e2e-spec.ts (2 tests) 247ms
 ✓ test/concurrent-transfers.e2e-spec.ts (4 tests) 804ms
       ✓ should execute 20 concurrent cross-transfers (A->B and B->A) without deadlocks (40P01) or balance corruption  528ms

 Test Files  2 passed (2)
      Tests  6 passed (6)
   Start at  11:10:37
   Duration  1.52s (transform 272ms, setup 0ms, import 1.06s, tests 1.05s, environment 0ms)
```

</details>

---

## 3. 🎯 k6 Hot-Account Contention Benchmark (50 Concurrent VUs)

* **Scenario:** 50 Virtual Users hammering the exact same merchant account row (`6121823541`) simultaneously for 30 seconds.
* **Total Transfers Completed:** **5532**
* **Sustained Throughput:** **184.17 requests / second**
* **Failed Requests:** **0%**
* **Latency Profile:**
  * **Median (p50):** `67.69 ms`
  * **95th Percentile (p95):** `222.19 ms`
  * **99th Percentile (p99):** `378.70 ms`
  * **Max Latency:** `526.60 ms`

---

## 4. 🚀 k6 Dispersed High-Throughput Benchmark (100 Concurrent VUs)

* **Scenario:** 100 Virtual Users transferring across 50 customer accounts in a ring topology with tuned PostgreSQL connection pool (`max: 30`).
* **Total Transfers Completed:** **7397**
* **Sustained Throughput:** **211.34 requests / second**
* **Failed Requests:** **0%**
* **Latency Profile:**
  * **Median (p50):** `346.76 ms`
  * **95th Percentile (p95):** `483.66 ms`
  * **99th Percentile (p99):** `552.52 ms`
  * **Max Latency:** `968.90 ms`

---

## 5. ⚖️ Post-Load Accounting Audit Verification

Following 12,900+ high-concurrency transactions, the automated audit script ([scripts/verify-contention.ts](file:///Users/macbook/Documents/GitHub/Banking-API/scripts/verify-contention.ts)) queried PostgreSQL directly to assert zero balance drift and absolute double-entry equilibrium:

<details open>
<summary><b>🔍 Verified Post-Load Ledger Audit Output</b></summary>

```text
🔍 Running Post-Load Accounting Audit & Concurrency Verification...

📊 Merchant Account: 6121823541
📥 Completed Transfers Received: 5534
💰 Merchant Ledger Balance: 553400 kobo (₦5534.00)
🎯 Expected Balance:         553400 kobo
✅ Merchant Balance Integrity: PERFECT (0 balance drift under load!)

⚖️  System-Wide Total Debits:  5205535600
⚖️  System-Wide Total Credits: 5205535600
⚖️  Net Ledger Drift:         0
✅ Double-Entry Invariant: SATISFIED (Debits === Credits)
```

</details>

---

## 🔄 Reproduction Guide

To independently reproduce this evidence on your own machine:

```bash
# 1. Start Docker services
docker compose up -d

# 2. Run full test verification suite
npm test
npm run test:e2e

# 3. Seed deterministic load test accounts
npx tsx scripts/seed-load-test.ts

# 4. Run k6 load benchmarks
k6 run --summary-export load-tests/reports/hot-account-summary.json load-tests/hot-account.js
k6 run --summary-export load-tests/reports/dispersed-tuned-summary.json load-tests/dispersed-transfers.js

# 5. Run accounting balance verification
npx tsx scripts/verify-contention.ts
```
