import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Load seeded accounts and tokens at init stage
const testData = JSON.parse(open('./test-data.json'));

export const options = {
    stages: [
        { duration: '5s', target: 10 },  // Ramp up to 10 VUs
        { duration: '20s', target: 50 }, // Peak contention: 50 concurrent VUs hammering the merchant row
        { duration: '5s', target: 0 },   // Cooldown ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],           // Failed requests must be under 1%
        http_req_duration: ['p(95)<800', 'p(99)<1500'], // p95 < 800ms, p99 < 1500ms
    },
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export default function () {
    // Distribute VUs across the 50 seeded senders
    const senderIndex = (exec.vu.idInTest - 1) % testData.senders.length;
    const sender = testData.senders[senderIndex];

    const baseUrl = __ENV.API_URL || 'http://[::1]:3000';
    const url = `${baseUrl}/transfers`;
    const idempotencyKey = generateUUID();

    const payload = JSON.stringify({
        sourceAccountId: sender.accountId,
        destinationAccountNumber: testData.merchant.accountNumber,
        amount: '100', // ₦1.00 in minor units (kobo)
        currency: 'NGN',
        description: `Contention transfer from VU ${exec.vu.idInTest}`,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sender.token}`,
            'Idempotency-Key': idempotencyKey,
        },
        tags: { name: 'HotAccountTransfer' },
    };

    const res = http.post(url, payload, params);

    const success = check(res, {
        'status is 201': (r) => r.status === 201,
        'has transfer id': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body && body.id !== undefined;
            } catch (_) {
                return false;
            }
        },
    });

    if (!success && res.status !== 201) {
        console.error(`VU ${exec.vu.idInTest} transfer failed: HTTP ${res.status} - ${res.body}`);
    }

    // Small sleep between iterations (50ms) to throttle each VU to ~20 req/s max
    sleep(0.05);
}
