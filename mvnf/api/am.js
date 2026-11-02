// api/am.js - AM Premium - MVNF (Bulk Support)
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://am.noxxyrorr.biz.id';
const API_GENERATE = `${BASE_URL}/api/am/generate`;
const API_STATS = `${BASE_URL}/api/stats`;
const API_SEND = `${BASE_URL}/api/send-link`;
const API_SEND_ALT = `${BASE_URL}/api/request-link`; 
const API_VERIFY = `${BASE_URL}/api/verify-link`;

const HEADERS = {
  'Accept': 'application/json',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Content-Type': 'application/json'
};

function translateError(msg) {
  const m = String(msg || '');
  if (m.includes('QUOTA_EXCEEDED') || m.includes('Exceeded daily quota') || m.includes('Batas limit')) {
    return 'Jatah kirim email harian lagi penuh. Coba lagi dalam beberapa menit atau hubungi Admin.';
  }
  if (m.includes('INVALID_EMAIL') || m.includes('invalid-email')) return 'Email-nya nggak valid, cek lagi.';
  if (m.includes('TOO_MANY')) return 'Kebanyakan request, tunggu 5 menit lagi.';
  if (m.includes('Failed to fetch') || m.includes('timeout') || m.includes('ETIMEDOUT')) {
    return 'Koneksi ke server timeout. Coba klik ulang.';
  }
  return m.slice(0, 300);
}

async function callApi(url, method, body, customHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...HEADERS, ...customHeaders },
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

