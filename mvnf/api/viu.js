// api/viu.js - MVNF PRO FIX 405 STABIL
import { randomBytes, createHash } from 'node:crypto';

function makeDeviceId(seed) {
  if (seed) return createHash('md5').update(String(seed)).digest('hex');
  return randomBytes(16).toString('hex');
}

async function tryFetch(url, options) {
  try {
    const r = await fetch(url, options);
    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    return { status: r.status, ok: r.ok, raw, data };
  } catch (e) {
    return { status: 0, ok: false, raw: e.message, data: null, err: e.message };
  }
}

// Normalisasi semua bentuk response VIU
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
  const devId = (typeof body.deviceId === "string" && body.deviceId.trim()) ? body.deviceId.trim() : makeDeviceId();
  const queryDevId = typeof req.query?.deviceId === "string" ? req.query.deviceId : devId;

  const BASE = 'https://viu.interflazz.my.id';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36';

  // URUTAN COBA: GET dulu (yang diizinkan server), baru POST
  const attempts = [
    // 1. GET + device_id di query - ini yang paling sering work
    { url: `${BASE}/?action=account&device_id=${encodeURIComponent(devId)}`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 2. GET tanpa device_id
    { url: `${BASE}/?action=account`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `${BASE}/` } } },
    // 3. GET pakai deviceId camelCase
    { url: `${BASE}/?action=account&deviceId=${encodeURIComponent(devId)}`, opts: { method: "GET", headers: { 'User-Agent': UA, 'Accept': 'application/json' } } },
    // 4. POST JSON device_id
    { url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Origin': BASE, 'Referer': `${BASE}/` }, body: JSON.stringify({ device_id: devId }) } },
    // 5. POST JSON deviceId + device_id
    { url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Origin': BASE, 'Referer': `${BASE}/` }, body: JSON.stringify({ deviceId: devId, device_id: devId }) } },
    // 6. POST form-urlencoded
    { url: `${BASE}/?action=account`, opts: { method: "POST", headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': BASE, 'Referer': `${BASE}/` }, body: `device_id=${encodeURIComponent(devId)}` } },
  ];

  let lastErr = "Unknown";
  for (const a of attempts) {
    const r = await tryFetch(a.url, a.opts);
    // Kalau 405 / 422 / 404, lanjut ke cara berikutnya, jangan langsung nyerah
    if (r.status === 405 || r.status === 422 || r.status === 404 || r.status === 0) {
      lastErr = `HTTP ${r.status} - ${(r.data?.message || r.raw || "").slice(0, 100)}`;
      continue;
    }
    if (!r.ok) {
      lastErr = `HTTP ${r.status} - ${(r.data?.message || r.raw || "").slice(0, 100)}`;
      continue;
    }
    // Cek sukses dalam berbagai bentuk
    if (r.data?.success === true || r.data?.status === true || r.data?.account) {
      const norm = normalize(r.data, devId);
      if (norm) return res.status(200).json(norm);
    }
    // Kalau data ada tapi format beda, tetap coba normalisasi
    const norm2 = normalize(r.data, devId);
    if (norm2) return res.status(200).json(norm2);
    lastErr = r.data?.message || r.raw?.slice(0, 120) || "Response kosong";
  }

  return res.status(502).json({ success: false, message: `API VIU lagi sibuk / semua metode gagal. Terakhir: ${lastErr}. Coba lagi 1 menit.` });
}
