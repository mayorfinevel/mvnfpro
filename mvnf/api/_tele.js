// api/_tele.js - VERSI TANCAP, TANPA ENV, ANTI-CRASH
const TOKEN = '9298868997:AAGvSkLW6I6R-RkzpK8PGyixrqK5LWGuYVo';
const ADMIN_ID = '1846169771';

export async function sendAdminNotif(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_ID, text: String(text).slice(0, 4000) })
    });
  } catch (e) {
    console.log('Tele skip:', e.message);
  }
}
