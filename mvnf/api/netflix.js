// api/am.js - AM JZCloud + Handler Vercel + Tele (FIXED)
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://am.jzcloud.web.id';
const API_STATS = `${BASE_URL}/api/stats`;
const API_SEND = `${BASE_URL}/api/send-link`;
const API_VERIFY = `${BASE_URL}/api/verify-link`;

const HEADERS = {
  'Accept': 'application/json',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36',
  'Content-Type': 'application/json'
};

async function callApi(url, method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch(_) {}
    return { ok: res.ok, status: res.status, data: data || { result: text }, raw: text };
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, email, magicLink, link } = req.body || req.query || {};
    const act = (action || req.query?.action || '').toLowerCase();

    // 1. CEK STATUS
    if (req.method === 'GET' || act === 'stats' || act === 'status') {
      const r = await callApi(API_STATS, 'GET');
      return res.status(200).json({ success: r.ok, ...r.data, raw: r.raw?.slice(0, 500) });
    }

    // 2. KIRIM MAGIC LINK
    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      const r = await callApi(API_SEND, 'POST', { email: String(email).trim() });
      if (r.ok) {
        try { await sendAdminNotif(`✨ *AM BARU*\n\nEmail: \`${email}\`\nStatus: Link dikirim\n\nDari: MVNF Premium`); } catch(e){}
      }
      return res.status(200).json({ success: r.ok, ...r.data, error: r.ok ? undefined : (r.data?.message || r.data?.error || r.raw) });
    }

    // 3. VERIFY MAGIC LINK
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      const r = await callApi(API_VERIFY, 'POST', { email: String(email).trim(), magicLink: String(finalLink).trim() });
      if (r.ok) {
        try { await sendAdminNotif(`✅ *AM VERIFIED*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); } catch(e){}
      }
      return res.status(200).json({ success: r.ok, ...r.data, error: r.ok ? undefined : (r.data?.message || r.data?.error || r.raw) });
    }

    return res.status(200).json({ success: false, error: 'Action nggak dikenal. Pake: stats / send / verify' });

  } catch (e) {
    console.log('AM error:', e.message);
    return res.status(200).json({ success: false, error: e.message });
  }
}
