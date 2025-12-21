// src/services/payosService.js
// Lightweight PayOS client. NOTE: Replace endpoint paths with the real PayOS API endpoints.
// This implementation tries the provided bases and generic paths. Adjust according to PayOS docs.

const PAYOS_API_BASES = [
  'https://api.payos.vn',
  'https://payos.vn/api',
  'https://api.payos.vn/v2',
  'https://my.payos.vn/',
  'https://payos.vn/v2'
];
const PAYOS_API_BASE = PAYOS_API_BASES[0]; // default, falls back in try loop if needed
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '86e7a6d4-2705-48cf-b697-a0cb80cf916c';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '54633680-503a-4093-a524-a8fc27d0aad9';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || 'a5cd5bb052325b32e24525ef2410e61a6a1262ea7c7f9';

// Try a set of candidate endpoints that might exist on PayOS. Add merchant-specific paths you provided.
const CANDIDATE_PATHS = [
  '/v2/payments',
  '/v2/transactions',
  '/payments',
  '/qr/create',
  '/create_qr',
  '/v2/qrs',
  '/payment-requests',
  '/v2/payment-requests',
  '/payment-requests/create',
  '/v2/payment-requests/create',
  '/payment-gateway/14619',
  '/v2/payment-gateway/14619',
  '/payment-gateway/14619/create',
  '/payment-gateway/14619/transactions',
  '/checkout',
  '/v1/checkout'
];

async function tryPostToBases(path, body) {
  const attempts = [];
  for (const base of PAYOS_API_BASES) {
    const url = `${base.replace(/\/+$/, '')}${path}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PAYOS_API_KEY,
          'x-client-id': PAYOS_CLIENT_ID,
          // Add other headers required by PayOS if needed
        },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => null);
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch(e) { parsed = text; }

      attempts.push({ url, ok: res.ok, status: res.status, body: parsed });

      if (res.ok) {
        return { url, data: parsed };
      }

      // If server responds but not OK, continue to next
    } catch (err) {
      attempts.push({ url, error: String(err) });
      // network error - try next base
    }
  }
  const err = new Error('All PayOS endpoints failed or returned non-OK');
  err.attempts = attempts;
  throw err;
}

export async function createQrPayment({ amount, description = '', externalId = '' }) {
  // Build body matching the pattern used in ba.js/createPayOSPaymentLink
  // orderCode should be numeric; if externalId is not numeric, use timestamp
  const orderCode = String(externalId || Date.now()).replace(/[^0-9]/g, '') || String(Date.now());

  const body = {
    orderCode: Number(orderCode),
    amount: Number(amount) || 0,
    description: description || `Thanh toán ${orderCode}`,
    items: [
      {
        name: description || `Order ${orderCode}`,
        quantity: 1,
        price: Number(amount) || 0,
      }
    ],
    cancelUrl: 'https://pay.payos.vn/web/cancel',
    returnUrl: 'https://pay.payos.vn/web/success'
  };

  // Try candidate paths until one works
  for (const p of CANDIDATE_PATHS) {
    try {
      const { url, data } = await tryPostToBases(p, body);
      // Expecting data to contain something like { id, qr, deeplink, payment_link } or data.checkoutUrl
      return { url, data };
    } catch (err) {
      // ignore and try next path
    }
  }

  throw new Error('Unable to create PayOS payment - please configure PayOS paths');
}

export async function getPaymentStatus(paymentId) {
  // Poll candidate bases to get status for a given payment ID. This is a generic approach
  // and must be adapted to the real PayOS API.
  for (const base of PAYOS_API_BASES) {
    const candidates = [
      `/v2/payments/${paymentId}`,
      `/v2/transactions/${paymentId}`,
      `/payments/${paymentId}`,
      `/transaction/${paymentId}`,
    ];
    for (const c of candidates) {
      const url = `${base.replace(/\/+$/, '')}${c}`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': PAYOS_API_KEY,
          }
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (err) {
        // try next
      }
    }
  }
  throw new Error('Unable to fetch payment status from PayOS');
}

export default { createQrPayment, getPaymentStatus };
