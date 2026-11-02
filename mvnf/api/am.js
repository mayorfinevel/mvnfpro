// api/am.js - AM Premium - MVNF (No Limit Edition)
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://am.noxxyrorr.biz.id';
const API_GENERATE = `${BASE_URL}/api/am/generate`;
const API_STATS = `${BASE_URL}/api/stats`;
const API_SEND = `${BASE_URL}/api/send-link`;
const API_VERIFY = `${BASE_URL}/api/verify-link`;

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
];

function randomIp() {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `${octet()}.${octet()}.${octet()}.${octet()}`;
}

function randomUa() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function translateError(msg) {
  const m = String(msg || '');
  if (m.includes('QUOTA_EXCEEDED') || m.includes('Exceeded daily quota') || m.includes('Batas limit')) {
    return 'Server AM sedang penuh (Quota Upstream). Coba klik 2-3 kali lagi, sistem sedang rotasi IP otomatis.';
  }
  if (m.includes('INVALID_EMAIL') || m.includes('invalid-email')) return 'Email-nya nggak valid, cek lagi.';
  if (m.includes('TOO_MANY')) return 'Kebanyakan request, tunggu 5 menit lagi.';
  if (m.includes('Failed to fetch') || m.includes('timeout') || m.includes('ETIMEDOUT')) {
    return 'Koneksi ke server AM timeout. Coba klik ulang.';
  }
  return m.slice(0, 300);
}

// Rotasi IP, User-Agent, & Origin
async function callApi(url, method, body, useBypass = true) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  if (useBypass) {
    const fakeIp = randomIp();
    headers['Origin'] = BASE_URL;
    headers['Referer'] = `${BASE_URL}/`;
    headers['User-Agent'] = randomUa();
    headers['X-Forwarded-For'] = fakeIp;
    headers['X-Real-IP'] = fakeIp;
    headers['CF-Connecting-IP'] = fakeIp;
    headers['Client-IP'] = fakeIp;
  } else {
    headers['Origin'] = BASE_URL;
    headers['Referer'] = `${BASE_URL}/`;
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || { result: text }, raw: text };
  } catch (err) {
    return { ok: false, status: 0, data: null, raw: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function isOkBody(d) {
  if (!d || typeof d !== 'object') return false;
  return d.success === true || d.status === true || d.ok === true;
}

function extractError(d, fallback = '') {
  if (!d) return fallback;
  return d.message || (d.error && d.error.message) || d.error || d.result || fallback;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, email, magicLink, link, customOrderId, cookie, count, emails } = req.body || req.query || {};
    const act = (action || req.query?.action || '').toLowerCase();

    // ---- stats ----
    if (req.method === 'GET' || act === 'stats' || act === 'status') {
      const r = await callApi(API_STATS, 'GET', null, false);
      const d = r.data || {};
      return res.status(200).json({
        success: r.ok && isOkBody(d),
        total: d.total || 0,
        today: d.today || 0
      });
    }

    // ---- send link (Email Sendiri + Bypass) ----
    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      
      const targetEmail = String(email).trim();
      const payload = { email: targetEmail };
      
      let r = { ok: false, data: {} };
      let attempt = 0;
      let lastError = '';

      // Loop tembak 3x pakai IP & UA berbeda
      while (attempt < 3) {
        attempt++;
        r = await callApi(API_SEND, 'POST', payload, true);
        let d = r.data || {};
        
        if (r.ok && isOkBody(d)) {
          lastError = '';
          break; 
        }
        
        lastError = extractError(d, r.raw);
        
        // Kalau error-nya BUKAN quota, langsung break
        if (!lastError.match(/QUOTA|Exceeded|Batas limit/i)) break;
        
        // Delay 500ms sebelum ganti IP
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const d = r.data || {};
      const ok = r.ok && isOkBody(d);

      // FALLBACK MUTLAK: Kalau tetep Quota, paksa pakai endpoint /api/am/generate
      if (!ok && lastError.match(/QUOTA|Exceeded|Batas limit/i)) {
         const genPayload = { customOrderId: `bypass-${Date.now()}` };
         const rGen = await callApi(API_GENERATE, 'POST', genPayload, true);
         const dGen = rGen.data || {};
         
         if (rGen.ok && isOkBody(dGen)) {
             // Generate sukses, kita anggap link terkirim
             try { await sendAdminNotif(`✨ *AM BYPASS*\n\nEmail User: \`${targetEmail}\`\nEmail Gen: \`${dGen.email}\`\nStatus: Quota bypassed\n\nDari: MVNF Premium`); } catch (e) {}
             
             return res.status(200).json({
                 success: true,
                 bypassed: true,
                 email: dGen.email,
                 inboxLink: dGen.inboxLink,
                 cookie: dGen.cookie,
                 message: 'Limit server terlewati, akun dialihkan ke email generate otomatis.'
             });
         }
      }

      if (ok) {
        try { await sendAdminNotif(`✨ *AM BARU*\n\nEmail: \`${targetEmail}\`\nStatus: Link dikirim\n\nDari: MVNF Premium`); } catch (e) {}
      }

      return res.status(200).json({
        success: ok,
        email: d.email || targetEmail,
        cookie: d.cookie,
        message: d.message,
        error: ok ? undefined : translateError(lastError)
      });
    }

    // ---- verify link ----
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      
      const payload = { email: String(email).trim(), magicLink: String(finalLink).trim() };
      if (customOrderId && String(customOrderId).trim()) payload.customOrderId = String(customOrderId).trim();
      if (cookie && String(cookie).trim()) payload.cookie = String(cookie).trim();

      const r = await callApi(API_VERIFY, 'POST', payload, true);
      const d = r.data || {};
      const ok = r.ok && (d.success === true || d.authenticated === true);

      if (ok) {
        try { await sendAdminNotif(`✅ *AM VERIFIED*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); } catch (e) {}
      }

      return res.status(200).json({
        success: ok, authenticated: !!d.authenticated, premiumActive: !!d.premiumActive,
        email: d.email, orderId: d.orderId, validUntil: d.validUntil, tier: d.tier,
        membershipStatus: d.membershipStatus, idToken: d.idToken, cookie: d.cookie,
        stats: d.stats, message: d.message,
        error: ok ? undefined : translateError(extractError(d, r.raw))
      });
    }

    return res.status(200).json({ success: false, error: 'Action nggak dikenal.' });
  } catch (e) {
    return res.status(200).json({ success: false, error: translateError(e.message) });
  }
}
