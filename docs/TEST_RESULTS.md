# 🧪 Verified Test Results & Concurrency Evidence Logbook

> **Certified Run Stamped:** `2026-10-21T19:48:11.679Z`  
> **Git Reference:** Branch `master` · Commit `2dc5d1e`  
> **Environment:** Node.js `v26.11.0` · OS `darwin (arm64)` · Docker Alpine  
> **Integrity Status:** ✅ **100% Passing · Zero Deadlocks · Zero Balance Drift**

This document serves as an immutable, reproducible audit log of test executions, concurrency stress runs, and database load benchmarks for public inspection.

---

## 📑 Verification Summary Matrix

| Quality Gate / Benchmark | Tested Invariant | Measured Result | Verdict |
|---|---|---|:---:|
| **Unit Test Suites** | Modular isolated business logic | **21 suites / 84 tests passed** (100%) | ✅ **PASSED** |
| **E2E Concurrency & Outbox Suite** | Cross-transfers & Transactional Outbox Kafka streaming | **Zero deadlocks (`40P01`) · 100% Outbox PUBLISHED** | ✅ **PASSED** |
| **Hot-Account Contention (k6)** | 50 VUs hammering single merchant row | **5,532 txs @ 184.17 RPS · 0 deadlocks** | ✅ **PASSED** |
| **Dispersed Load Benchmark (k6)** | 100 VUs across 50 accounts (Tuned pool: 30) | **7,397 txs @ 211.34 RPS · 0 errors** | ✅ **PASSED** |
| **Double-Entry Equilibrium** | System-wide Ledger Conservation | **Total Debits === Total Credits (Drift = 0)** | ✅ **PASSED** |
| **Transactional Outbox & Kafka** | Dual-write elimination & real-time streaming | **PostgreSQL `SKIP LOCKED` Relay · Apache Kafka KRaft** | ✅ **PASSED** |

---

## 1. 🧪 Unit Test Suite Verification (Vitest)

* **Test Framework:** Vitest 4 with Native ESM
* **Execution Time:** ~2.5 seconds across 21 test suites
* **Rule Count:** 84 isolated unit tests covering Auth, KYC, Accounts, Nuban, Ledger, Transfers, Notifications, Outbox Relay, Kafka Producer, and Kafka Consumer.

<details>
<summary><b>🔍 Click to expand Unit Test Console Output</b></summary>

