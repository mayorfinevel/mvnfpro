// ---------------------------------------------------------
// 🔥 Author   : Dhanz - DIOPREK BUAT MVNF PRO
// 🌸 Date     : 5 November 2026
// 🍂 Function : Netflix Token Generator (WILLzzz API) - NO LIMIT
// 🍁 Notes : Mohon untuk tidak menghapus watermark ini.
// ---------------------------------------------------------
import { sendAdminNotif } from "./_tele.js";

export const config = { maxDuration: 60 };

const API_URL = 'https://api.wilz.web.id/premium/netflix?count=1';
const TIMEOUT = 25000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Sistem retry kalau API error (500 / timeout)
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const fetchRes = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });

      clearTimeout(timer);
      const data = await fetchRes.json();

      // Cek apakah data dari API valid dan sukses
      if (data.status && data.successCount > 0 && data.data?.[0]?.success) {
        const item = data.data[0];
        const tokenStr = String(item.token);

        // Kirim Notif Telegram
        try {
          await sendAdminNotif(
            `🎬 *NETFLIX BARU (WILLzzz)*\n\nToken: \`${tokenStr.slice(0, 1000)}\`\n\n` +
            `Negara: ${item.profile?.country || '-'}\nPlan: ${item.profile?.plan || '-'}\nExpiry: ${item.expiry || '-'}\n\nDari: MVNF Premium`
          );
        } catch (e) { console.log("Tele error:", e.message); }

        // 🔥 Kembalikan response ke frontend (app.js)
        return res.status(200).json({
          status: true,
          success: true,
          token: tokenStr,
          expiry: item.expiry || '-',
          expired: item.expiry || '-',
          pcLink: item.links?.pc || null,
          androidLink: item.links?.android || null,
          tvLink: item.links?.tv || null,
          hasLinks: true,
          type: "cookie",
          profile: { 
            country: item.profile?.country || 'Tidak diketahui', 
            plan: item.profile?.plan || 'Tidak diketahui' 
          },
          attempt,
          raw: data
        });
      }

      // Kalau API balikin status success: false atau error 500
      lastErr = data.data?.[0]?.error || "API mengembalikan data kosong/gagal";

    } catch (e) {
      clearTimeout(timer);
      lastErr = e.message || "Gagal menghubungi server API";
    }

    // Jeda sebelum retry
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }

  // Kalau sampai 3x gagal
  return res.status(200).json({
    status: false,
    success: false,
    message: `Server Netflix sedang sibuk, coba lagi 30 detik. (${lastErr})`,
    error: lastErr
  });
}
