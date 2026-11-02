// api/viu.js - MVNF PRO FIX 422 ID PERANGKAT TIDAK VALID
import { randomBytes, createHash } from 'node:crypto';

function md5(s) { return createHash('md5').update(String(s)).digest('hex'); }

// Ubah device_id apapun (mvnf-xxx, dll) jadi UUID valid kayak HP asli
// Contoh: mvnf-abc123 -> a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5
function toUUID(seed) {
  const h = md5(seed || randomBytes(16).toString('hex'));
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function toHex32(seed) { return md5(seed || randomBytes(16).toString('hex')); }
function toHex16(seed) { return md5(seed || randomBytes(16).toString('hex')).slice(0,16); }

async function tryFetch(url, options) {
  try {
    const r = await fetch(url, options);
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    return { status: r.status, ok: r.ok, raw, data };
  } catch (e) {
    return { status: 0, ok: false, raw: e.message, data: null };
  }
}

function normalize(data, devId) {
  if (!data) return null;
  const acc = data.account || data.data?.account || data.data || {};
  const email = data.email || acc.email || data.data?.email || null;
  const password = data.password || acc.password || data.data?.password || null;
  if (!email) return null;
  return {
    success: true, status: true,
    message: data.message || "Akun VIU berhasil dibuat",
    is_new: data.is_new ?? true,
    device_id: data.device_id || devId,
    email, password,
    account: { email, password },
    fetched_at: new Date().toISOString(),
    raw: data
  };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const rawId = (typeof body.deviceId === "string" && body.deviceId.trim()) ? body.deviceId.trim() : (typeof body.device_id === "string" ? body.device_id.trim() : "") || `mvnf-${Date.now()}-${randomBytes(4).toString('hex')}`;

  // 3 VARIAN FORMAT - dicoba satu-satu sampai ada yang diterima server
  const uuid = toUUID(rawId);
  const hex32 = toHex32(rawId);
  const hex16 = toHex16(rawId);

  const BASE = 'https://viu.interflazz.my.id';
  const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36';

  const attempts = [
    // 1. GET + UUID (paling sering diterima VIU)
    { dev: uuid, url: `${BASE}/?action=account&device_id=${encodeURIComponent(uuid)}`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 2. GET + hex32
    { dev: hex32, url: `${BASE}/?action=account&device_id=${encodeURIComponent(hex32)}`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 3. GET + hex16 (Android ID asli formatnya 16 hex)
    { dev: hex16, url: `${BASE}/?action=account&device_id=${encodeURIComponent(hex16)}`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 4. GET tanpa device_id - biar server yang bikinin
    { dev: uuid, url: `${BASE}/?action=account`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 5. POST + UUID
    { dev: uuid, url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Origin': BASE, 'Referer': `${BASE}/` }, body: JSON.stringify({ device_id: uuid }) } },
    // 6. POST + UUID + deviceId + device_id semua dikirim
    { dev: uuid, url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Origin': BASE, 'Referer': `${BASE}/` }, body: JSON.stringify({ device_id: uuid, deviceId: uuid, deviceID: uuid, android_id: hex16 }) } },
    // 7. POST form + UUID
    { dev: uuid, url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': BASE, 'Referer': `${BASE}/` }, body: `device_id=${encodeURIComponent(uuid)}` } },
  ];

  let lastErr = "";
  for (const a of attempts) {
    const r = await tryFetch(a.url, a.opts);
    if (r.status === 405 || r.status === 422 || r.status === 404 || r.status === 0) {
      lastErr = `HTTP ${r.status} - ${(r.data?.message || r.data?.error || r.raw || "").slice(0, 120)}`;
      continue; // jangan nyerah, coba format berikutnya
    }
    if (!r.ok) { lastErr = `HTTP ${r.status} - ${(r.data?.message || r.raw || "").slice(0, 120)}`; continue; }
    if (r.data?.success === true || r.data?.status === true || r.data?.account || r.data?.email) {
      const norm = normalize(r.data, a.dev);
      if (norm) return res.status(200).json(norm);
    }
    const norm2 = normalize(r.data, a.dev);
    if (norm2) return res.status(200).json(norm2);
    lastErr = r.data?.message || r.raw?.slice(0, 120) || "Response kosong";
  }

  return res.status(502).json({ success: false, message: `API VIU nolak semua format device_id. Terakhir: ${lastErr}` });
}
