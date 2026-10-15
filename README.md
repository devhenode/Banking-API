# 🏦 Banking API

> Building a banking API **in public**, from a monolith to **microservices**, **event-driven** design and **safe concurrency**.

![Status](https://img.shields.io/badge/status-Phase%201%20·%20Core%20Monolith-blue)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

---

## ✨ What it does

- 👤 Customer sign-up with email/phone and **OTP verification**
- 🏧 Account opening with unique account numbers
- 🪪 Tiered **KYC** (NIN → BVN + address → liveness)
- 💸 Transfers on a **double-entry ledger**
- 🔁 **Idempotent** money movement, so retries never charge twice
- 🔒 **Concurrency-safe** balances, so no double-spend

Testable end-to-end through **Postman**.

## 🗺️ Roadmap

| Phase | Focus | Status |
|:---:|---|:---:|
| 0 | Domain design: money, ledger, idempotency | ✅ Done |
| 1 | Core monolith: auth, accounts, ledger, transfers | 🟡 In progress |
| 2 | Docker, CI/CD, deployment | ⏳ |
| 3 | Background workers & queues | ⏳ |
| 4 | Concurrency & load testing | ⏳ |
| 5 | Domain events & transactional outbox | ⏳ |
| 6 | Kafka | ⏳ |
| 7 | Microservices | ⏳ |
| 8 | Kubernetes & observability | ⏳ |

## 🚀 Local setup

```bash
cp .env.example .env        # then fill in real local values
docker compose up -d        # Postgres 16 (Alpine)
npm install
npm run start:dev           # http://localhost:3000
```

## 📚 Docs

- [Design Document](docs/DESIGN.md): money rules, ledger model, idempotency, concurrency
