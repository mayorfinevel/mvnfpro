// api/am.js - AM Premium - MVNF
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://am.noxxyrorr.biz.id';
const API_GENERATE = `${BASE_URL}/api/am/generate`;
const API_STATS = `${BASE_URL}/api/stats`;
const API_SEND = `${BASE_URL}/api/send-link`;
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
  if (m.includes('QUOTA_EXCEEDED') || m.includes('Exceeded daily quota')) {
    return 'Jatah kirim email hari ini habis. Coba lagi besok ya, atau chat Admin buat dibantu manual.';
  }
  if (m.includes('INVALID_EMAIL') || m.includes('invalid-email')) return 'Email-nya nggak valid, cek lagi.';
  if (m.includes('TOO_MANY')) return 'Kebanyakan request, tunggu 5 menit lagi.';
  return m.slice(0, 300);
}

async function callApi(url, method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch(url, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data || { result: text }, raw: text };
  } finally {
    clearTimeout(timer);
  }
}

function isOkBody(d) {
  if (!d || typeof d !== 'object') return false;
  return d.success === true || d.status === true || d.ok === true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, email, magicLink, link, customOrderId } = req.body || req.query || {};
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

    // ---- generate (baru, endpoint noxxy) ----
    if (act === 'generate' || act === 'gen') {
      const payload = {};
      if (customOrderId && String(customOrderId).trim()) {
        payload.customOrderId = String(customOrderId).trim();
      }
      const r = await callApi(API_GENERATE, 'POST', payload);
      const d = r.data || {};
      if (!r.ok || !isOkBody(d)) {
        const rawErr = d.message || (d.error && d.error.message) || d.error || r.raw || '';
        return res.status(200).json({ success: false, error: translateError(rawErr) });
      }
      try {
        await sendAdminNotif(`✨ *AM GENERATED*\n\nEmail: \`${d.email}\`\nTier: ${d.tier || '-'}\nOrder: ${d.orderId || '-'}\n\nDari: MVNF Premium`);
      } catch (e) {}
      return res.status(200).json({
        success: true,
        email: d.email,
        inboxLink: d.inboxLink,
        provider: d.provider,
        membershipStatus: d.membershipStatus,
        tier: d.tier,
        planName: d.planName,
        subscription: d.subscription,
        orderId: d.orderId,
        validUntil: d.validUntil,
        idToken: d.idToken,
        cookie: d.cookie,
        createdAt: d.createdAt,
        stats: d.stats,
        message: d.message
      });
    }

    // ---- send link ----
    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      const r = await callApi(API_SEND, 'POST', { email: String(email).trim() });
      const d = r.data || {};
      const ok = r.ok && isOkBody(d);
      if (ok) {
        try {
          await sendAdminNotif(`✨ *AM BARU*\n\nEmail: \`${email}\`\nStatus: Link dikirim\n\nDari: MVNF Premium`);
        } catch (e) {}
      }
      const rawErr = d.message || (d.error && d.error.message) || d.error || r.raw || '';
      return res.status(200).json({
        success: ok,
        email: d.email || String(email).trim(),
        cookie: d.cookie,
        message: d.message,
        error: ok ? undefined : translateError(rawErr)
      });
    }

    // ---- verify link ----
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      const payload = { email: String(email).trim(), magicLink: String(finalLink).trim() };
      if (customOrderId && String(customOrderId).trim()) {
        payload.customOrderId = String(customOrderId).trim();
      }
      const r = await callApi(API_VERIFY, 'POST', payload);
      const d = r.data || {};
      const ok = r.ok && (d.success === true || d.authenticated === true);
      if (ok) {
        try {
          await sendAdminNotif(`✅ *AM VERIFIED*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`);
        } catch (e) {}
      }
      const rawErr = d.message || (d.error && d.error.message) || d.error || r.raw || '';
      return res.status(200).json({
        success: ok,
        authenticated: !!d.authenticated,
        premiumActive: !!d.premiumActive,
        email: d.email,
        orderId: d.orderId,
        validUntil: d.validUntil,
        tier: d.tier,
        membershipStatus: d.membershipStatus,
        idToken: d.idToken,
        cookie: d.cookie,
        stats: d.stats,
        message: d.message,
        error: ok ? undefined : translateError(rawErr)
      });
    }

    return res.status(200).json({ success: false, error: 'Action nggak dikenal. Pake: stats / send / verify / generate' });
  } catch (e) {
    return res.status(200).json({ success: false, error: translateError(e.message) });
  }
}
