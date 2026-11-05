// MVNF PRO - app.js FINAL (NO LIMIT + COPY LINK)
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// 🔥 FUNGSI UNTUK COPY LINK (Dipanggil dari HTML)
window.copyLinkText = function(inputId, btnElement) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl || !inputEl.value || !inputEl.value.includes('netflix.com')) {
    alert('❌ Link belum tersedia atau tidak valid.');
    return;
  }

  navigator.clipboard.writeText(inputEl.value).then(() => {
    const oldText = btnElement.innerText;
    btnElement.innerText = 'Tersalin ✓';
    btnElement.classList.add('success');
    
    setTimeout(() => {
      btnElement.innerText = oldText;
      btnElement.classList.remove('success');
    }, 2000);
  }).catch(err => {
    alert('Gagal menyalin link: ' + err);
  });
};

function getDeviceId() {
  let id = localStorage.getItem("mvnf_device_id");
  if (!id) { id = "mvnf-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("mvnf_device_id", id); }
  return id;
}

function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  let device = "Desktop";
  if (/Android/i.test(ua)) device = "Android";
  else if (/iPhone|iPad/i.test(ua)) device = "iOS";
  else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Mac/i.test(ua)) device = "Mac";
  let browser = "Unknown";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  return { device_id: getDeviceId(), device, browser, platform: navigator.platform || "-", screen: `${screen.width}x${screen.height}`, language: navigator.language || "id-ID", userAgent: ua };
}

async function sendLog(service, result, extra = "") {
  try { await fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service, result, extra, ...getDeviceInfo() }) }); } catch {}
}

async function safeJson(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { throw new Error("Server lagi error, coba lagi 1 menit."); }
}

