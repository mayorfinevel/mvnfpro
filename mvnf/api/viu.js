// ---------------------------------------------------------
// 🔥 Author   : Dhanz (https://t.me/ktzckmy)
// 🌸 Date     : 23 Oktober 2026
// 🍂 Function : VIU Premium Account Base Module (ESM) - Adapted for MVNF PRO
// 🌟 Channels : 
//  - https://whatsapp.com/channel/0029VbE3FdeGZNCjob8ShJ3l
// 
// 🍁 Notes :
// Mohon untuk tidak menghapus watermark ini. 
// Error fix sendiri.
// ---------------------------------------------------------

import { randomBytes, createHash } from 'node:crypto'

const BASE_URL = 'https://viu.interflazz.my.id/?action=account'
const TIMEOUT = 30_000

/**
 * Membuat Device ID acak atau berbasis seed
 * @param {string|null} seed
 */
export function generateDeviceId(seed = null) {
  if (seed) return createHash('md5').update(String(seed)).digest('hex')
  return randomBytes(16).toString('hex')
}

/**
 * Mengambil credential akun VIU Premium dari endpoint
 * @param {string} [deviceId] - Device ID kustom (Opsional)
 */
export async function requestApi(deviceId = null) {
  // FIX PENTING: kalau deviceId dari frontend bukan hex32 murni (misal "mvnf-xxx"), ANGGAP TIDAK ADA
  // Biar generateDeviceId() yang bikin yang valid
  const isValidHex32 = typeof deviceId === 'string' && /^[a-f0-9]{32}$/i.test(deviceId.trim());
  const devId = isValidHex32 ? deviceId.trim() : generateDeviceId()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://viu.interflazz.my.id',
        'Referer': 'https://viu.interflazz.my.id/'
      },
      body: JSON.stringify({ device_id: devId }),
      signal: controller.signal
    })

    const rawText = await res.text()
    let data = null; try { data = JSON.parse(rawText) } catch (_) {}

    if (!res.ok) throw new Error(`API Error: HTTP ${res.status} - ${(data?.message || rawText || "").slice(0, 100)}`)
    if (!data?.success) throw new Error(data?.message || 'Gagal mengambil akun VIU')

    return {
      status: true,
      message: data.message,
      is_new: data.is_new,
      device_id: data.device_id || devId,
      account: {
        email: data.account?.email ?? null,
        password: data.account?.password ?? null
      },
      fetched_at: new Date().toISOString(),
      raw_data: data
    }
  } finally {
    clearTimeout(timer)
  }
}

// --- Vercel Handler MVNF PRO ---
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // JANGAN PAKAI deviceId dari frontend! Selalu generate fresh hex32 di server
  // Ini yang bikin 422 kemarin ilang
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await requestApi(null); // <-- null = generate fresh hex32
      return res.status(200).json({
        success: true, status: true,
        message: result.message,
        is_new: result.is_new,
        device_id: result.device_id,
        email: result.account.email,
        password: result.account.password,
        account: result.account,
        fetched_at: result.fetched_at,
        raw: result.raw_data
      });
    } catch (e) {
      lastErr = e.message;
      // Kalau 422, berarti device_id itu udah kepake / diblokir, coba lagi dengan id baru
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return res.status(502).json({ success: false, message: `API VIU gagal 3x: ${lastErr}` });
}

export default {
  generateDeviceId,
  requestApi
}
