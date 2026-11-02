// ============================================================
// MVNF - api/log.js
// Log Admin - nyimpen siapa aja yang generate
// Password admin: MVNF123
// ============================================================

let LOGS = globalThis.__MVNF_LOGS || [];
globalThis.__MVNF_LOGS = LOGS;

const ADMIN_PASS = 'MVNF123';

export default async function handler(req, res) {

  // --- AMBIL LOG (buat admin.html) ---
  if (req.method === 'GET') {
    const pass = req.query.pass || '';
    if (pass !== ADMIN_PASS) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }
    return res.status(200).json({
      success: true,
      total: LOGS.length,
      logs: [...LOGS].reverse().slice(0, 200)
    });
  }

  // --- SIMPAN LOG ---
  if (req.method === 'POST') {
    const body = req.body || {};

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || 'unknown';

    const log = {
      id: Date.now(),
      time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      service: body.service || 'unknown',
      device_id: body.device_id || '-',
      device: body.device || '-',
      browser: body.browser || '-',
      platform: body.platform || '-',
      screen: body.screen || '-',
      language: body.language || '-',
      ip: ip,
      email: body.email || '',
      result: body.result || '',
      extra: body.token || body.error || '',
      userAgent: (body.userAgent || '').slice(0, 180)
    };

    LOGS.push(log);
    if (LOGS.length > 500) LOGS = LOGS.slice(-500);
    globalThis.__MVNF_LOGS = LOGS;

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}