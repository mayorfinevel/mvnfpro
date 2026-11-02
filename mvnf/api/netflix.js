// api/netflix.js - V2 PEMBURU TOKEN, ANTI GAGAL
import { sendAdminNotif } from "./_tele.js";

function cariToken(obj, depth = 0) {
  if (!obj || depth > 5) return null;
  if (typeof obj === 'string') {
    // Kalo string panjang & kayak token, ambil
    const s = obj.trim();
    if (s.length > 15 && (s.includes('eyJ') || s.includes('-') || s.includes('_') || s.includes('.'))) return s;
    return null;
  }
  if (typeof obj === 'number') return String(obj).length > 10 ? String(obj) : null;
  if (Array.isArray(obj)) {
    for (const v of obj) { const r = cariToken(v, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof obj === 'object') {
    // 1. Cari key yang namanya token dulu (prioritas)
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();
      if (lk.includes('token') || lk === 'code' || lk === 'key') {
        const v = obj[k];
        if (typeof v === 'string' && v.length > 10) return v;
        if (typeof v === 'object' && v) {
          const r = cariToken(v, depth + 1);
          if (r) return r;
        }
        if (typeof v === 'number') return String(v);
      }
    }
    // 2. Kalo nggak ketemu, ubek semua key lain
    for (const v of Object.values(obj)) {
      const r = cariToken(v, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://apiv3.sinaf.my.id/api/neflik', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch(_) {}

    if (!j) throw new Error('API ngirim bukan JSON: ' + text.slice(0, 200));

    const token = cariToken(j);

    // DEBUG: biar lu bisa SS kalo masih gagal
    if (!token) {
      console.log('NETFLIX RAW:', text.slice(0, 1000));
      return res.status(200).json({ success: false, error: 'Token nggak ketemu di API', debug_raw: text.slice(0, 800) });
    }

    try { await sendAdminNotif(`🎬 *NETFLIX BARU*\n\nToken: \`${token}\`\n\nDari: MVNF Premium`); } catch(e){}

    return res.status(200).json({ success: true, token, data: j });

  } catch (e) {
    console.log('Netflix error:', e.message);
    return res.status(200).json({ success: false, error: e.message });
  }
}
