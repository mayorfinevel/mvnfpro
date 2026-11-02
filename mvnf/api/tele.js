// api/_tele.js - Kirim Notif ke Tele Admin MVNF
export async function sendAdminNotif(text) {
  const TOKEN = process.env.TELEGRAM_TOKEN;
  const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
  if (!TOKEN || !ADMIN_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: 'Markdown' })
    });
  } catch (e) { console.log('Tele gagal:', e.message); }
}
