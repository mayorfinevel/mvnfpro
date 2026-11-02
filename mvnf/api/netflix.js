// ---------------------------------------------------------
// 🔥 Author   : Dhanz - DIOPREK BUAT MVNF PRO
// 🍂 Function : Netflix Token Generator - STABIL RETRY + TELE
// ---------------------------------------------------------
import { sendAdminNotif } from "./_tele.js";

export const config = { maxDuration: 60 };

const BASE_URL = 'https://token-netflix.vercel.app'
const API_URL = `${BASE_URL}/api/generate`
const TIMEOUT = 25000

const DEFAULT_HEADERS = {
  'Accept': 'application/json, text/event-stream, text/plain, */*',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseSseResponse(rawText) {
  const items = [];
  const seen = new Set();
  const pushItem = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const candidates = [];
    if (obj.token) candidates.push(obj);
    if (Array.isArray(obj.data)) candidates.push(...obj.data);
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) && obj.data.token) candidates.push(obj.data);
    if (obj.summary?.data && Array.isArray(obj.summary.data)) candidates.push(...obj.summary.data);
    if (obj.result && typeof obj.result === 'object' && obj.result.token) candidates.push(obj.result);
    for (const c of candidates) {
      const token = c.token || c.accessToken || c.cookie || null;
      if (!token || token === '-' || seen.has(token)) continue;
      seen.add(token);
      items.push({
        token,
        expiry: c.expiry || c.expired || c.expiresAt || c.expire || '-',
        country: c.profile?.country || c.country || 'Tidak diketahui',
        plan: c.profile?.plan || c.plan || 'Tidak diketahui',
        pc: c.links?.pc || c.pc || c.pcLink || '-',
        android: c.links?.android || c.android || c.androidLink || '-',
        tv: c.links?.tv || c.tv || c.tvLink || '-',
      });
    }
  };

  const text = String(rawText || '');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('data:')) {
      const jsonStr = t.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try { pushItem(JSON.parse(jsonStr)); } catch {
        if (jsonStr.length > 50 && !jsonStr.includes(' ')) pushItem({ token: jsonStr });
      }
    }
  }
  if (items.length === 0) {
    try { pushItem(JSON.parse(text)); } catch {}
  }
  if (items.length === 0) {
    const m = text.match(/"token"\s*:\s*"([^"]{20,})"/);
    if (m) pushItem({ token: m[1] });
  }
  return items;
}

async function fetchOnce(cookieInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const clean = String(cookieInput || '').trim();
    let res;
    if (clean) {
      res = await fetch(API_URL, { method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: clean, netflixId: clean, NetflixId: clean }), signal: controller.signal });
      if (res.status === 405) {
        const u = new URL(API_URL); u.searchParams.set('cookie', clean); u.searchParams.set('netflixId', clean);
        res = await fetch(u.toString(), { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal });
      }
    } else {
      res = await fetch(API_URL, { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal });
      if (res.status === 405) {
        res = await fetch(API_URL, { method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({}), signal: controller.signal });
      }
    }
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSseResponse(raw);
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(200).json({ status: false, success: false, message: "Method not allowed" });

  let cookie = "";
  if (req.method === "POST") {
    const b = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })() : (req.body || {});
    cookie = b.cookie || b.netflixId || "";
  } else cookie = req.query.cookie || req.query.netflixId || "";

  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const items = await fetchOnce(cookie);
      if (items.length > 0 && items[0].token && items[0].token !== '-') {
        const item = items[0];
        const token = String(item.token);

        // KIRIM TELE - nggak bikin gagal kalo error
        try {
          await sendAdminNotif(`🎬 *NETFLIX BARU*\n\nToken: \`${token.slice(0, 500)}\`\n\nNegara: ${item.country}\nPlan: ${item.plan}\nExpiry: ${item.expiry}\n\nDari: MVNF Premium`);
        } catch(e){}

        // INI FIX-nya: kasih 2 format biar frontend apapun kebaca
        return res.status(200).json({
          status: true,
          success: true,
          token: token,
          expiry: item.expiry,
          expired: item.expiry,
          pcLink: item.pc !== '-' ? item.pc : null,
          androidLink: item.android !== '-' ? item.android : null,
          tvLink: item.tv !== '-' ? item.tv : null,
          type: "cookie",
          profile: { country: item.country, plan: item.plan },
          attempt,
          raw: { results: items }
        });
      }
      lastErr = "Token kosong";
    } catch (e) {
      lastErr = e.message || "Fetch gagal";
    }
    if (attempt < 3) await sleep(1200 * attempt);
  }

  return res.status(200).json({ status: false, success: false, message: `Server Netflix lagi padat, coba lagi 30 detik. (${lastErr})`, error: lastErr });
}
