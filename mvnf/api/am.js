// api/am.js - AM Premium - MVNF
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://am.jzcloud.web.id';
const API_STATS = `${BASE_URL}/api/stats`;
const API_SEND = `${BASE_URL}/api/send-link`;
const API_VERIFY = `${BASE_URL}/api/verify-link`;

const HEADERS = {
  'Accept': 'application/json',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'User-Agent': 'Mozilla/5.0',
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

    if (req.method === 'GET' || act === 'stats' || act === 'status') {
      const r = await callApi(API_STATS, 'GET');
      return res.status(200).json({ success: r.ok, ...r.data, raw: r.raw?.slice(0, 500) });
    }

    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      const r = await callApi(API_SEND, 'POST', { email: String(email).trim() });
      if (r.ok) {
        try { await sendAdminNotif(`✨ *AM BARU*\n\nEmail: \`${email}\`\nStatus: Link dikirim\n\nDari: MVNF Premium`); } catch(e){}
      }
      const rawErr = r.data?.message || r.data?.error?.message || r.data?.error || r.raw || '';
      return res.status(200).json({ success: r.ok, ...r.data, error: r.ok ? undefined : translateError(rawErr) });
    }

    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      const r = await callApi(API_VERIFY, 'POST', { email: String(email).trim(), magicLink: String(finalLink).trim() });
      if (r.ok) {
        try { await sendAdminNotif(`✅ *AM VERIFIED*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); } catch(e){}
      }
      const rawErr = r.data?.message || r.data?.error?.message || r.data?.error || r.raw || '';
      return res.status(200).json({ success: r.ok, ...r.data, error: r.ok ? undefined : translateError(rawErr) });
    }

    return res.status(200).json({ success: false, error: 'Action nggak dikenal. Pake: stats / send / verify' });
  } catch (e) {
    return res.status(200).json({ success: false, error: translateError(e.message) });
  }
}
