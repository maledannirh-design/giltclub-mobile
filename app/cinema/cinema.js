import { auth, rtdb } from "../firebase.js";
import { ref as rtdbRef, set as rtdbSet, remove as rtdbRemove, onDisconnect as rtdbOnDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
// Load CSS as a stylesheet resource; browser modules do not support direct CSS imports.
function ensureCinemaStyles() {
  const href = new URL("./cinema.css", import.meta.url).href;
  if ([...document.querySelectorAll("link[rel=stylesheet]")].some(link => link.href === href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const SEATS = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  vvip: index < 4,
  singing: index === 0
}));

let stopPresence = null;

function startRoomPresence() {
  const user = auth.currentUser;
  if (!user?.uid) return;
  const presenceRef = rtdbRef(rtdb, "cinema/rooms/main/presence/" + user.uid);
  const payload = {
    uid: user.uid,
    username: user.displayName || "Member",
    joinedAt: Date.now()
  };
  rtdbOnDisconnect(presenceRef).remove()
    .then(() => rtdbSet(presenceRef, payload))
    .catch(error => console.error("Cinema presence setup failed:", error));
  stopPresence = () => rtdbRemove(presenceRef).catch(() => {});
  window.stopCinemaPresence = stopPresence;
}

export function renderCinemaRoom() {
  ensureCinemaStyles();
  startRoomPresence();
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <section class="cinema-page" aria-label="Giltclub Cinema">
      <section class="cinema-screen" aria-label="Layar video">
        <div class="cinema-screen-top"><span>▶ LAYAR YOUTUBE</span><span id="cinemaPlaybackLabel">Belum ada video</span></div>
        <div class="cinema-video-placeholder">
          <span class="cinema-play-icon" aria-hidden="true">▶</span>
          <strong>Layar YouTube akan tampil di sini</strong>
          <p>Integrasi YouTube dan sinkronisasi video dibuat pada tahap berikutnya.</p>
        </div>
      </section>

      <div class="cinema-grid">
        <section class="cinema-panel">
          <div class="cinema-panel-head">
            <h2>🪑 Tempat duduk</h2><span>16 kursi · 4 × 4</span>
          </div>
          <div class="cinema-stage">🎙 AREA PENYANYI</div>
          <div class="cinema-seats" id="cinemaSeats">
            ${SEATS.map(seat => `
              <div class="cinema-seat ${seat.vvip ? "is-vvip" : ""} ${seat.singing ? "is-singing" : ""}" aria-label="Kursi ${seat.id}">
                <span class="seat-icon">${seat.singing ? "🎤" : "💺"}</span>
                <span class="seat-name">Kursi ${String(seat.id).padStart(2, "0")}</span>
                <span class="seat-state">${seat.singing ? "Contoh penyanyi" : seat.vvip ? "VVIP" : "Kosong"}</span>
              </div>
            `).join("")}
          </div>
          <div class="cinema-legend"><span><b>Emas</b> · kursi VVIP</span><span>🎤 · contoh posisi penyanyi</span></div>
          <div class="cinema-tools">
            <button type="button" class="cinema-tool" id="cinemaMicButton" disabled>🎙 Mikrofon (tahap audio)</button>
            <button type="button" class="cinema-tool" id="cinemaEffectButton" disabled>✨ Efek suara (tahap audio)</button>
          </div>
        </section>

        <section class="cinema-panel">
          <div class="cinema-panel-head"><h2>💬 Chat room</h2><span>Prototype lokal</span></div>
          <div class="cinema-chat-log" id="cinemaChatLog" aria-live="polite">
            <div class="cinema-chat-note">Chat Firebase real-time akan dihubungkan pada tahap berikutnya.</div>
            <div class="cinema-chat-line"><strong>Giltclub:</strong> Selamat datang di Cinema 🎶</div>
          </div>
          <form class="cinema-chat-form" id="cinemaChatForm">
            <input id="cinemaChatInput" type="text" maxlength="300" placeholder="Tulis pesan..." aria-label="Tulis pesan" autocomplete="off" />
            <button class="cinema-button" type="submit">Kirim</button>
          </form>
        </section>
      </div>
    </section>
  `;

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
