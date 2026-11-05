// ---------------------------------------------------------
// 🔥 Author   : Dhanz - DIOPREK BUAT MVNF PRO
// 🌸 Date     : 1 November 2026
// 🍂 Function : Netflix Token Generator - STABIL RETRY + TELE
// 🍁 Notes : Mohon untuk tidak menghapus watermark ini.
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

function getStringToken(input) {
  if (!input) return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const cand = input.token || input.value || input.accessToken || input.cookie || input.access_token || input.data;
    if (typeof cand === 'string') return cand;
    if (typeof cand === 'object') return getStringToken(cand);
    if (input.token && typeof input.token === 'object') return getStringToken(input.token);
  }
  return null;
}

/* ============================================================
 * 🔧 FIX: Validasi link — HANYA terima kalau domain netflix.com
 * Kalau link balik ke domain sendiri / kosong / '-', paksa null
 * ============================================================ */
function safeNetflixLink(url) {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  if (!s || s === '-' || s.length < 10) return null;

  // Buang kalau link internal (balik ke web sendiri)
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    // tolak domain generator / web sendiri
    if (host.includes('mvnfpro') || host.includes('vercel.app') || host.includes('token-netflix')) {
      return null;
    }
    // wajib netflix.com (atau subdomain)
    if (host === 'netflix.com' || host.endsWith('.netflix.com')) return s;
  } catch {
    // bukan URL valid, coba cek string mengandung netflix.com
    if (s.includes('netflix.com') && !s.includes('mvnfpro')) return s;
    return null;
  }
  return null;
}

// Ambil link dari banyak kemungkinan nama field
function pickLink(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const sources = [
    obj.links, obj.link, obj.profile?.links,
    obj, obj.profile
  ];
  const keys = [
    'pc', 'PC', 'pcLink', 'pc_link', 'pcUrl', 'pc_url', 'desktop', 'web',
    'android', 'Android', 'androidLink', 'android_link', 'androidUrl', 'android_url', 'mobile',
    'tv', 'TV', 'tvLink', 'tv_link', 'tvUrl', 'tv_url', 'television'
  ];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of keys) {
      const v = src[k];
      const valid = safeNetflixLink(v);
      if (valid) return valid;
    }
  }
  return null;
}

function pickLinkByPlatform(obj, platform) {
  if (!obj || typeof obj !== 'object') return null;
  const map = {
    pc: ['pc', 'PC', 'pcLink', 'pc_link', 'pcUrl', 'pc_url', 'desktop', 'web'],
    android: ['android', 'Android', 'androidLink', 'android_link', 'androidUrl', 'android_url', 'mobile'],
    tv: ['tv', 'TV', 'tvLink', 'tv_link', 'tvUrl', 'tv_url', 'television']
  };
  const sources = [obj.links, obj.link, obj.profile?.links, obj, obj.profile];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of map[platform] || []) {
      const valid = safeNetflixLink(src[k]);
      if (valid) return valid;
    }
  }
  return null;
}

function parseSseResponse(rawText) {
  const items = [];
  const seen = new Set();

  const pushItem = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const candidates = [];
    if (obj.token) candidates.push(obj);
    if (Array.isArray(obj.data)) candidates.push(...obj.data);
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) candidates.push(obj.data);
    if (obj.summary?.data && Array.isArray(obj.summary.data)) candidates.push(...obj.summary.data);
    if (obj.result && typeof obj.result === 'object') candidates.push(obj.result);

    for (const c of candidates) {
      const rawToken = c.token || c.accessToken || c.cookie || c.access_token || c;
      const token = getStringToken(rawToken);
      if (!token || token === '-' || token.length < 20 || seen.has(token)) continue;
      seen.add(token);

      // 🔧 FIX: ambil link per platform dan validasi
      const pc = pickLinkByPlatform(c, 'pc');
      const android = pickLinkByPlatform(c, 'android');
      const tv = pickLinkByPlatform(c, 'tv');

      items.push({
        token,
        expiry: c.expiry || c.expired || c.expiresAt || c.expire || c.profile?.expiry || '-',
        country: c.profile?.country || c.country || c.profile?.Country || 'Tidak diketahui',
        plan: c.profile?.plan || c.plan || c.profile?.Plan || 'Tidak diketahui',
        pc,
        android,
        tv,
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
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: clean, netflixId: clean, NetflixId: clean }),
        signal: controller.signal
      });
      if (res.status === 405) {
        const u = new URL(API_URL);
        u.searchParams.set('cookie', clean);
        u.searchParams.set('netflixId', clean);
        res = await fetch(u.toString(), { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal });
      }
    } else {
      res = await fetch(API_URL, { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal });
      if (res.status === 405) {
        res = await fetch(API_URL, {
          method: 'POST',
          headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal
        });
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

  let cookie = "";
  if (req.method === "POST") {
    const b = typeof req.body === "string"
      ? (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })()
      : (req.body || {});
    cookie = b.cookie || b.netflixId || "";
  } else cookie = req.query.cookie || req.query.netflixId || "";

  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const items = await fetchOnce(cookie);
      if (items.length > 0 && items[0].token) {
        const item = items[0];
        const tokenStr = String(item.token);

        try {
          await sendAdminNotif(
            `🎬 *NETFLIX BARU*\n\nToken: \`${tokenStr.slice(0, 1000)}\`\n\n` +
            `Negara: ${item.country}\nPlan: ${item.plan}\nExpiry: ${item.expiry}\n\nDari: MVNF Premium`
          );
        } catch (e) { console.log("Tele error:", e.message) }

        // 🔧 FIX: cuma kirim link kalau valid netflix.com
        return res.status(200).json({
          status: true,
          success: true,
          token: tokenStr,
          expiry: item.expiry,
          expired: item.expiry,
          pcLink: item.pc || null,
          androidLink: item.android || null,
          tvLink: item.tv || null,
          hasLinks: Boolean(item.pc || item.android || item.tv),
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

  return res.status(200).json({
    status: false,
    success: false,
    message: `Server Netflix lagi padat, coba lagi 30 detik. (${lastErr})`,
    error: lastErr
  });
}
