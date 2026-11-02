// ---------------------------------------------------------
// 🔥 Author   : Dhanz
// 🌸 Date     : 1 November 2026
// 🍂 Function : Netflix Token Generator Base Module (ESM) - Adapted for MVNF PRO
// 🌟 Channels : 
//  - https://whatsapp.com/channel/0029VbE3FdeGZNCjob8ShJ3l
// 
// 🍁 Notes :
// Mohon untuk tidak menghapus watermark ini.
// Error fix sendiri.
// ---------------------------------------------------------
const BASE_URL = 'https://token-netflix.vercel.app'
const API_URL = `${BASE_URL}/api/generate`
const TIMEOUT = 30_000
const DEFAULT_HEADERS = {
  'Accept': 'application/json, text/event-stream, text/plain, */*',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
}
export function parseSseResponse(rawText) {
  const events = []
  const tokens = []
  let summaryData = null
  const lines = String(rawText || '').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const jsonStr = trimmed.slice(5).trim()
    try {
      const parsed = JSON.parse(jsonStr)
      events.push(parsed)
      if (parsed.type === 'token' && parsed.token) tokens.push(parsed.token)
      else if (parsed.type === 'done' && parsed.summary) summaryData = parsed.summary
    } catch (_) {}
  }
  const finalTokens = summaryData?.data?.length ? summaryData.data : tokens
  const formattedItems = finalTokens.map((item, idx) => ({
    index: item.index ?? idx + 1,
    id: item.id || '-',
    success: Boolean(item.success),
    token: item.token || '-',
    expiry: item.expiry || '-',
    country: item.profile?.country || 'Tidak diketahui',
    plan: item.profile?.plan || 'Tidak diketahui',
    pc: item.links?.pc || '-',
    android: item.links?.android || '-',
    tv: item.links?.tv || '-',
    generatedAt: item.generatedAt || '-'
  }))
  return { status: formattedItems.length > 0, total: summaryData?.totalRequested ?? formattedItems.length, success_count: summaryData?.successCount ?? formattedItems.length, error_count: summaryData?.errorCount ?? 0, results: formattedItems }
}
export async function generateNetflixToken(cookieInput = '') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const cleanInput = String(cookieInput || '').trim()
    let res
    if (cleanInput) {
      res = await fetch(API_URL, { method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ cookie: cleanInput, netflixId: cleanInput, NetflixId: cleanInput }), signal: controller.signal })
      if (res.status === 405) {
        const endpoint = new URL(API_URL)
        endpoint.searchParams.set('cookie', cleanInput)
        endpoint.searchParams.set('netflixId', cleanInput)
        res = await fetch(endpoint.toString(), { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal })
      }
    } else {
      res = await fetch(API_URL, { method: 'GET', headers: DEFAULT_HEADERS, signal: controller.signal })
      if (res.status === 405) {
        res = await fetch(API_URL, { method: 'POST', headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({}), signal: controller.signal })
      }
    }
    const rawText = await res.text()
    if (!res.ok) throw new Error(`API Error HTTP ${res.status}: ${rawText.slice(0, 300)}`)
    if (rawText.includes('data:')) return parseSseResponse(rawText)
    let data = null; try { data = JSON.parse(rawText) } catch (_) {}
    return data || { result: rawText }
  } finally { clearTimeout(timer) }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ status: false, message: "Method not allowed" });
  try {
    let cookie = "";
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })() : (req.body || {});
      cookie = b.cookie || b.netflixId || "";
    } else cookie = req.query.cookie || req.query.netflixId || "";
    const result = await generateNetflixToken(cookie);
    if (result?.results?.length) {
      const item = result.results[0];
      if (!item.token || item.token === "-") return res.status(502).json({ status: false, message: "Token gagal dibuat. Stok habis / coba lagi." });
      return res.status(200).json({ status: true, token: item.token, expiry: item.expiry, expired: item.expiry, pcLink: item.pc, androidLink: item.android, tvLink: item.tv, type: "cookie", profile: { country: item.country, plan: item.plan }, raw: result });
    }
    if (result?.data && Array.isArray(result.data) && result.data[0]?.token) {
      const item = result.data[0];
      return res.status(200).json({ status: true, token: item.token, expiry: item.expiry, expired: item.expiry, pcLink: item.links?.pc || null, androidLink: item.links?.android || null, tvLink: item.links?.tv || null, type: item.type || "cookie", profile: item.profile || null, raw: result });
    }
    return res.status(502).json({ status: false, message: "API Netflix tidak mengembalikan token. Coba lagi." });
  } catch (e) {
    return res.status(502).json({ status: false, message: e.message?.slice(0, 200) || "Gagal terhubung ke API Netflix." });
  }
}