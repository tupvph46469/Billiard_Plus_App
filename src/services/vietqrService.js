// src/services/vietqrService.js
// Lightweight VietQR client - tries API then falls back to public image generator

const VIETQR_API_BASE = process.env.VIETQR_API_BASE || 'https://api.vietqr.io/v2';
const VIETQR_CLIENT_ID = process.env.VIETQR_CLIENT_ID || '34832606-9b37-4f10-9618-43163adddee0';
const VIETQR_API_KEY = process.env.VIETQR_API_KEY || '2c1d25ae-3269-4b39-906b-a8644be32186';

async function tryPostToVietQr(path, body) {
  const url = `${VIETQR_API_BASE.replace(/\/+$/, '')}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': VIETQR_CLIENT_ID,
        'x-api-key': VIETQR_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => null);
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch(e) { parsed = text; }

    if (res.ok) {
      return { url, data: parsed };
    } else {
      const err = new Error(`VietQR returned ${res.status}`);
      err.url = url; err.status = res.status; err.body = parsed;
      throw err;
    }
  } catch (err) {
    err = err || new Error('Network error');
    throw err;
  }
}

export async function createVietQr({ amount, addInfo = '', account = '050598', accountName = 'PHAM VAN TU', bank = 'MB' }) {
  // Try candidate paths. Actual VietQR API may expect different shape; adapt if you have docs.
  const body = {
    accountNo: account,
    accountName,
    amount: Number(amount) || 0,
    addInfo,
    bankCode: bank
  };

  const CANDIDATE = ['/qrcode', '/create', '/create_qr', '/qr'];
  const attempts = [];
  for (const p of CANDIDATE) {
    try {
      const r = await tryPostToVietQr(p, body);
      // If returns data with image or qr_text, try to find it
      const d = r.data || {};
      // Common fields: image, qr, qr_image, qrBase64
      const img = d.image || d.qr_image || d.qr || d.data || d.result || null;
      // If it's base64, create data URI
      let imageUrl = null;
      if (typeof img === 'string') {
        if (img.startsWith('http')) imageUrl = img;
        else if (/^data:image\/.+;base64,/.test(img)) imageUrl = img;
        else if (/^[A-Za-z0-9+/=\n]+$/.test(img) && img.length > 100) imageUrl = `data:image/png;base64,${img}`;
      }

      if (imageUrl) {
        return { source: 'vietqr-api', url: imageUrl, raw: d };
      }

      // Sometimes API returns text payload, use public generator
      attempts.push({ url: r.url, status: r.status, body: d });
    } catch (err) {
      attempts.push({ url: err.url || `${VIETQR_API_BASE}${p}`, status: err.status || 'ERR', body: err.body || err.message });
    }
  }

  // Fallback to img.vietqr.io public image (no API key required)
  const imgUrl = `https://img.vietqr.io/image/${bank}-${account}-qr_only.png?amount=${encodeURIComponent(amount)}${addInfo ? `&addInfo=${encodeURIComponent(addInfo)}` : ''}&accountName=${encodeURIComponent(accountName)}`;
  return { source: 'fallback', url: imgUrl, attempts };
}

export default { createVietQr };
