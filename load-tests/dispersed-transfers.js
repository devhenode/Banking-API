import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

// Load seeded accounts and tokens at init stage
const testData = JSON.parse(open('./test-data.json'));

export const options = {
    stages: [
        { duration: '5s', target: 25 },   // Warm up to 25 VUs
        { duration: '10s', target: 100 }, // Scale to 100 concurrent VUs
        { duration: '15s', target: 100 }, // Sustain peak dispersed throughput at 100 VUs
        { duration: '5s', target: 0 },    // Cooldown ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],           // Failed requests must be under 1%
        http_req_duration: ['p(95)<600', 'p(99)<1200'], // p95 < 600ms, p99 < 1200ms
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
    // Ring routing: VU i transfers to account (i + 1)
    const senderIndex = (exec.vu.idInTest - 1) % testData.senders.length;
    const destIndex = (senderIndex + 1) % testData.senders.length;

    const source = testData.senders[senderIndex];
    const destination = testData.senders[destIndex];

    const baseUrl = __ENV.API_URL || 'http://[::1]:3000';
    const url = `${baseUrl}/transfers`;
    const idempotencyKey = generateUUID();

    const payload = JSON.stringify({
        sourceAccountId: source.accountId,
        destinationAccountNumber: destination.accountNumber,
        amount: '100', // ₦1.00 in minor units (kobo)
        currency: 'NGN',
        description: `Dispersed transfer from VU ${exec.vu.idInTest}`,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${source.token}`,
            'Idempotency-Key': idempotencyKey,
        },
        tags: { name: 'DispersedTransfer' },
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

    // Small sleep between iterations (20ms) to allow up to ~50 req/s per VU
    sleep(0.02);
}
