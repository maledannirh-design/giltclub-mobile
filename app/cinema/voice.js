import { auth, rtdb } from "../firebase.js";
import {
  ref, onValue, push, set, remove, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ROOM = "cinema/rooms/main";
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function initCinemaVoice() {
  const muteButton = document.getElementById("cinemaVoiceMute");
  if (!muteButton) return () => {};
  const status = document.getElementById("cinemaVoiceStatus");
  let user = auth.currentUser || null;
  let seated = false;
  let muted = false;
  let localStream = null;
  let stopAuth = null;
  let stopSeats = null;
  let stopIncoming = new Map();
  let peers = new Map();
  let sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let starting = false;
  let destroyed = false;

  const say = message => { if (status) status.textContent = message; };
  const setButton = () => {
    muteButton.hidden = !seated;
    muteButton.disabled = !seated;
    muteButton.textContent = muted ? "🔇" : "🎙️";
    muteButton.title = muted ? "Nyalakan mikrofon" : "Matikan mikrofon";
    muteButton.setAttribute("aria-label", muteButton.title);
    muteButton.classList.toggle("is-muted", muted);
  };
  const signalPath = (from, to) => ref(rtdb, `${ROOM}/voiceSignals/${from}/${to}`);
  const sendSignal = async (peerUid, type, payload) => {
    if (!user?.uid || !seated || !peerUid) return;
    const signalRef = push(signalPath(user.uid, peerUid));
    await set(signalRef, { type, payload, fromSession: sessionId, sentAt: Date.now() });
  };
  const stopPeer = uid => {
    const item = peers.get(uid);
    if (item) {
      item.pc.onicecandidate = null;
      item.pc.ontrack = null;
      item.pc.close();
      item.audio?.remove();
      peers.delete(uid);
    }
    const stop = stopIncoming.get(uid);
    if (stop) { stop(); stopIncoming.delete(uid); }
  };
  const stopAll = async () => {
    for (const uid of [...peers.keys()]) stopPeer(uid);
    for (const stop of stopIncoming.values()) stop();
    stopIncoming.clear();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    if (user?.uid) {
      await remove(ref(rtdb, `${ROOM}/voiceSignals/${user.uid}`)).catch(() => {});
      await remove(ref(rtdb, `${ROOM}/voicePeers/${user.uid}`)).catch(() => {});
    }
    starting = false;
  };
  const ensureMic = async () => {
    if (localStream) return localStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser tidak mendukung mikrofon.");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
    return localStream;
  };
  const createPeer = async peerUid => {
    if (!user?.uid || !seated || peerUid === user.uid || peers.has(peerUid)) return;
    const stream = await ensureMic();
    const pc = new RTCPeerConnection(ICE);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute("aria-label", "Suara anggota room");
    audio.style.display = "none";
    document.body.appendChild(audio);
    const entry = { pc, audio, remoteSession: null };
    peers.set(peerUid, entry);
    pc.ontrack = event => {
      const remote = event.streams?.[0];
      if (remote) {
        audio.srcObject = remote;
        audio.play().catch(() => say("Klik layar sekali jika suara belum terdengar."));
      }
    };
    pc.onicecandidate = event => {
      if (event.candidate) sendSignal(peerUid, "candidate", event.candidate.toJSON()).catch(err => console.warn("Voice ICE:", err));
    };
    if (user.uid.localeCompare(peerUid) < 0) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(peerUid, "offer", { type: pc.localDescription.type, sdp: pc.localDescription.sdp });
    }
  };
  const handleSignal = async (peerUid, signal) => {
    if (!signal || !seated || !user?.uid || signal.fromSession === sessionId) return;
    try {
      if (signal.type === "offer") {
        stopPeer(peerUid);
        await createPeer(peerUid);
        const entry = peers.get(peerUid);
        if (!entry) return;
        await entry.pc.setRemoteDescription(signal.payload);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        await sendSignal(peerUid, "answer", { type: entry.pc.localDescription.type, sdp: entry.pc.localDescription.sdp });
      } else if (signal.type === "answer") {
        const entry = peers.get(peerUid);
        if (entry && !entry.pc.currentRemoteDescription) await entry.pc.setRemoteDescription(signal.payload);
      } else if (signal.type === "candidate") {
        const entry = peers.get(peerUid);
        if (entry && signal.payload) {
          try { await entry.pc.addIceCandidate(signal.payload); } catch (err) { console.warn("Voice candidate:", err); }
        }
      }
    } catch (error) {
      console.warn("Cinema voice signaling failed:", error?.message || error);
      say("Koneksi suara belum berhasil. Coba duduk ulang.");
    }
  };
  const connectPeer = async peerUid => {
    if (!user?.uid || !seated || peerUid === user.uid || stopIncoming.has(peerUid)) return;
    try {
      await createPeer(peerUid);
      const incomingRef = signalPath(peerUid, user.uid);
      const stop = onValue(incomingRef, snapshot => {
        snapshot.forEach(child => handleSignal(peerUid, child.val()));
      }, error => {
        console.warn("Voice signal listener:", error?.message || error);
        say("Izin koneksi suara belum tersedia di Firebase.");
      });
      stopIncoming.set(peerUid, stop);
    } catch (error) {
      console.warn("Cinema voice start failed:", error?.message || error);
      say(error?.name === "NotAllowedError" ? "Izinkan akses mikrofon di browser." : "Mikrofon belum bisa diaktifkan.");
    }
  };
  const reconcile = async seats => {
    const mySeat = Object.values(seats || {}).some(seat => seat?.uid === user?.uid);
    if (!mySeat) {
      if (seated || localStream || peers.size) await stopAll();
      seated = false;
      muted = false;
      setButton();
      say("Duduk di kursi untuk mengaktifkan suara.");
      return;
    }
    if (!seated) {
      seated = true;
      setButton();
      say("Meminta izin mikrofon…");
      if (starting) return;
      starting = true;
      try {
        await ensureMic();
        const peerRef = ref(rtdb, `${ROOM}/voicePeers/${user.uid}`);
        await set(peerRef, { uid: user.uid, sessionId, seatedAt: Date.now() });
        await onDisconnect(peerRef).remove();
        say("Mikrofon aktif. Anda bisa berbicara.");
        Object.values(seats || {}).forEach(seat => {
          if (seat?.uid && seat.uid !== user.uid) connectPeer(seat.uid);
        });
      } catch (error) {
        console.warn("Cinema microphone permission:", error?.message || error);
        say(error?.name === "NotAllowedError" ? "Izinkan mikrofon browser, lalu duduk ulang." : "Mikrofon tidak tersedia di perangkat ini.");
      } finally {
        starting = false;
      }
    } else {
      Object.values(seats || {}).forEach(seat => {
        if (seat?.uid && seat.uid !== user.uid) connectPeer(seat.uid);
      });
      for (const uid of [...peers.keys()]) {
        if (!Object.values(seats || {}).some(seat => seat?.uid === uid)) stopPeer(uid);
      }
    }
  };
  muteButton.addEventListener("click", () => {
    if (!seated || !localStream) return;
    muted = !muted;
    localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
    setButton();
    say(muted ? "Mikrofon dimatikan." : "Mikrofon aktif.");
  });
  stopAuth = onAuthStateChanged(auth, nextUser => {
    user = nextUser || null;
    stopSeats?.();
    stopSeats = null;
    stopAll().finally(() => {
      seated = false;
      setButton();
      if (!user?.uid) { say("Login dan duduk untuk menggunakan suara."); return; }
      stopSeats = onValue(ref(rtdb, `${ROOM}/seats`), snapshot => reconcile(snapshot.val() || {}), error => {
        console.warn("Cinema voice seat listener:", error?.message || error);
        say("Tidak dapat membaca status kursi untuk suara.");
      });
    });
  });
  const cleanup = () => {
    destroyed = true;
    stopAuth?.();
    stopSeats?.();
    stopAll();
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  return cleanup;
}
