// api/am.js - AM Premium - MVNF (VinzCloud Backend)
import axios from 'axios';
import { sendAdminNotif } from "./_tele.js";

const BASE_URL = 'https://vinzcloud.vercel.app';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'User-Agent': USER_AGENT,
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function translateError(msg) {
  const m = String(msg || '');
  if (m.includes('QUOTA_EXCEEDED') || m.includes('Exceeded daily quota') || m.includes('Batas limit')) {
    return 'Jatah kirim email harian lagi penuh. Coba lagi beberapa saat lagi.';
  }
  if (m.includes('INVALID_EMAIL') || m.includes('invalid-email')) return 'Email-nya nggak valid, cek lagi.';
  if (m.includes('TOO_MANY')) return 'Kebanyakan request, tunggu 5 menit lagi.';
  if (m.includes('timeout') || m.includes('ETIMEDOUT')) return 'Koneksi ke server timeout. Coba klik ulang.';
  return m.slice(0, 300);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, email, magicLink, link } = req.body || req.query || {};
    const act = (action || req.query?.action || '').toLowerCase();

    // ---- stats ----
    if (req.method === 'GET' || act === 'stats' || act === 'status') {
      try {
        const r = await client.get('/api/stats');
        return res.status(200).json({ success: true, ...r.data });
      } catch (e) {
        return res.status(200).json({ success: false, error: translateError(e.response?.data?.message || e.message) });
      }
    }

    // ---- send link (email sendiri) ----
    if (act === 'send' || act === 'send-link' || (req.method === 'POST' && email && !magicLink && !link)) {
      if (!email) return res.status(200).json({ success: false, error: 'Email kosong' });
      try {
        const r = await client.post('/api/send-link', { email: String(email).trim() });
        try { await sendAdminNotif(`✨ *AM BARU (VinzCloud)*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); } catch (e) {}
        return res.status(200).json({ success: true, ...r.data });
      } catch (e) {
        const msg = e.response?.data?.message || e.message;
        return res.status(200).json({ success: false, error: translateError(msg) });
      }
    }

    // ---- verify link ----
    if (act === 'verify' || act === 'verify-link' || (magicLink || link)) {
      const finalLink = magicLink || link;
      if (!email || !finalLink) return res.status(200).json({ success: false, error: 'Email & Link wajib diisi' });
      try {
        const r = await client.post('/api/verify-link', { email: String(email).trim(), magicLink: String(finalLink).trim() });
        try { await sendAdminNotif(`✅ *AM VERIFIED (VinzCloud)*\n\nEmail: \`${email}\`\n\nDari: MVNF Premium`); } catch (e) {}
        return res.status(200).json({ success: true, ...r.data });
      } catch (e) {
        const msg = e.response?.data?.message || e.message;
        return res.status(200).json({ success: false, error: translateError(msg) });
      }
    }

    // ---- auto-bypass (tempmail flow) ----
    if (act === 'auto-bypass') {
      try {
        const domain = 'catchmail.io';
        
        // 1. Generate tempmail
        const mailRes = await client.get(`/api/tempmail/generate?domain=${encodeURIComponent(domain)}`);
        const tempEmail = mailRes.data?.email;
        if (!tempEmail) return res.status(200).json({ success: false, error: 'Gagal membuat temporary email.' });

        // 2. Kirim magic link
        await client.post('/api/send-link', { email: tempEmail });

        // 3. Polling inbox (max 2 menit)
        let foundLink = null;
        for (let i = 1; i <= 20; i++) {
          await sleep(6000);
          const inboxRes = await client.get(`/api/tempmail/inbox?email=${encodeURIComponent(tempEmail)}`);
          const messages = inboxRes.data?.messages || [];
          
          if (messages.length > 0) {
            for (const msg of messages) {
              try {
                const detailRes = await client.get(`/api/tempmail/message?id=${encodeURIComponent(msg.id)}&email=${encodeURIComponent(tempEmail)}`);
                const bodyStr = JSON.stringify(detailRes.data);
                
                // Prioritas link verifikasi Alight Motion
                const preferred = bodyStr.match(/https?:\/\/[^\s"'<>\\]+(?:alight-creative\.firebaseapp\.com|oobCode|__)/i);
                if (preferred) { foundLink = preferred[0]; break; }
                
                // Fallback
                const anyLink = bodyStr.match(/https?:\/\/[^\s"'<>\\]+/g);
                if (anyLink && anyLink.length > 0) { foundLink = anyLink[0]; break; }
              } catch {}
            }
            if (foundLink) break;
          }
        }

        if (!foundLink) return res.status(200).json({ success: false, error: 'Magic link tidak ditemukan di inbox (Timeout).' });

        // 4. Verifikasi
        const verifyRes = await client.post('/api/verify-link', { email: tempEmail, magicLink: foundLink });
        const d = verifyRes.data || {};
        
        try { await sendAdminNotif(`✅ *AM AUTO-BYPASS*\n\nEmail: \`${tempEmail}\`\n\nDari: MVNF Premium`); } catch (e) {}

        return res.status(200).json({
          success: true,
          bypassed: true,
          email: tempEmail,
          magicLink: foundLink,
          ...d
        });
      } catch (err) {
        return res.status(200).json({ success: false, error: 'Auto-bypass gagal: ' + translateError(err.response?.data?.message || err.message) });
      }
    }

    return res.status(200).json({ success: false, error: 'Action nggak dikenal. Pake: stats / send / verify / auto-bypass' });
  } catch (e) {
    return res.status(200).json({ success: false, error: translateError(e.message) });
  }
}
