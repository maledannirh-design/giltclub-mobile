import { auth, db, rtdb } from "../firebase.js";
import { doc, getDoc } from "../firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref as rtdbRef, set as rtdbSet, remove as rtdbRemove, onDisconnect as rtdbOnDisconnect, onValue as rtdbOnValue, runTransaction as rtdbRunTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// Load CSS as a stylesheet resource; browser modules do not support direct CSS imports.
function ensureCinemaStyles() {
  const href = new URL("./cinema.css", import.meta.url).href;
  if ([...document.querySelectorAll("link[rel=stylesheet]")].some(link => link.href === href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const CHAIR_IMAGE = "data:image/png;base64,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";

const SEATS = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  vvip: index < 4
}));


let stopPresence = null;
let stopPresenceCount = null;
let stopAuthListener = null;

let stopSeatListener = null;
let stopSeatDisconnect = null;
let seatAuthUser = null;

function showCinemaSeatNotice(message) {
  let notice = document.getElementById("cinemaSeatNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "cinemaSeatNotice";
    notice.className = "cinema-seat-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    document.querySelector(".cinema-page")?.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add("is-visible");
  clearTimeout(notice._hideTimer);
  notice._hideTimer = setTimeout(() => notice.classList.remove("is-visible"), 2600);
}

function startSeatSelection() {
  const seatsRoot = rtdbRef(rtdb, "cinema/rooms/main/seats");
  stopSeatListener?.();
  stopSeatListener = rtdbOnValue(seatsRoot, snapshot => {
    const seats = snapshot.val() || {};
    document.querySelectorAll(".cinema-seat.audience-seat").forEach(el => {
      const seatId = el.dataset.seatId;
      const occupant = seats[seatId];
      const icon = el.querySelector(".seat-icon");
      const chair = icon?.querySelector("img");
      const isMine = Boolean(occupant && seatAuthUser && occupant.uid === seatAuthUser.uid);
      el.classList.toggle("is-occupied", Boolean(occupant));
      el.classList.toggle("is-mine", isMine);
      if (icon) {
        let avatar = icon.querySelector(".seat-avatar");
        if (occupant) {
          if (!avatar) {
            avatar = document.createElement("span");
            avatar.className = "seat-avatar";
            icon.appendChild(avatar);
          }
          avatar.replaceChildren();
          if (occupant.photoURL) {
            const img = document.createElement("img");
            img.className = "seat-avatar-image";
            img.src = occupant.photoURL;
            img.alt = "";
            img.referrerPolicy = "no-referrer";
            avatar.appendChild(img);
          } else {
            avatar.textContent = (occupant.username || "M").trim().slice(0, 1).toUpperCase();
          }
          avatar.title = occupant.username || "Anggota";
          if (chair) chair.hidden = true;
        } else {
          avatar?.remove();
          if (chair) chair.hidden = false;
        }
      }
      el.setAttribute("aria-label", occupant
        ? `Kursi penonton ${seatId.replace("audience-", "")}, ditempati ${occupant.username || "anggota"}`
        : `Kursi penonton ${seatId.replace("audience-", "")}, kosong`);
      el.title = occupant
        ? (isMine ? "Kursi Anda — klik untuk berdiri" : `Diduduki ${occupant.username || "anggota"}`)
        : "Klik untuk duduk";
    });
  }, error => console.warn("Cinema seat listener unavailable:", error?.message || error));

  document.querySelectorAll(".cinema-seat.audience-seat").forEach(el => {
    if (el.dataset.seatBound === "true") return;
    el.dataset.seatBound = "true";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    const chooseSeat = async () => {
      const user = seatAuthUser;
      if (!user?.uid) {
        console.warn("Login diperlukan untuk memilih kursi.");
        return;
      }
      const seatId = el.dataset.seatId;
      if (!seatId) return;
      const seatRef = rtdbRef(rtdb, "cinema/rooms/main/seats/" + seatId);
      const buttonLabel = el.getAttribute("aria-label") || "kursi";
      try {
        let profile = {};
        try {
          const profileSnap = await getDoc(doc(db, "users", user.uid));
          if (profileSnap.exists()) profile = profileSnap.data() || {};
        } catch (profileError) {
          console.warn("Cinema profile photo unavailable:", profileError?.message || profileError);
        }
        const username = profile.username || profile.fullName || user.displayName || user.email?.split("@")[0] || "Member";
        const result = await rtdbRunTransaction(seatRef, current => {
          if (current && current.uid !== user.uid) return;
          if (current && current.uid === user.uid) return null;
          return {
            uid: user.uid,
            username,
            photoURL: profile.photoURL || user.photoURL || null,
            seatedAt: Date.now()
          };
        }, { applyLocally: false });
        if (!result.committed) {
          showCinemaSeatNotice("Kursi sudah terisi anggota lain.");
          return;
        }
        if (result.snapshot.val()) {
          showCinemaSeatNotice("Berhasil duduk di kursi " + seatId.replace("audience-", "") + ".");
          const seatDisconnectRef = rtdbRef(rtdb, "cinema/rooms/main/seats/" + seatId);
          await rtdbOnDisconnect(seatDisconnectRef).remove();
          stopSeatDisconnect?.();
          stopSeatDisconnect = () => rtdbRemove(seatDisconnectRef).catch(() => {});
          window.stopCinemaSeat = stopSeatDisconnect;
        } else {
          showCinemaSeatNotice("Anda berdiri dari kursi " + seatId.replace("audience-", "") + ".");
          stopSeatDisconnect?.();
          stopSeatDisconnect = null;
        }
      } catch (error) {
        showCinemaSeatNotice("Belum berhasil memilih kursi. Periksa izin Firebase.");
        console.warn("Cinema seat selection failed:", error?.message || error);
      }
    };
    el.addEventListener("click", chooseSeat);
    el.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseSeat();
      }
    });
  });
}

