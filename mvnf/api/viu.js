// api/viu.js - MVNF PRO FINAL
import { randomBytes, createHash } from 'node:crypto';
const BASE_URL = 'https://viu.interflazz.my.id/?action=account';
function makeDeviceId(seed) {
  if (seed) return createHash('md5').update(String(seed)).digest('hex');
  return randomBytes(16).toString('hex');
}
async function tryFetch(url, options) {
  const r = await fetch(url, options);
  const raw = await r.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}
  return { status: r.status, ok: r.ok, raw, data };
}
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const devId = (typeof body.deviceId === "string" && body.deviceId.trim()) ? body.deviceId.trim() : makeDeviceId();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Origin': 'https://viu.interflazz.my.id',
    'Referer': 'https://viu.interflazz.my.id/'
  };
  try {
    let attempt = await tryFetch(BASE_URL, { method: "POST", headers, body: JSON.stringify({ device_id: devId }) });
    if (attempt.status === 422) attempt = await tryFetch(BASE_URL, { method: "POST", headers, body: JSON.stringify({ deviceId: devId, device_id: devId }) });
    if (attempt.status === 422) attempt = await tryFetch(`${BASE_URL}&device_id=${devId}`, { method: "GET", headers });
    if (!attempt.ok) return res.status(502).json({ success: false, message: `API VIU Error: HTTP ${attempt.status} - ${(attempt.data?.message || attempt.raw || "").slice(0, 120)}` });
    if (!attempt.data?.success) return res.status(502).json({ success: false, message: attempt.data?.message || "Gagal mengambil akun VIU" });
    return res.status(200).json({
      success: true, status: true,
      message: attempt.data.message,
      is_new: attempt.data.is_new,
      device_id: attempt.data.device_id || devId,
      email: attempt.data.account?.email ?? null,
      password: attempt.data.account?.password ?? null,
      account: { email: attempt.data.account?.email ?? null, password: attempt.data.account?.password ?? null },
      fetched_at: new Date().toISOString(),
      raw: attempt.data
    });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
}