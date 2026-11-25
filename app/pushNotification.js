import { auth, db } from "./firebase.js";
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, getToken, deleteToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import {
  collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "./ui.js";

// Public VAPID key only. Replace this placeholder with the Firebase Web Push
// certificate's public key; never put the private key or service-account JSON here.
const VAPID_PUBLIC_KEY = "PASTE_VAPID_PUBLIC_KEY_HERE";

function deviceId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

export async function renderPushSettings() {
  const content = document.getElementById("content");
  if (!content) return;
  const user = auth.currentUser;
  if (!user) {
    content.innerHTML = '<div class="account-container"><h2>Notifikasi GMTC</h2><p>Silakan login terlebih dahulu.</p></div>';
    return;
  }

  content.innerHTML = `
    <div class="account-container page-fade">
      <div class="account-card">
        <h2>🔔 Notifikasi Play Session</h2>
        <p style="line-height:1.6;opacity:.8;">Aktifkan notifikasi agar GMTC dapat mengingatkan kamu saat sesi yang sudah kamu booking akan dimulai.</p>
        <p id="pushPermissionStatus" style="font-size:13px;opacity:.75;">Memeriksa status notifikasi...</p>
        <button id="enablePushBtn" class="btn-primary" style="width:100%;margin-top:12px;">Aktifkan Notifikasi</button>
        <button id="disablePushBtn" class="btn-secondary" style="width:100%;margin-top:8px;">Nonaktifkan di Perangkat Ini</button>
        <p style="font-size:12px;line-height:1.5;opacity:.65;margin-top:14px;">Notifikasi hanya dikirim untuk booking main slot yang aktif. Waitlist dan sesi yang dibatalkan tidak menerima reminder.</p>
      </div>
    </div>
  `;

  const status = document.getElementById("pushPermissionStatus");
  const enableBtn = document.getElementById("enablePushBtn");
  const disableBtn = document.getElementById("disablePushBtn");

  const supported = "Notification" in window && "serviceWorker" in navigator &&
    await isSupported().catch(() => false);
  if (!supported) {
    status.textContent = "Browser ini belum mendukung Web Push. Coba Chrome Android atau browser desktop yang mendukung notifikasi.";
    enableBtn.disabled = true;
    disableBtn.disabled = true;
    return;
  }
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("PASTE_")) {
    status.textContent = "Konfigurasi VAPID Public Key belum dipasang. Hubungi admin GMTC.";
    enableBtn.disabled = true;
  } else {
    status.textContent = "Izin browser: " + Notification.permission;
  }

  enableBtn.onclick = async () => {
    try {
      if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("PASTE_")) {
        throw new Error("VAPID Public Key belum dikonfigurasi.");
      }
      enableBtn.disabled = true;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Izin notifikasi belum diberikan.");
      const registration = await navigator.serviceWorker.ready;
      const messaging = getMessaging(getApps()[0]);
      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: registration
      });
      if (!token) throw new Error("Token perangkat tidak berhasil dibuat.");
      const id = deviceId();
      await setDoc(doc(db, "users", user.uid, "pushSubscriptions", id), {
        token,
        platform: /Android/i.test(navigator.userAgent) ? "android-web" : "web",
        userAgent: navigator.userAgent.slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      status.textContent = "Notifikasi aktif di perangkat ini.";
      showToast("Notifikasi GMTC berhasil diaktifkan.", "success");
    } catch (error) {
      console.error("Enable GMTC push failed:", error);
      status.textContent = error.message || "Gagal mengaktifkan notifikasi.";
      showToast(status.textContent, "error");
    } finally {
      enableBtn.disabled = false;
    }
  };

  disableBtn.onclick = async () => {
    try {
      disableBtn.disabled = true;
      const registration = await navigator.serviceWorker.ready;
      const messaging = getMessaging(getApps()[0]);
      const subscriptions = await getDocs(collection(db, "users", user.uid, "pushSubscriptions"));
      await Promise.all(subscriptions.docs.map(item => deleteDoc(item.ref)));
      await deleteToken(messaging).catch(() => {});
      await registration.pushManager.getSubscription().then(subscription => subscription?.unsubscribe()).catch(() => {});
      status.textContent = "Subscription notifikasi di perangkat ini telah dinonaktifkan.";
      showToast("Notifikasi dinonaktifkan.", "success");
    } catch (error) {
      console.error("Disable GMTC push failed:", error);
      showToast(error.message || "Gagal menonaktifkan notifikasi.", "error");
    } finally {
      disableBtn.disabled = false;
    }
  };
}