```text
RUN  v4.1.12 /Users/macbook/Documents/GitHub/Banking-API

 ✓ src/modules/customers/customers.controller.spec.ts (1 test) 165ms
 ✓ src/modules/customers/customers.service.spec.ts (1 test) 161ms
 ✓ src/app.controller.spec.ts (2 tests) 138ms
 ✓ src/infrastructure/prisma/prisma.service.spec.ts (1 test) 115ms
 ✓ src/modules/ledger/ledger.service.spec.ts (6 tests) 148ms
 ✓ src/modules/notifications/notifications.service.spec.ts (3 tests) 148ms
 ✓ src/modules/auth/auth.service.spec.ts (1 test) 101ms
[32m[Nest] 32984  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying NIN: 12345[39m
[32m[Nest] 32984  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying NIN: 12345678901[39m
[32m[Nest] 32984  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying BVN: 12345678901[39m
[32m[Nest] 32984  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying Proof of Address: https://docs.bank.com/bill.pdf[39m
[32m[Nest] 32984  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[MockKycVerifierProvider] [39m[32m[MockKYC] Verifying biometric liveness session[39m
[32m[Nest] 32985  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaConsumerService] [39m[32mKafka Consumer subscribed to [banking.transfers, banking.accounts][39m
[32m[Nest] 32985  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaConsumerService] [39m[32mKafka Consumer subscribed to [banking.transfers, banking.accounts][39m
[32m[Nest] 32985  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaConsumerService] [39m[32mKafka Consumer disconnected.[39m
[32m[Nest] 32985  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaConsumerService] [39m[32mKafka Consumer subscribed to [banking.transfers, banking.accounts][39m
[32m[Nest] 32985  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaConsumerService] [39m[32m[AUDIT_EVENT_CONSUMED] Topic: banking.transfers | Partition: 0 | Key: transfer-1 | EventType: banking.transfers.completed | AggregateId: transfer-1[39m
 ✓ src/infrastructure/kafka/kafka-consumer.service.spec.ts (3 tests) 13ms
 ✓ src/modules/kyc/kyc.service.spec.ts (12 tests) 25ms
 ✓ src/modules/accounts/accounts.service.spec.ts (1 test) 236ms
 ✓ src/modules/ledger/ledger-reconciliation.service.spec.ts (3 tests) 246ms
[95m[Nest] 32983  - [39m10/21/2026, 12:48:14 PM [95m  DEBUG[39m [38;5;3m[OutboxRelayService] [39m[95mOutbox event event-1 [banking.transfers.completed] published to topic 'banking.transfers'[39m
 ✓ src/modules/accounts/accounts.controller.spec.ts (1 test) 83ms
 ✓ src/modules/outbox/outbox-relay.service.spec.ts (7 tests) 69ms
 ✓ src/modules/auth/auth.controller.spec.ts (1 test) 103ms
 ✓ src/common/filters/global-exception.filter.spec.ts (6 tests) 7ms
 ✓ src/common/idempotency/idempotency.service.spec.ts (8 tests) 7ms
 ✓ src/modules/transfers/transfers.service.spec.ts (14 tests) 9ms
 ✓ src/modules/accounts/nuban.service.spec.ts (3 tests) 8ms
[32m[Nest] 32992  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaService] [39m[32mConnected to Apache Kafka broker cluster successfully.[39m
[32m[Nest] 32992  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaService] [39m[32mConnected to Apache Kafka broker cluster successfully.[39m
[32m[Nest] 32992  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaService] [39m[32mDisconnected from Apache Kafka broker.[39m
[32m[Nest] 32992  - [39m10/21/2026, 12:48:14 PM [32m    LOG[39m [38;5;3m[KafkaService] [39m[32mConnected to Apache Kafka broker cluster successfully.[39m
 ✓ src/infrastructure/kafka/kafka.service.spec.ts (3 tests) 8ms
 ✓ src/modules/kyc/kyc.controller.spec.ts (4 tests) 3ms
 ✓ src/modules/transfers/transfers.controller.spec.ts (3 tests) 3ms

 Test Files  21 passed (21)
      Tests  84 passed (84)
   Start at  12:48:12
   Duration  2.66s (transform 740ms, setup 0ms, import 9.21s, tests 1.80s, environment 2ms)
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

stdout | test/app.e2e-spec.ts > AppController (e2e) > / (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:16.512Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"banking-audit-consumer-group"}

stdout | test/outbox-kafka.e2e-spec.ts > Transactional Outbox & Apache Kafka Streaming (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:16.511Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"banking-audit-consumer-group"}

stdout | test/concurrent-transfers.e2e-spec.ts > Concurrent Transfers & Deadlock Resistance (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:16.510Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"banking-audit-consumer-group"}

stdout | test/concurrent-transfers.e2e-spec.ts > Concurrent Transfers & Deadlock Resistance (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.577Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"banking-audit-consumer-group","memberId":"banking-api-4e03c421-7fdd-4664-9225-889b70587961","leaderId":"banking-api-d7f51a37-b1c0-4567-8f14-f1ac854aba6c","isLeader":false,"memberAssignment":{"banking.transfers":[0]},"groupProtocol":"RoundRobinAssigner","duration":2064}

stdout | test/outbox-kafka.e2e-spec.ts > Transactional Outbox & Apache Kafka Streaming (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.577Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"banking-audit-consumer-group","memberId":"banking-api-4bdb4dfc-6d04-4c5c-820c-325247fc442f","leaderId":"banking-api-d7f51a37-b1c0-4567-8f14-f1ac854aba6c","isLeader":false,"memberAssignment":{"banking.transfers":[2],"banking.accounts":[0]},"groupProtocol":"RoundRobinAssigner","duration":2064}

stdout | test/app.e2e-spec.ts > AppController (e2e) > / (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.577Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"banking-audit-consumer-group","memberId":"banking-api-186c406e-b756-4723-b2ff-b907014c5aea","leaderId":"banking-api-d7f51a37-b1c0-4567-8f14-f1ac854aba6c","isLeader":false,"memberAssignment":{"banking.transfers":[1],"banking.accounts":[2]},"groupProtocol":"RoundRobinAssigner","duration":2064}

stdout | test/app.e2e-spec.ts > AppController (e2e) > / (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.762Z","logger":"kafkajs","message":"[Runner] consumer not running, exiting","groupId":"banking-audit-consumer-group","memberId":"banking-api-186c406e-b756-4723-b2ff-b907014c5aea"}

stdout | test/app.e2e-spec.ts > AppController (e2e) > / (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.768Z","logger":"kafkajs","message":"[Consumer] Stopped","groupId":"banking-audit-consumer-group"}

stdout | test/app.e2e-spec.ts > AppController (e2e) > /health (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:18.815Z","logger":"kafkajs","message":"[Consumer] Starting","groupId":"banking-audit-consumer-group"}

stdout | test/outbox-kafka.e2e-spec.ts > Transactional Outbox & Apache Kafka Streaming (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:19.092Z","logger":"kafkajs","message":"[Runner] consumer not running, exiting","groupId":"banking-audit-consumer-group","memberId":"banking-api-4bdb4dfc-6d04-4c5c-820c-325247fc442f"}

stdout | test/outbox-kafka.e2e-spec.ts > Transactional Outbox & Apache Kafka Streaming (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:19.097Z","logger":"kafkajs","message":"[Consumer] Stopped","groupId":"banking-audit-consumer-group"}

 ✓ test/outbox-kafka.e2e-spec.ts (2 tests) 2853ms
stdout | test/concurrent-transfers.e2e-spec.ts > Concurrent Transfers & Deadlock Resistance (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:24.296Z","logger":"kafkajs","message":"[Runner] consumer not running, exiting","groupId":"banking-audit-consumer-group","memberId":"banking-api-4e03c421-7fdd-4664-9225-889b70587961"}

stdout | test/concurrent-transfers.e2e-spec.ts > Concurrent Transfers & Deadlock Resistance (e2e)
{"level":"INFO","timestamp":"2026-10-21T19:48:24.301Z","logger":"kafkajs","message":"[Consumer] Stopped","groupId":"banking-audit-consumer-group"}

 ✓ test/concurrent-transfers.e2e-spec.ts (4 tests) 8060ms
       ✓ should execute 20 concurrent cross-transfers (A->B and B->A) without deadlocks (40P01) or balance corruption  608ms
stdout | test/app.e2e-spec.ts > AppController (e2e) > /health (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:24.625Z","logger":"kafkajs","message":"[ConsumerGroup] Consumer has joined the group","groupId":"banking-audit-consumer-group","memberId":"banking-api-7d8754a9-8c29-4b02-857d-c6225987dc17","leaderId":"banking-api-d7f51a37-b1c0-4567-8f14-f1ac854aba6c","isLeader":false,"memberAssignment":{"banking.transfers":[0,1],"banking.accounts":[2]},"groupProtocol":"RoundRobinAssigner","duration":5810}

stdout | test/app.e2e-spec.ts > AppController (e2e) > /health (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:24.646Z","logger":"kafkajs","message":"[Runner] consumer not running, exiting","groupId":"banking-audit-consumer-group","memberId":"banking-api-7d8754a9-8c29-4b02-857d-c6225987dc17"}

stdout | test/app.e2e-spec.ts > AppController (e2e) > /health (GET)
{"level":"INFO","timestamp":"2026-10-21T19:48:24.648Z","logger":"kafkajs","message":"[Consumer] Stopped","groupId":"banking-audit-consumer-group"}

 ✓ test/app.e2e-spec.ts (2 tests) 8401ms
     ✓ / (GET)  2524ms
     ✓ /health (GET)  5876ms

 Test Files  3 passed (3)
      Tests  8 passed (8)
   Start at  12:48:15
   Duration  9.18s (transform 428ms, setup 0ms, import 1.74s, tests 19.31s, environment 0ms)
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

⚖️  System-Wide Total Debits:  5270160600
⚖️  System-Wide Total Credits: 5270160600
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
