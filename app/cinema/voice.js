import { auth, rtdb } from "../firebase.js";
import {
  ref, onValue, onChildAdded, push, set, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ROOM = "cinema/rooms/main";
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };


export function initCinemaVoice() {
  const muteButton = document.getElementById("cinemaVoiceMute");
  if (!muteButton) return () => {};
  const status = document.getElementById("cinemaVoiceStatus");
  const loopbackButton = document.createElement("button");
  loopbackButton.id = "cinemaVoiceLoopback";
  loopbackButton.type = "button";
  loopbackButton.className = "cinema-voice-loopback";
  loopbackButton.textContent = "🎧";
  loopbackButton.title = "Loopback suara sendiri (gunakan headset)";
  loopbackButton.setAttribute("aria-label", "Loopback suara sendiri");
  loopbackButton.setAttribute("aria-pressed", "false");
  loopbackButton.hidden = true;
  muteButton.insertAdjacentElement("afterend", loopbackButton);
  const loopbackAudio = document.createElement("audio");
  loopbackAudio.id = "cinemaVoiceLoopbackAudio";
  loopbackAudio.autoplay = true;
  loopbackAudio.playsInline = true;
  loopbackAudio.volume = 1;
  loopbackAudio.style.display = "none";
  document.body.appendChild(loopbackAudio);
  let loopbackEnabled = false;
  let isSingerSeat = false;
  let user = auth.currentUser || null;
  let seated = false;
  let muted = false;
  let localStream = null;
  let stopAuth = null;
  let stopSeats = null;
  let stopIncoming = new Map();
  let peers = new Map();
  const connecting = new Set();
  const signalCutoffs = new Map();
  const signalQueues = new Map();
  const pendingCandidates = new Map();
  let sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let starting = false;
  let destroyed = false;
  let latestSeats = {};
  const reconnectTimers = new Map();
  let mixerConfig={voice:100,music:70,latency:0,preamp:0,bands:Array(10).fill(0)},mixerAudioContext=null;const audioGraphs=new Map();
  const getMixerContext=()=>{if(!mixerAudioContext){const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx)mixerAudioContext=new Ctx()}if(mixerAudioContext?.state==="suspended")mixerAudioContext.resume().catch(()=>{});return mixerAudioContext};
  const applyMixerToGraph=g=>{if(!g)return;g.delay.delayTime.setTargetAtTime(mixerConfig.latency/1000,g.context.currentTime,.03);g.preamp.gain.setTargetAtTime(Math.pow(10,mixerConfig.preamp/20),g.context.currentTime,.03);g.voiceGain.gain.setTargetAtTime(mixerConfig.voice/100,g.context.currentTime,.03);g.filters.forEach((f,i)=>f.gain.setTargetAtTime(Number(mixerConfig.bands?.[i]||0),g.context.currentTime,.03))};
  const onMixerConfig=e=>{const c=e.detail||{};mixerConfig={voice:Math.max(0,Math.min(150,Number(c.voice??100))),music:Math.max(0,Math.min(100,Number(c.music??70))),latency:Math.max(0,Math.min(500,Number(c.latency??0))),preamp:Math.max(-12,Math.min(12,Number(c.preamp??0))),bands:Array.from({length:10},(_,i)=>Math.max(-12,Math.min(12,Number(c.bands?.[i]??0))))};for(const item of peers.values())if(item.audio&&!audioGraphs.has(item.uid))item.audio.volume=Math.min(1,mixerConfig.voice/100);for(const g of audioGraphs.values())applyMixerToGraph(g)};
  window.addEventListener("cinema:mixer-config",onMixerConfig);

  const say = message => { if (status) status.textContent = message; };
  const setButton = () => {
    muteButton.hidden = !seated;
    loopbackButton.hidden = !(seated && isSingerSeat);
    loopbackButton.disabled = !(seated && isSingerSeat && localStream);
    loopbackButton.classList.toggle("is-active", loopbackEnabled);
    loopbackButton.setAttribute("aria-pressed", String(loopbackEnabled));
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
      const graph = audioGraphs.get(uid);
      if (graph) {
        try { graph.source.disconnect(); graph.delay.disconnect(); graph.preamp.disconnect(); graph.filters.forEach(f=>f.disconnect()); graph.voiceGain.disconnect(); } catch {}
        audioGraphs.delete(uid);
      }
      peers.delete(uid);
    }
    const stop = stopIncoming.get(uid);
    if (stop) { stop(); stopIncoming.delete(uid); }
  };
  const stopAll = async () => {
    for (const uid of [...peers.keys()]) stopPeer(uid);
    for (const stop of stopIncoming.values()) stop();
    stopIncoming.clear();
    for (const timer of reconnectTimers.values()) clearTimeout(timer);
    reconnectTimers.clear();
    loopbackEnabled = false;
    loopbackAudio.pause();
    loopbackAudio.srcObject = null;
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    setButton();
    // Do not delete the voiceSignals parent here: RTDB rules authorize per-peer paths,
    // and deleting the parent can be denied even when signaling itself is allowed.
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
    audio.volume = mixerVoiceVolume;
    document.body.appendChild(audio);
    const entry = { pc, audio, remoteSession: null, uid: peerUid };
    peers.set(peerUid, entry);
    pc.ontrack = event => {
      const remote = event.streams?.[0];
      if (remote) {
        audio.srcObject = remote;
        try {
          const context = getMixerContext();
          if(context&&!audioGraphs.has(peerUid)){const source=context.createMediaElementSource(audio),delay=context.createDelay(1),preamp=context.createGain();const filters=[32,64,125,250,500,1000,2000,4000,8000,16000].map((hz,i)=>{const f=context.createBiquadFilter();f.type="peaking";f.frequency.value=hz;f.Q.value=i<2?.8:1;return f});const voiceGain=context.createGain();source.connect(delay);delay.connect(preamp);let prev=preamp;for(const f of filters){prev.connect(f);prev=f}prev.connect(voiceGain);voiceGain.connect(context.destination);const graph={context,source,delay,preamp,filters,voiceGain};audioGraphs.set(peerUid,graph);applyMixerToGraph(graph);audio.volume=1}
        } catch (error) {
          console.warn("Cinema mixer EQ unavailable:", error?.message || error);
        }
        audio.play().then(() => {
          say("Audio anggota terhubung.");
        }).catch(() => say("Klik layar sekali untuk mengaktifkan pemutaran suara."));
        remote.getAudioTracks().forEach(track => {
          track.onunmute = () => console.info("Cinema voice: remote audio unmuted", peerUid);
          track.onmute = () => console.warn("Cinema voice: remote audio muted", peerUid);
          track.onended = () => console.warn("Cinema voice: remote audio ended", peerUid);
        });
      }
    };
    pc.onconnectionstatechange = () => {
      console.info("Cinema voice connection:", peerUid, pc.connectionState, pc.iceConnectionState);
      if (pc.connectionState === "failed") {
        say("Koneksi suara terputus. Mencoba menyambungkan ulang…");
        // Remove the stale peer and its signal listener, then renegotiate automatically.
        // This avoids requiring members to stand up and sit down again.
        if (reconnectTimers.has(peerUid)) clearTimeout(reconnectTimers.get(peerUid));
        const timer = setTimeout(async () => {
          reconnectTimers.delete(peerUid);
          const stillSeated = Object.values(latestSeats || {}).some(seat => seat?.uid === peerUid);
          if (destroyed || !seated || !stillSeated || !user?.uid) return;
          stopPeer(peerUid);
          pendingCandidates.delete(peerUid);
          signalCutoffs.delete(peerUid);
          const peerSeat = Object.values(latestSeats).find(seat => seat?.uid === peerUid);
          const mySeat = Object.values(latestSeats).find(seat => seat?.uid === user.uid);
          await connectPeer(peerUid, peerSeat?.seatedAt, mySeat?.seatedAt);
        }, 1200);
        reconnectTimers.set(peerUid, timer);
      } else if (pc.connectionState === "connected") {
        const timer = reconnectTimers.get(peerUid);
        if (timer) clearTimeout(timer);
        reconnectTimers.delete(peerUid);
        say("Audio anggota terhubung.");
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.info("Cinema voice ICE:", peerUid, pc.iceConnectionState);
    };
    pc.onicecandidateerror = event => {
      console.warn("Cinema voice ICE candidate error:", peerUid, event.errorCode, event.errorText);
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
  const processSignal = async (peerUid, signal) => {
    if (!signal || !seated || !user?.uid || signal.fromSession === sessionId) return;
    if (Number(signal.sentAt || 0) < Number(signalCutoffs.get(peerUid) || 0)) return;
    try {
      if (signal.type === "offer") {
        if (!peers.has(peerUid)) await createPeer(peerUid);
        const entry = peers.get(peerUid);
        if (!entry) return;
        // Ignore stale/duplicate offers once a remote description is already active.
        // If we have our own pending offer, use perfect-negotiation rollback first.
        if (entry.pc.currentRemoteDescription) return;
        if (entry.pc.signalingState === "have-local-offer") {
          await entry.pc.setLocalDescription({ type: "rollback" });
        } else if (entry.pc.signalingState !== "stable") {
          return;
        }
        await entry.pc.setRemoteDescription(signal.payload);
        const queued = pendingCandidates.get(peerUid) || [];
        pendingCandidates.delete(peerUid);
        for (const candidate of queued) {
          try { await entry.pc.addIceCandidate(candidate); } catch (err) { console.warn("Voice queued ICE:", err); }
        }
        if (entry.pc.signalingState !== "have-remote-offer") return;
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        if (entry.pc.signalingState !== "stable") return;
        await sendSignal(peerUid, "answer", { type: entry.pc.localDescription.type, sdp: entry.pc.localDescription.sdp });
      } else if (signal.type === "answer") {
        const entry = peers.get(peerUid);
        if (entry && !entry.pc.currentRemoteDescription && entry.pc.signalingState === "have-local-offer") {
          await entry.pc.setRemoteDescription(signal.payload);
          const queued = pendingCandidates.get(peerUid) || [];
          pendingCandidates.delete(peerUid);
          for (const candidate of queued) {
            try { await entry.pc.addIceCandidate(candidate); } catch (err) { console.warn("Voice queued ICE:", err); }
          }
        }
      } else if (signal.type === "candidate") {
        const entry = peers.get(peerUid);
        if (entry && signal.payload) {
          if (!entry.pc.remoteDescription) {
            const queued = pendingCandidates.get(peerUid) || [];
            queued.push(signal.payload);
            pendingCandidates.set(peerUid, queued);
          } else {
            try { await entry.pc.addIceCandidate(signal.payload); } catch (err) { console.warn("Voice candidate:", err); }
          }
        }
      }
    } catch (error) {
      console.warn("Cinema voice signaling failed:", error?.message || error);
      say("Koneksi suara belum berhasil. Coba duduk ulang.");
    }
  };
  // RTDB child-added callbacks may fire close together; serialize SDP changes per peer.
  const handleSignal = (peerUid, signal) => {
    const previous = signalQueues.get(peerUid) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => processSignal(peerUid, signal));
    signalQueues.set(peerUid, current);
    current.finally(() => {
      if (signalQueues.get(peerUid) === current) signalQueues.delete(peerUid);
    }).catch(() => {});
    return current;
  };
  // voice reconnect after failed connection is handled by pc.connectionStatechange.
  const connectPeer = async (peerUid, peerSeatedAt = 0, mySeatedAt = 0) => {
    if (!user?.uid || !seated || peerUid === user.uid || stopIncoming.has(peerUid) || connecting.has(peerUid)) return;
    connecting.add(peerUid);
    signalCutoffs.set(peerUid, Math.max(Number(peerSeatedAt || 0), Number(mySeatedAt || 0)));
    try {
      await createPeer(peerUid);
      const incomingRef = signalPath(peerUid, user.uid);
      const stop = onChildAdded(incomingRef, child => {
        handleSignal(peerUid, child.val());
      }, error => {
        console.warn("Voice signal listener:", error?.message || error);
        say("Izin koneksi suara belum tersedia di Firebase.");
      });
      stopIncoming.set(peerUid, stop);
    } catch (error) {
      console.warn("Cinema voice start failed:", error?.message || error);
      say(error?.name === "NotAllowedError" ? "Izinkan akses mikrofon di browser." : "Mikrofon belum bisa diaktifkan.");
    } finally {
      connecting.delete(peerUid);
    }
  };
  const reconcile = async seats => {
    latestSeats = seats || {};
    const mySeatEntry = Object.entries(seats || {}).find(([, seat]) => seat?.uid === user?.uid);
    isSingerSeat = Boolean(mySeatEntry && ["singer-1", "singer-2"].includes(mySeatEntry[0]));
    if (!isSingerSeat && loopbackEnabled) {
      loopbackEnabled = false;
      loopbackAudio.pause();
      loopbackAudio.srcObject = null;
    }
    setButton();
    const mySeat = Boolean(mySeatEntry);
    const mySeatedAt = Number(mySeatEntry?.[1]?.seatedAt || 0);
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
        say("Mikrofon aktif. Anda bisa berbicara.");
        Object.values(seats || {}).forEach(seat => {
          if (seat?.uid && seat.uid !== user.uid) connectPeer(seat.uid, seat.seatedAt, mySeatedAt);
        });
      } catch (error) {
        console.warn("Cinema microphone permission:", error?.message || error);
        say(error?.name === "NotAllowedError" ? "Izinkan mikrofon browser, lalu duduk ulang." : "Mikrofon tidak tersedia di perangkat ini.");
      } finally {
        starting = false;
      }
    } else {
      Object.values(seats || {}).forEach(seat => {
        if (seat?.uid && seat.uid !== user.uid) connectPeer(seat.uid, seat.seatedAt, mySeatedAt);
      });
      for (const uid of [...peers.keys()]) {
        if (!Object.values(seats || {}).some(seat => seat?.uid === uid)) { stopPeer(uid); pendingCandidates.delete(uid); signalCutoffs.delete(uid); }
      }
    }
  };
  loopbackButton.addEventListener("click", async () => {
    if (!seated || !isSingerSeat || !localStream) return;
    loopbackEnabled = !loopbackEnabled;
    if (loopbackEnabled) {
      // Local monitoring is intended for headphones to avoid acoustic feedback.
      loopbackAudio.srcObject = localStream;
      try {
        await loopbackAudio.play();
        say("Loopback aktif. Gunakan headset agar tidak terjadi gema.");
      } catch (error) {
        loopbackEnabled = false;
        loopbackAudio.pause();
        loopbackAudio.srcObject = null;
        say("Loopback belum bisa diputar. Ketuk ikon headset lagi.");
        console.warn("Cinema loopback playback blocked:", error?.message || error);
      }
    } else {
      loopbackAudio.pause();
      loopbackAudio.srcObject = null;
      say("Loopback dimatikan.");
    }
    setButton();
  });
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
    window.removeEventListener("cinema:mixer-config", onMixerConfig);
    for (const graph of audioGraphs.values()) {
      try { graph.source.disconnect(); graph.delay.disconnect(); graph.preamp.disconnect(); graph.filters.forEach(f=>f.disconnect()); graph.voiceGain.disconnect(); } catch {}
    }
    audioGraphs.clear();
    if (mixerAudioContext) mixerAudioContext.close().catch(() => {});
    loopbackEnabled = false;
    loopbackAudio.pause();
    loopbackAudio.srcObject = null;
    loopbackAudio.remove();
    loopbackButton.remove();
    stopAuth?.();
    stopSeats?.();
    stopAll();
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  return cleanup;
}