function randomIp() {
  return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
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
      const r = await callApi(API_STATS, 'GET');
      const d = r.data || {};
      return res.status(200).json({
        success: r.ok && isOkBody(d),
        total: d.total || 0,
        today: d.today || 0
      });
    }

    // ---- generate (single) ----
    if (act === 'generate' || act === 'gen') {
      const payload = {};
      if (customOrderId && String(customOrderId).trim()) payload.customOrderId = String(customOrderId).trim();
      const r = await callApi(API_GENERATE, 'POST', payload);
      const d = r.data || {};
      if (!r.ok || !isOkBody(d)) {
        return res.status(200).json({ success: false, error: translateError(extractError(d, r.raw)) });
      }
      try {
        await sendAdminNotif(`✨ *AM GENERATED*\n\nEmail: \`${d.email}\`\nTier: ${d.tier || '-'}\nOrder: ${d.orderId || '-'}\n\nDari: MVNF Premium`);
      } catch (e) {}
      return res.status(200).json({
        success: true, email: d.email, inboxLink: d.inboxLink, provider: d.provider,
        membershipStatus: d.membershipStatus, tier: d.tier, planName: d.planName,
        subscription: d.subscription, orderId: d.orderId, validUntil: d.validUntil,
        idToken: d.idToken, cookie: d.cookie, createdAt: d.createdAt, stats: d.stats, message: d.message
      });
    }

    // ---- bulk generate (acak dari Noxxy) ----
    if (act === 'bulk-generate' || act === 'bulk-gen') {
      const total = Math.max(1, Math.min(parseInt(count, 10) || 1, 10)); // Max 10 biar ga timeout Vercel
      const accounts = [];
      
      for (let i = 1; i <= total; i++) {
        const customId = customOrderId ? `${customOrderId}-${i}` : undefined;
        const payload = customId ? { customOrderId: customId } : {};
        
        const r = await callApi(API_GENERATE, 'POST', payload);
        const d = r.data || {};
        
        if (r.ok && isOkBody(d)) {
          accounts.push({
            index: i, status: true, email: d.email, inboxLink: d.inboxLink,
            tier: d.tier, orderId: d.orderId, cookie: d.cookie
          });
        } else {
          accounts.push({ index: i, status: false, error: translateError(extractError(d, r.raw)) });
        }
        // Delay 1 detik antar request
        if (i < total) await new Promise(r => setTimeout(r, 1000));
      }

      try {
        await sendAdminNotif(`📦 *AM BULK GENERATED*\n\nTotal: ${total}\nSukses: ${accounts.filter(a => a.status).length}\n\nDari: MVNF Premium`);
      } catch (e) {}

      return res.status(200).json({
        success: true,
        totalRequested: total,
        totalSuccess: accounts.filter(a => a.status).length,
        accounts
      });
    }

    // ---- bulk send (email sendiri) ----
    if (act === 'bulk-send' || act === 'bulk-send-link') {
      let listEmails = [];
      
      if (Array.isArray(emails)) {
        listEmails = emails.map(e => String(e).trim()).filter(e => e.includes('@'));
      } else if (typeof emails === 'string') {
        listEmails = emails.split(/[\n,]+/).map(e => e.trim()).filter(e => e.includes('@'));
      } else if (email) {
        listEmails = [String(email).trim()];
      }

      if (!listEmails.length) {
        return res.status(200).json({ success: false, error: 'Daftar email kosong / tidak valid' });
      }

      const total = Math.min(listEmails.length, 10); // Batasi 10 per request biar aman
      const results = [];

      for (let i = 0; i < total; i++) {
        const targetEmail = listEmails[i];
        const payload = { email: targetEmail };
        
        // Fallback logic (request-link -> send-link dengan X-Forwarded-For)
        let r = await callApi(API_SEND_ALT, 'POST', payload);
        let d = r.data || {};

        if (!r.ok || !isOkBody(d)) {
          const isQuota = extractError(d).match(/QUOTA|Exceeded|Batas limit/i);
          if (isQuota || r.status === 404) {
             r = await callApi(API_SEND, 'POST', payload, { 'X-Forwarded-For': randomIp() });
             d = r.data || {};
          }
        }

        const ok = r.ok && isOkBody(d);
        results.push({
          email: targetEmail,
          success: ok,
          cookie: d.cookie || null,
          message: d.message || null,
          error: ok ? undefined : translateError(extractError(d, r.raw))
        });

        // Jeda 1.5 detik antar email biar ga dianggap spam
        if (i < total - 1) await new Promise(r => setTimeout(r, 1500));
      }

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        try {
          await sendAdminNotif(`📦 *AM BULK SEND*\n\nTarget: ${total}\nSukses: ${successCount}\n\nDari: MVNF Premium`);
        } catch (e) {}
      }

      return res.status(200).json({
        success: true,
        totalRequested: total,
        totalSuccess: successCount,
        results
      });
    }

    // ---- send link (single) ----
    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      
      const payload = { email: String(email).trim() };
      let r = await callApi(API_SEND_ALT, 'POST', payload);
      let d = r.data || {};

      if (!r.ok || !isOkBody(d)) {
        const isQuota = extractError(d).match(/QUOTA|Exceeded|Batas limit/i);
        if (isQuota || r.status === 404) {
           r = await callApi(API_SEND, 'POST', payload, { 'X-Forwarded-For': randomIp() });
           d = r.data || {};
        }
      }

      const ok = r.ok && isOkBody(d);
      if (ok) {
        try { await sendAdminNotif(`✨ *AM BARU*\n\nEmail: \`${email}\`\nStatus: Link dikirim\n\nDari: MVNF Premium`); } catch (e) {}
      }

      return res.status(200).json({
        success: ok, email: d.email || String(email).trim(), cookie: d.cookie,
        message: d.message, error: ok ? undefined : translateError(extractError(d, r.raw))
      });
    }

    // ---- verify link ----
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      
      const payload = { email: String(email).trim(), magicLink: String(finalLink).trim() };
      if (customOrderId && String(customOrderId).trim()) payload.customOrderId = String(customOrderId).trim();
      if (cookie && String(cookie).trim()) payload.cookie = String(cookie).trim();

      const r = await callApi(API_VERIFY, 'POST', payload);
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

    return res.status(200).json({ success: false, error: 'Action nggak dikenal. Pake: stats / send / verify / generate / bulk-generate / bulk-send' });
  } catch (e) {
    return res.status(200).json({ success: false, error: translateError(e.message) });
  }
}
