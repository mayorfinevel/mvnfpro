// ---------------------------------------------------------
// 🔥 Author   : Dhanz - DIOPREK BUAT MVNF PRO
// 🌸 Date     : 5 November 2026
// 🍂 Function : Alight Motion (WILLzzz API) - NO LIMIT
// 🍁 Notes : Mohon untuk tidak menghapus watermark ini.
// ---------------------------------------------------------
import { sendAdminNotif } from "./_tele.js";

export const config = { maxDuration: 60 };

const BASE_URL = 'https://api.wilz.web.id/premium/alightmotion';

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, email, magicLink, link } = req.body || req.query || {};
    const act = (action || req.query?.action || 'stats').toLowerCase();

    // ==========================================
    // 1. CEK STATISTIK / STATUS API
    // ==========================================
    if (req.method === 'GET' || act === 'stats' || act === 'status') {
      try {
        const r = await fetch(`${BASE_URL}?action=stats`, { headers: DEFAULT_HEADERS });
        const data = await r.json();
        return res.status(200).json({ status: true, ...data });
      } catch (e) {
        return res.status(200).json({ status: false, error: "Gagal cek statistik: " + e.message });
      }
    }

    // ==========================================
    // 2. KIRIM MAGIC LINK (SEND)
    // ==========================================
    if (act === 'send' || act === 'send-link') {
      if (!email) return res.status(200).json({ status: false, error: 'Email kosong' });
      
      try {
        const targetUrl = `${BASE_URL}?action=send&email=${encodeURIComponent(email)}`;
        const r = await fetch(targetUrl, { headers: DEFAULT_HEADERS });
        const data = await r.json();

        // Notif ke Telegram Admin
        try { 
          await sendAdminNotif(`✨ *AM SEND LINK (WILLzzz)*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); 
        } catch (e) {}

        return res.status(200).json(data);
      } catch (e) {
        return res.status(200).json({ status: false, error: "Gagal kirim email: " + e.message });
      }
    }

    // ==========================================
    // 3. VERIFIKASI MAGIC LINK (VERIFY)
    // ==========================================
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ status: false, error: 'Email & Link wajib diisi' });

      try {
        const targetUrl = `${BASE_URL}?action=verify&email=${encodeURIComponent(email)}&link=${encodeURIComponent(finalLink)}`;
        const r = await fetch(targetUrl, { headers: DEFAULT_HEADERS });
        const data = await r.json();

        // Notif ke Telegram Admin
        try { 
          await sendAdminNotif(`✅ *AM VERIFIED (WILLzzz)*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); 
        } catch (e) {}

        return res.status(200).json(data);
      } catch (e) {
        return res.status(200).json({ status: false, error: "Gagal verifikasi: " + e.message });
      }
    }

    return res.status(200).json({ status: false, error: 'Action nggak dikenal. Pake: stats / send / verify' });
  } catch (e) {
    return res.status(200).json({ status: false, error: e.message });
  }
}