function startRoomPresence() {
  const presenceRoot = rtdbRef(rtdb, "cinema/rooms/main/presence");

  // Count every connected room member, whether seated or not.
  stopPresenceCount?.();
  stopPresenceCount = rtdbOnValue(presenceRoot, snapshot => {
    const presenceData = snapshot.val();
const count = presenceData && typeof presenceData === "object"
  ? Object.keys(presenceData).length
  : 0;
    const title = document.querySelector(".cinema-chat-card .cinema-panel-head h2");
    if (title) title.textContent = `💬 Chat (${count})`;
  }, error => {
    console.warn("Cinema presence count unavailable:", error?.message || error);
  });

  // Wait for Firebase Auth to resolve before writing a presence record.
  stopAuthListener?.();
  stopAuthListener = onAuthStateChanged(auth, user => {
    seatAuthUser = user || null;
    stopPresence?.();
    stopPresence = null;
    if (!user?.uid) return;

    const presenceRef = rtdbRef(rtdb, "cinema/rooms/main/presence/" + user.uid);
    const payload = {
      uid: user.uid,
      username: user.displayName || user.email?.split("@")[0] || "Member",
      joinedAt: Date.now()
    };

    rtdbOnDisconnect(presenceRef).remove()
      .then(() => rtdbSet(presenceRef, payload))
      .catch(error => console.warn("Cinema presence setup failed:", error?.message || error));

    stopPresence = () => rtdbRemove(presenceRef).catch(() => {});
    window.stopCinemaPresence = stopPresence;
  });

  window.addEventListener("pagehide", () => {
    stopPresence?.();
    stopPresenceCount?.();
    stopAuthListener?.();
  }, { once: true });
}

export function renderCinemaRoom() {
  ensureCinemaStyles();
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <section class="cinema-page cinema-room-fit" aria-label="Cinema room">
      <section class="cinema-screen cinema-room-card" aria-label="Layar YouTube">
        <div class="cinema-screen-top"><span>▶ YOUTUBE</span><span id="cinemaPlaybackLabel">Belum ada video</span></div>
        <div class="cinema-video-placeholder">
          <span class="cinema-play-icon" aria-hidden="true">▶</span>
          <strong>Layar YouTube akan tampil di sini</strong>
          <p>Integrasi YouTube akan dihubungkan pada tahap berikutnya.</p>
        </div>
      </section>

      <section class="cinema-panel cinema-seating-card cinema-room-card" aria-label="Kursi room">
        <div class="cinema-seat-layout">
          <div class="cinema-special-group singer-seats" aria-label="Kursi penyanyi">
            <div class="cinema-seat is-special is-singer" aria-label="Penyanyi 1"><span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span></div>
            <div class="cinema-seat is-special is-singer" aria-label="Penyanyi 2"><span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span></div>
          </div>
          <div class="cinema-special-group admin-seats" aria-label="Kursi moderator dan admin">
            <div class="cinema-seat is-special is-admin" aria-label="Moderator"><span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span></div>
            <div class="cinema-seat is-special is-admin" aria-label="Admin"><span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span></div>
          </div>
          <div class="cinema-audience-side audience-left" aria-label="Delapan kursi penonton kiri">
            ${SEATS.slice(0,8).map(seat => `
              <div class="cinema-seat audience-seat ${seat.vvip ? "is-vvip" : ""}" data-seat-id="audience-${seat.id}" aria-label="Kursi penonton ${seat.id}">
                <span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span>
              </div>
            `).join("")}
          </div>
          <div class="cinema-audience-side audience-right" aria-label="Delapan kursi penonton kanan">
            ${SEATS.slice(8,16).map(seat => `
              <div class="cinema-seat audience-seat ${seat.vvip ? "is-vvip" : ""}" data-seat-id="audience-${seat.id}" aria-label="Kursi penonton ${seat.id}">
                <span class="seat-icon"><img src="${CHAIR_IMAGE}" alt="" /></span>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="cinema-panel cinema-chat-card cinema-room-card" aria-label="Chat room">
        <div class="cinema-panel-head"><h2>💬 Chat</h2><a class="cinema-back-inline" href="../index.html">← GMTC</a></div>
        <div class="cinema-chat-log" id="cinemaChatLog" aria-live="polite">
          <div class="cinema-chat-line"><strong>GMTC:</strong> Selamat datang 🎶</div>
        </div>
        <form class="cinema-chat-form" id="cinemaChatForm">
          <input id="cinemaChatInput" type="text" maxlength="300" placeholder="Tulis pesan..." aria-label="Tulis pesan" autocomplete="off" />
          <button class="cinema-button" type="submit">Kirim</button>
        </form>
      </section>
    </section>
  `;

  startRoomPresence();
  startSeatSelection();

  const form = document.getElementById("cinemaChatForm");
  const input = document.getElementById("cinemaChatInput");
  const log = document.getElementById("cinemaChatLog");

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const message = input?.value?.trim();
    if (!message || !log) return;
    const line = document.createElement("div");
    line.className = "cinema-chat-line";
    const name = document.createElement("strong");
    name.textContent = "Anda: ";
    line.append(name, document.createTextNode(message));
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    input.value = "";
  });
}