// 🔥 FUNGSI VALIDASI LINK NETFLIX
function openNetflixLink(url) {
  if (!url || typeof url !== 'string' || !url.includes('netflix.com')) {
    alert('❌ Link Netflix tidak valid. Silakan generate ulang.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

document.addEventListener("DOMContentLoaded", () => {
  // Splash Screen
  setTimeout(() => { const s = $("splash"); if (s) s.classList.add("hide"); }, 1200);
  
  // Theme Toggle
  const themeBtn = $("themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const html = document.documentElement;
    const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    themeBtn.textContent = next === "dark" ? "🌙" : "☀️";
    localStorage.setItem("mvnf_theme", next);
  });
  const savedTheme = localStorage.getItem("mvnf_theme");
  if (savedTheme) { document.documentElement.setAttribute("data-theme", savedTheme); if (themeBtn) themeBtn.textContent = savedTheme === "dark" ? "🌙" : "☀️"; }

  // Tab Navigation
  const tabs = $$(".tab");
  const panels = { netflix: $("panel-netflix"), am: $("panel-am"), viu: $("panel-viu") };
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.tab;
      Object.keys(panels).forEach(k => { if (panels[k]) panels[k].classList.toggle("hidden", k !== t); });
    });
  });

  // Copy Button (Token & VIU)
  $$("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      const el = $(btn.dataset.copy);
      const text = el ? el.textContent.trim() : "";
      if (!text || text === "—") return alert("Belum ada data!");
      navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent; btn.textContent = "Tersalin ✓";
        setTimeout(() => btn.textContent = old, 1500);
      });
    });
  });

  // Reset Buttons
  if ($("resetBtn")) $("resetBtn").addEventListener("click", () => { if ($("result")) $("result").classList.add("hidden"); if ($("message")) $("message").textContent = ""; });
  if ($("viuResetBtn")) $("viuResetBtn").addEventListener("click", () => { if ($("viuResult")) $("viuResult").classList.add("hidden"); if ($("viuMessage")) $("viuMessage").textContent = ""; });

  // ==========================================
  // 🔥 LOGIKA NETFLIX (TANPA COOLDOWN)
  // ==========================================
  if ($("generateBtn")) $("generateBtn").addEventListener("click", async () => {
    const btn = $("generateBtn"), msg = $("message");
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = "GENERATING... ⏳";
    if (msg) msg.textContent = "";
    
    try {
      const res = await fetch("/api/netflix?count=1", { method: "GET" });
      const data = await safeJson(res);
      if (!res.ok || !data.token) throw new Error(data.message || "Gagal generate, coba lagi.");
      
      // Tampilkan Token
      if ($("tokenText")) $("tokenText").textContent = data.token;
      if ($("expiry")) $("expiry").textContent = data.expiry || data.expired || data.raw?.data?.[0]?.expiry || "—";
      
      // Setup Link (Hanya pasang jika valid netflix.com)
      const pc = data.pcLink;
      const android = data.androidLink;
      const tv = data.tvLink;
      
      if ($("pcLink")) $("pcLink").value = pc || "";
      if ($("androidLink")) $("androidLink").value = android || "";
      if ($("tvLink")) $("tvLink").value = tv || "";

      // Pasang event onclick ke tombol <a>
      if ($("pcOpen")) {
        $("pcOpen").onclick = (e) => { e.preventDefault(); openNetflixLink(pc); };
        $("pcOpen").style.opacity = pc ? "1" : "0.5";
      }
      if ($("androidOpen")) {
        $("androidOpen").onclick = (e) => { e.preventDefault(); openNetflixLink(android); };
        $("androidOpen").style.opacity = android ? "1" : "0.5";
      }
      if ($("tvOpen")) {
        $("tvOpen").onclick = (e) => { e.preventDefault(); openNetflixLink(tv); };
        $("tvOpen").style.opacity = tv ? "1" : "0.5";
      }

      if ($("result")) { $("result").classList.remove("hidden"); $("result").scrollIntoView({ behavior: "smooth", block: "center" }); }
      sendLog("netflix", "success", data.token);
    } catch (e) { 
      if (msg) msg.textContent = e.message; 
      sendLog("netflix", "fail", e.message); 
    }
    
    // 🔥 TOMBOL LANGSUNG AKTIF LAGI
    btn.disabled = false; btn.innerHTML = old;
  });

  // ==========================================
  // 🔥 LOGIKA VIU (TANPA COOLDOWN)
  // ==========================================
  if ($("viuGenerateBtn")) $("viuGenerateBtn").addEventListener("click", async () => {
    const btn = $("viuGenerateBtn"), msg = $("viuMessage");
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = "GENERATING... ⏳";
    if (msg) msg.textContent = "";
    
    try {
      const res = await fetch("/api/viu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId() }) });
      const data = await safeJson(res);
      if (!res.ok || !data.success) throw new Error(data.message || "Gagal generate VIU.");
      
      if ($("viuEmailText")) $("viuEmailText").textContent = data.email || data.account?.email || "—";
      if ($("viuPasswordText")) $("viuPasswordText").textContent = data.password || data.account?.password || "—";
      if ($("viuDeviceId")) $("viuDeviceId").textContent = data.device_id || getDeviceId();
      if ($("viuInfo")) $("viuInfo").textContent = data.message || "Login di app VIU pake email & password di atas.";
      if ($("viuResult")) { $("viuResult").classList.remove("hidden"); $("viuResult").scrollIntoView({ behavior: "smooth" }); }
      sendLog("viu", "success", data.email || "");
    } catch (e) { 
      if (msg) msg.textContent = e.message; 
      sendLog("viu", "fail", e.message); 
    }
    
    // 🔥 TOMBOL LANGSUNG AKTIF LAGI
    btn.disabled = false; btn.innerHTML = old;
  });

  // ==========================================
  // 🔥 LOGIKA AM (TANPA COOLDOWN)
  // ==========================================
  if ($("amCheckStats")) $("amCheckStats").addEventListener("click", async () => {
    try {
      const res = await fetch("/api/am", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stats" }) });
      const data = await safeJson(res);
      if ($("amApiStatus")) $("amApiStatus").textContent = data.success ? "ONLINE" : "OFFLINE";
      if ($("amStatsRaw")) $("amStatsRaw").textContent = JSON.stringify(data.data || data).slice(0, 80);
    } catch { if ($("amApiStatus")) $("amApiStatus").textContent = "ERROR"; }
  });

  if ($("amSendBtn")) $("amSendBtn").addEventListener("click", async () => {
    const email = $("amEmailInput")?.value.trim();
    const msg = $("amMessage");
    if (!email || !email.includes("@")) { if (msg) msg.textContent = "Masukin email yang valid dulu!"; return; }
    
    const btn = $("amSendBtn"), old = btn.innerHTML; btn.disabled = true; btn.innerHTML = "Mengirim... ⏳";
    if (msg) msg.textContent = "";
    
    try {
      const res = await fetch("/api/am", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", email }) });
      const data = await safeJson(res);
      if (!data.success) throw new Error(data.message || data.data?.message || "Gagal kirim magic link.");
      
      if (msg) { msg.style.color = "#67d89a"; msg.textContent = "✅ Magic link dikirim! Cek email / spam 1-2 menit."; }
      sendLog("am", "success", email);
    } catch (e) { 
      if (msg) { msg.style.color = "#ff8080"; msg.textContent = e.message; } 
      sendLog("am", "fail", e.message); 
    }
    
    btn.disabled = false; btn.innerHTML = old;
  });

  if ($("amVerifyBtn")) $("amVerifyBtn").addEventListener("click", async () => {
    const email = $("amEmailInput")?.value.trim();
    const magicLink = $("amLinkInput")?.value.trim();
    const msg = $("amVerifyMsg");
    if (!email || !magicLink) { if (msg) msg.textContent = "Isi email + paste magic link dulu!"; return; }
    
    const btn = $("amVerifyBtn"), old = btn.innerHTML; btn.disabled = true; btn.innerHTML = "Verifikasi... ⏳";
    if (msg) msg.textContent = "";
    
    try {
      const res = await fetch("/api/am", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", email, magicLink }) });
      const data = await safeJson(res);
      if (!data.success) throw new Error(data.message || data.data?.message || "Verifikasi gagal.");
      
      if (msg) { msg.style.color = "#67d89a"; msg.textContent = "✅ AM Premium Aktif! Login di Alight Motion pake email yang sama."; }
      if ($("amResult")) $("amResult").classList.remove("hidden");
      sendLog("am", "success", email);
    } catch (e) { 
      if (msg) { msg.style.color = "#ff8080"; msg.textContent = e.message; } 
    }
    
    btn.disabled = false; btn.innerHTML = old;
  });

  console.log("MVNF PRO - NO LIMIT + COPY LINK READY 🔥");
});
