
/**
 * Self-contained Multi-Participant Google Meet-style WebRTC HTML Generator for StudyMath
 * Menampilkan tampilan persis seperti desain 4 orang sebelumnya (Pastel Dreamy Background,
 * Pomodoro 25:00 Card, Frosted Capsule, 4 Kartu Partisipan) dengan video & mikrofon aktif,
 * dan tata letak grid adaptif yang otomatis menyesuaikan jika peserta bertambah lebih dari 4 orang.
 */

export interface GroupWebRtcParams {
  serverId: string;
  myUserId: string;
  myName: string;
  myAvatar?: string;
  type: 'video' | 'voice' | 'pomodoro';
  serverName: string;
}

export function getGroupWebRtcHtml({
  serverId,
  myUserId,
  myName,
  myAvatar,
  type,
  serverName,
}: GroupWebRtcParams): string {
  const isVoiceOnly = type === 'voice';
  const cleanServerId = serverId.replace(/[^a-zA-Z0-9]/g, '').slice(-16);
  const cleanUserId = myUserId.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  const myPeerId = `sm_g_${cleanServerId}_${cleanUserId}`;

  const defaultAvatar =
    myAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      myName
    )}&background=cd4f75&color=fff&size=200`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: gap: https://ssl.gstatic.com;" />
  <title>${serverName} - Study Session</title>
  <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100%; height: 100%; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      user-select: none; -webkit-user-select: none;
      background: linear-gradient(135deg, #c4b5fd 0%, #f472b6 35%, #7dd3fc 70%, #86efac 100%);
    }

    #appWrapper {
      position: relative; width: 100%; height: 100%;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 10px 14px 12px 14px;
    }

    /* ==================== 1. TOP NAV ==================== */
    .top-nav {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 2px;
    }
    .cyan-back-btn {
      width: 40px; height: 40px; border-radius: 20px;
      background: #38bdf8; border: none;
      color: #fff; font-size: 22px; font-weight: bold;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);
      cursor: pointer; outline: none;
    }
    .nav-title-wrap {
      flex: 1; margin-left: 12px;
    }
    .focus-title {
      font-size: 24px; font-weight: 800; letter-spacing: -0.3px; line-height: 26px;
    }
    .focus-word { color: #2563eb; }
    .mode-word { color: #9333ea; }
    .members-subtitle {
      font-size: 12px; font-weight: 700; color: #ffffff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .settings-btn {
      width: 38px; height: 38px; border-radius: 19px;
      background: rgba(255, 255, 255, 0.65);
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; cursor: pointer; outline: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    /* ==================== 2. CAPSULE & SERVER NAME ==================== */
    .session-section {
      display: flex; flex-direction: column; align-items: center;
      margin: 2px 0;
    }
    .frosted-capsule {
      padding: 4px 22px; border-radius: 20px;
      background: rgba(255, 255, 255, 0.52);
      border: 1.5px solid rgba(255, 255, 255, 0.92);
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      font-size: 15px; font-weight: 800;
      margin-bottom: 2px;
    }
    .capsule-orange { color: #f59e0b; }
    .capsule-green { color: #10b981; }
    .server-name-heading {
      font-size: 16.5px; font-weight: 800; color: #0f172a;
      text-align: center; max-width: 90%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ==================== 3. TIMER CARD ==================== */
    .timer-card {
      background: rgba(255, 255, 255, 0.48);
      border-radius: 22px;
      padding: 6px 24px;
      display: flex; flex-direction: column; align-items: center;
      align-self: center; min-width: 160px;
      border: 1.5px solid rgba(255, 255, 255, 0.92);
      box-shadow: 0 4px 10px rgba(234, 88, 12, 0.16);
      margin: 2px 0 6px 0;
    }
    .timer-numbers {
      font-size: 36px; font-weight: 800;
      color: #ff4d15; letter-spacing: 2px; line-height: 40px;
      text-shadow: 0 2px 6px rgba(255, 77, 21, 0.35);
    }
    .glass-pill-btn {
      background: rgba(255, 255, 255, 0.85);
      border: 1.2px solid #ffffff;
      padding: 3px 22px; border-radius: 20px;
      font-size: 12px; font-weight: 700; color: #1e293b;
      cursor: pointer; transition: all 0.2s; outline: none;
    }
    .glass-pill-btn.active {
      background: #ff4d15; color: #ffffff; border-color: #ff4d15;
    }

    /* ==================== 4. DYNAMIC PARTICIPANT GRID ==================== */
    #gridArea {
      flex: 1; width: 100%;
      display: grid;
      gap: 10px;
      margin: 4px 0 8px 0;
      align-content: stretch;
      overflow-y: auto;
    }

    /* 1 orang: 1 frame penuh */
    .grid-1 {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    .grid-1 #slot_local {
      grid-column: 1;
    }

    /* 2 orang: 1 kolom x 2 baris (atas-bawah) */
    .grid-2 {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .grid-2 #slot_local {
      grid-column: 1;
    }

    /* 3 orang: 2 kolom x 2 baris, slot lokal span 2 di baris bawah */
    .grid-3 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .grid-3 #slot_local {
      grid-column: span 2;
    }

    /* 4 orang: 2x2 Grid */
    .grid-4 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .grid-4 #slot_local {
      grid-column: auto;
    }

    /* 5-6 orang: 2 kolom x 3 baris */
    .grid-6 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
    }
    .grid-6 #slot_local {
      grid-column: auto;
    }

    /* 7+ orang: 3 kolom scrollable */
    .grid-multi {
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 140px;
    }
    .grid-multi #slot_local {
      grid-column: auto;
    }

    /* Participant Card */
    .p-card {
      position: relative;
      background: rgba(255, 255, 255, 0.44);
      border-radius: 24px;
      border: 1.5px solid rgba(255, 255, 255, 0.88);
      box-shadow: 0 6px 12px rgba(168, 85, 247, 0.12);
      overflow: hidden;
      display: flex; flex-direction: column; justify-content: space-between;
      align-items: center; padding: 6px;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .p-card.speaking {
      box-shadow: 0 0 0 3.5px #10b981, 0 6px 16px rgba(16, 185, 129, 0.45);
    }

    /* Card Top Area */
    .card-top {
      width: 100%; height: 22px;
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 4px; z-index: 2;
    }
    .card-badge {
      background: rgba(255, 255, 255, 0.78);
      padding: 2px 6px; border-radius: 10px;
      font-size: 10px; font-weight: 700; color: #1e293b;
    }
    .card-mic {
      background: rgba(255, 255, 255, 0.85);
      border-radius: 10px; padding: 2px 5px;
      font-size: 10px;
    }
    .card-mic.muted {
      background: rgba(239, 68, 68, 0.85); color: #fff;
    }

    /* Card Center Video & Avatar */
    .card-center {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      z-index: 1;
    }
    .card-video {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%; object-fit: cover;
      z-index: 1;
    }
    .card-video.mirror {
      transform: scaleX(-1);
    }
    .cam-off-avatar {
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px;
      z-index: 2;
    }
    .avatar-img-wrap {
      width: 64px; height: 64px; border-radius: 32px;
      border: 3px solid rgba(255, 255, 255, 0.95);
      overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.12);
    }
    .avatar-img-wrap img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .empty-icon-wrap {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px;
    }
    .empty-plus {
      font-size: 26px; color: #38bdf8;
    }
    .empty-svg-cam {
      width: 44px; height: 32px;
    }

    /* Card Bottom Name Area */
    .card-bottom {
      width: 100%; height: 26px;
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
    }
    .card-name {
      font-size: 13px; font-weight: 800; color: #0f172a;
      background: rgba(255, 255, 255, 0.72);
      padding: 2px 10px; border-radius: 12px;
      max-width: 92%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ==================== 5. BOTTOM CONTROLS DOCK ==================== */
    .bottom-dock {
      display: flex; justify-content: space-around; align-items: center;
      background: rgba(255, 255, 255, 0.68);
      backdrop-filter: blur(12px);
      border-radius: 24px; padding: 7px 8px;
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      z-index: 10;
    }
    .dock-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer; outline: none;
      padding: 2px 10px; border-radius: 12px;
      transition: transform 0.1s;
    }
    .dock-btn:active { transform: scale(0.92); }
    .dock-btn.muted { opacity: 0.45; }
    .dock-icon { font-size: 19px; line-height: 22px; }
    .dock-label {
      font-size: 9.5px; font-weight: 600; color: #334155; margin-top: 1px;
    }
    .dock-btn.leave .dock-label { color: #ef4444; font-weight: 700; }

    /* Audio Waves Animation */
    .audio-waves {
      display: flex; align-items: center; gap: 3px; height: 12px;
    }
    .wave-bar {
      width: 3px; height: 100%; background: #38bdf8; border-radius: 2px;
      animation: wavePulse 1s ease-in-out infinite alternate;
    }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 60%; background: #a855f7; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 80%; background: #f472b6; }
    @keyframes wavePulse {
      0% { transform: scaleY(0.3); }
      100% { transform: scaleY(1.2); }
    }

    #toast {
      position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.88); color: #fff;
      padding: 5px 14px; border-radius: 18px; font-size: 11.5px; font-weight: 600;
      display: none; z-index: 999;
    }
  </style>
</head>
<body>
  <div id="toast"></div>
  <!-- Pre-declared Remote Audio Pool (agar lolos autoplay policy Android WebView persis seperti call 1-on-1) -->
  <div id="remoteAudioPool" style="display:none;">
    <audio id="poolAudio_1" autoplay playsinline webkit-playsinline></audio>
    <audio id="poolAudio_2" autoplay playsinline webkit-playsinline></audio>
    <audio id="poolAudio_3" autoplay playsinline webkit-playsinline></audio>
    <audio id="poolAudio_4" autoplay playsinline webkit-playsinline></audio>
    <audio id="poolAudio_5" autoplay playsinline webkit-playsinline></audio>
    <audio id="poolAudio_6" autoplay playsinline webkit-playsinline></audio>
  </div>

  <div id="appWrapper">
    <!-- 1. TOP NAV -->
    <div class="top-nav">
      <button class="cyan-back-btn" onclick="leaveRoom()">←</button>
      <div class="nav-title-wrap">
        <div class="focus-title">
          <span class="focus-word">Focus </span><span class="mode-word">Mode</span>
        </div>
        <div class="members-subtitle" id="memberCountText">1 Member Studying</div>
      </div>
      <button class="settings-btn" onclick="openSettingsModal()">⚙️</button>
    </div>

    <!-- 2. SESSION SECTION -->
    <div class="session-section">
      <div class="frosted-capsule" id="capsuleBadge">
        <span class="capsule-orange">Study </span><span class="capsule-green">Session</span>
      </div>
      <div class="server-name-heading">${serverName}</div>
    </div>

    <!-- 3. POMODORO TIMER CARD -->
    <div class="timer-card">
      <div class="timer-numbers" id="pomoTime">25 : 00</div>
      <button class="glass-pill-btn" id="pomoBtn" onclick="togglePomodoro()">Start</button>
    </div>

    <!-- 4. PARTICIPANT GRID (Dinamis: Hanya Anggota yang Aktif/Join) -->
    <div id="gridArea" class="grid-1">
      <!-- Slot Lokal: You (Partisipan Lokal dengan Kamera Aktif) -->
      <div class="p-card" id="slot_local">
        <div class="card-top">
          <div class="card-badge" id="localTimerBadge">🍅 25 : 00</div>
          <div class="card-mic" id="localMicBadge">🎙️</div>
        </div>
        <div class="card-center">
          <video id="localVideo" class="card-video mirror" autoplay playsinline webkit-playsinline muted></video>
          <div class="cam-off-avatar" id="localCamOffAvatar" style="display: none;">
            <div class="avatar-img-wrap">
              <img src="${defaultAvatar}" alt="${myName}" />
            </div>
            <div class="audio-waves">
              <div class="wave-bar"></div>
              <div class="wave-bar"></div>
              <div class="wave-bar"></div>
            </div>
          </div>
        </div>
        <div class="card-bottom">
          <span class="card-name">You</span>
        </div>
      </div>
    </div>

    <!-- 5. BOTTOM CONTROLS DOCK -->
    <div class="bottom-dock">
      <button class="dock-btn" id="btnMic" onclick="toggleMic()">
        <span class="dock-icon" id="iconMic">🎙️</span>
        <span class="dock-label" id="labelMic">Mute</span>
      </button>

      <button class="dock-btn" id="btnCam" onclick="toggleCam()">
        <span class="dock-icon" id="iconCam">📹</span>
        <span class="dock-label" id="labelCam">Cam Off</span>
      </button>

      <button class="dock-btn" onclick="openInviteModal()">
        <span class="dock-icon">👥</span>
        <span class="dock-label">Undang</span>
      </button>

      <button class="dock-btn" onclick="resetPomodoro()">
        <span class="dock-icon">🔄</span>
        <span class="dock-label">Reset</span>
      </button>

      <button class="dock-btn leave" onclick="leaveRoom()">
        <span class="dock-icon">📞</span>
        <span class="dock-label">Keluar</span>
      </button>
    </div>
  </div>

  <script>
    // State Aplikasi
    const myPeerId = "${myPeerId}";
    const myName = "${myName}";
    const myAvatar = "${defaultAvatar}";
    const isVoiceOnly = ${isVoiceOnly};
    let localStream = null;
    let mediaInitDone = false;
    let isLocalSpeaking = false;
    let peer = null;
    const activeCalls = {}; // peerId -> { call, name, avatar, stream, audioEl, cardEl }
    const ongoingCalls = {}; // peerId -> { call, startedAt }
    const dataConns = {}; // peerId -> DataConnection
    const backgroundProbePeers = {}; // peerId -> { name, avatar } (seluruh anggota server)
    window.__peerMeta = {};

    let isMicMuted = false;
    let isCamOff = isVoiceOnly;

    // Pomodoro Timer States
    let pomoSeconds = 25 * 60;
    let pomoRunning = false;
    let pomoInterval = null;
    let pomoMode = 'study'; // 'study' | 'short_break' | 'long_break'

    // DOM Elements
    const gridArea = document.getElementById('gridArea');
    const localVideo = document.getElementById('localVideo');
    const localCamOffAvatar = document.getElementById('localCamOffAvatar');
    const slotLocal = document.getElementById('slot_local');
    const localMicBadge = document.getElementById('localMicBadge');
    const localTimerBadge = document.getElementById('localTimerBadge');
    const btnMic = document.getElementById('btnMic');
    const iconMic = document.getElementById('iconMic');
    const labelMic = document.getElementById('labelMic');
    const btnCam = document.getElementById('btnCam');
    const iconCam = document.getElementById('iconCam');
    const labelCam = document.getElementById('labelCam');
    const pomoTime = document.getElementById('pomoTime');
    const pomoBtn = document.getElementById('pomoBtn');
    const memberCountText = document.getElementById('memberCountText');
    const toast = document.getElementById('toast');

    function showToast(msg) {
      if (!toast) return;
      toast.innerText = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2500);
    }

    function notifyRN(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    (function() {
      const origLog = console.log;
      const origWarn = console.warn;
      const origErr = console.error;
      function sendLog(level, args) {
        try {
          const msg = Array.prototype.slice.call(args).map(function(a) {
            return typeof a === 'object' ? JSON.stringify(a) : String(a);
          }).join(' ');
          notifyRN({ type: 'WEBVIEW_LOG', level: level, message: msg });
        } catch (e) {}
      }
      console.log = function() { sendLog('LOG', arguments); if (origLog) origLog.apply(console, arguments); };
      console.warn = function() { sendLog('WARN', arguments); if (origWarn) origWarn.apply(console, arguments); };
      console.error = function() { sendLog('ERR', arguments); if (origErr) origErr.apply(console, arguments); };
      window.onerror = function(msg, src, line, col) {
        sendLog('ONERROR', [msg, 'line:' + line, 'col:' + col]);
        return false;
      };
    })();

    function openSettingsModal() {
      notifyRN({ type: 'OPEN_SETTINGS' });
    }

    function openInviteModal() {
      notifyRN({ type: 'OPEN_INVITE' });
    }

    // Auto Unlock Audio & Video on touch (persis seperti webrtcHtml.ts yang sudah terbukti jalan di Android)
    let sharedAudioContext = null;
    const assignedPoolAudios = {}; // peerId -> HTMLAudioElement

    function getOrAssignAudioElement(peerId) {
      if (assignedPoolAudios[peerId]) return assignedPoolAudios[peerId];
      for (let i = 1; i <= 6; i++) {
        const el = document.getElementById('poolAudio_' + i);
        if (el && !el.getAttribute('data-peer')) {
          el.setAttribute('data-peer', peerId);
          assignedPoolAudios[peerId] = el;
          return el;
        }
      }
      let dynEl = document.getElementById('audio_' + peerId);
      if (!dynEl) {
        dynEl = document.createElement('audio');
        dynEl.id = 'audio_' + peerId;
        dynEl.autoplay = true;
        dynEl.setAttribute('playsinline', '');
        dynEl.setAttribute('webkit-playsinline', '');
        document.body.appendChild(dynEl);
      }
      assignedPoolAudios[peerId] = dynEl;
      return dynEl;
    }

    function releaseAudioElement(peerId) {
      const el = assignedPoolAudios[peerId];
      if (el) {
        try {
          el.pause();
          el.srcObject = null;
        } catch(e) {}
        if (el.id && el.id.indexOf('poolAudio_') === 0) {
          el.removeAttribute('data-peer');
        } else {
          el.remove();
        }
        delete assignedPoolAudios[peerId];
      }
    }

    window.unlockAudio = function() {
      try {
        if (!sharedAudioContext) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
          sharedAudioContext.resume().catch(function() {});
        }
      } catch (e) {}

      if (localVideo && localVideo.srcObject) {
        localVideo.play().catch(function() {});
      }

      Object.keys(activeCalls).forEach(function(pid) {
        const item = activeCalls[pid];
        if (item) {
          if (item.audioEl && item.audioEl.srcObject) {
            item.audioEl.muted = false;
            item.audioEl.volume = 1.0;
            item.audioEl.play().catch(function() {});
          }
          const vEl = document.getElementById('video_' + pid);
          if (vEl && vEl.srcObject) {
            vEl.play().catch(function() {});
          }
        }
      });
    };
    document.addEventListener('touchstart', window.unlockAudio, { passive: true });
    document.addEventListener('click', window.unlockAudio, { passive: true });

    // Broadcast status kita ke seluruh peer via DataChannel P2P
    function broadcastMyPeerState() {
      const payload = {
        type: 'PEER_STATE',
        peerId: myPeerId,
        name: myName,
        avatar: myAvatar,
        camOff: isCamOff,
        micMuted: isMicMuted,
        speaking: isLocalSpeaking && !isMicMuted,
        timeLeft: pomoSeconds,
        isRunning: pomoRunning,
      };
      Object.keys(dataConns).forEach(function(pid) {
        const dc = dataConns[pid];
        if (dc && dc.open) {
          try { dc.send(payload); } catch(e) {}
        }
      });
    }

    // Terapkan state kamera/mic/timer dari peer lawan
    function applyRemotePeerState(peerId, data) {
      if (!peerId || peerId === myPeerId || !data) return;
      const prev = window.__peerMeta[peerId] || {};
      window.__peerMeta[peerId] = {
        name: data.name || prev.name || 'Teman Belajar',
        avatar: data.avatar || prev.avatar || '',
        camOff: data.camOff !== undefined ? data.camOff : prev.camOff,
        micMuted: data.micMuted !== undefined ? data.micMuted : prev.micMuted,
      };

      const card = ensureRemoteCard(peerId, window.__peerMeta[peerId].name, window.__peerMeta[peerId].avatar);
      if (!card) return;

      if (data.timeLeft !== undefined) {
        const badge = document.getElementById('badge_' + peerId);
        if (badge) {
          const m = String(Math.floor(data.timeLeft / 60)).padStart(2, '0');
          const s = String(data.timeLeft % 60).padStart(2, '0');
          badge.innerText = '🍅 ' + m + ' : ' + s;
        }
      }

      if (data.micMuted !== undefined) {
        const micEl = document.getElementById('mic_' + peerId);
        if (micEl) {
          micEl.innerText = data.micMuted ? '🔇' : '🎙️';
          if (data.micMuted) micEl.classList.add('muted');
          else micEl.classList.remove('muted');
        }
        if (data.micMuted) {
          card.classList.remove('speaking');
        }
      }

      if (data.speaking !== undefined) {
        if (data.speaking && !window.__peerMeta[peerId].micMuted) {
          card.classList.add('speaking');
        } else {
          card.classList.remove('speaking');
        }
      }

      if (data.camOff !== undefined) {
        const avWrap = document.getElementById('avatar_' + peerId);
        const hasActiveStream = activeCalls[peerId] && activeCalls[peerId].stream && activeCalls[peerId].stream.getVideoTracks().length > 0;
        if (avWrap) {
          avWrap.style.display = (data.camOff || !hasActiveStream) ? 'flex' : 'none';
        }
      }
    }

    function setupDataConn(conn) {
      if (!conn || !conn.peer) return;
      const remotePid = conn.peer;
      dataConns[remotePid] = conn;

      if (conn.metadata) {
        applyRemotePeerState(remotePid, conn.metadata);
      }

      conn.on('open', function() {
        try {
          conn.send({
            type: 'PEER_STATE',
            peerId: myPeerId,
            name: myName,
            avatar: myAvatar,
            camOff: isCamOff,
            micMuted: isMicMuted,
            timeLeft: pomoSeconds,
            isRunning: pomoRunning,
          });
        } catch(e) {}

        // Jika belum punya stream video/audio aktif dengan peer ini, segera panggil!
        if (!activeCalls[remotePid] || !activeCalls[remotePid].stream) {
          callPeerNow(remotePid);
        }
      });

      conn.on('data', function(data) {
        if (!data) return;
        if (data.type === 'PEER_STATE') {
          applyRemotePeerState(remotePid, data);
          if (!activeCalls[remotePid] || !activeCalls[remotePid].stream) {
            callPeerNow(remotePid);
          }
        } else if (data.type === 'PEER_LEAVE') {
          window.disconnectPeer(remotePid);
        }
      });

      conn.on('close', function() {
        if (dataConns[remotePid] === conn) {
          delete dataConns[remotePid];
        }
        window.disconnectPeer(remotePid);
      });

      conn.on('error', function() {
        if (dataConns[remotePid] === conn) {
          delete dataConns[remotePid];
        }
      });
    }

    // Voice Activity Detection KHUSUS Local Stream
    // PENTING: Jangan pernah memanggil createMediaStreamSource(remoteStream) di Android WebView
    // karena membajak jalur audio WebRTC remote dan menyebabkan suara teman menjadi bisu (silent)!
    function setupLocalVoiceDetection(stream, cardEl) {
      try {
        if (!stream || stream.getAudioTracks().length === 0) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!sharedAudioContext) {
          sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext.state === 'suspended') {
          sharedAudioContext.resume().catch(function() {});
        }
        const src = sharedAudioContext.createMediaStreamSource(stream);
        const analyser = sharedAudioContext.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        setInterval(() => {
          if (isMicMuted) {
            if (isLocalSpeaking) {
              isLocalSpeaking = false;
              if (cardEl) cardEl.classList.remove('speaking');
              broadcastMyPeerState();
            }
            return;
          }
          if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(function() {});
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const isNowSpeaking = avg > 18;
          if (isNowSpeaking !== isLocalSpeaking) {
            isLocalSpeaking = isNowSpeaking;
            if (cardEl) {
              if (isLocalSpeaking) {
                cardEl.classList.add('speaking');
              } else {
                cardEl.classList.remove('speaking');
              }
            }
            broadcastMyPeerState();
          }
        }, 180);
      } catch(e) {
        console.warn('VAD setup error:', e);
      }
    }

    // Sinkronisasi track mikrofon & kamera asli ke seluruh koneksi PeerConnection aktif
    function syncLocalTracksToPeerConnections() {
      if (!localStream) return;
      const audioTrack = localStream.getAudioTracks()[0] || null;
      const videoTrack = localStream.getVideoTracks()[0] || null;

      if (audioTrack) {
        audioTrack.enabled = !isMicMuted;
      }
      if (videoTrack) {
        videoTrack.enabled = !isCamOff;
      }

      const allCallObjs = [];
      Object.keys(ongoingCalls).forEach(function(pid) {
        if (ongoingCalls[pid] && ongoingCalls[pid].call) {
          allCallObjs.push(ongoingCalls[pid].call);
        }
      });
      Object.keys(activeCalls).forEach(function(pid) {
        if (activeCalls[pid] && activeCalls[pid].call) {
          allCallObjs.push(activeCalls[pid].call);
        }
      });

      allCallObjs.forEach(function(callObj) {
        try {
          const pc = callObj.peerConnection;
          if (!pc || typeof pc.getSenders !== 'function') return;
          const senders = pc.getSenders();
          senders.forEach(function(sender) {
            if (sender && sender.track) {
              if (sender.track.kind === 'audio' && audioTrack && sender.track !== audioTrack) {
                sender.replaceTrack(audioTrack).catch(function() {});
              } else if (sender.track.kind === 'video' && videoTrack && sender.track !== videoTrack) {
                sender.replaceTrack(videoTrack).catch(function() {});
              }
            }
          });
        } catch (e) {}
      });
    }

    // Adaptasi Grid Berdasarkan Jumlah Orang (Dinamis: 1, 2, 3, 4, 6, multi)
    function updateGridLayout() {
      const remoteCards = document.querySelectorAll('.p-card[id^="card_"]');
      const totalParticipants = 1 + remoteCards.length; // You + remote

      if (memberCountText) {
        memberCountText.innerText = totalParticipants + (totalParticipants > 1 ? ' Members Studying' : ' Member Studying');
      }

      gridArea.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-6', 'grid-multi');

      if (totalParticipants === 1) {
        gridArea.classList.add('grid-1');
      } else if (totalParticipants === 2) {
        gridArea.classList.add('grid-2');
      } else if (totalParticipants === 3) {
        gridArea.classList.add('grid-3');
      } else if (totalParticipants <= 4) {
        gridArea.classList.add('grid-4');
      } else if (totalParticipants <= 6) {
        gridArea.classList.add('grid-6');
      } else {
        gridArea.classList.add('grid-multi');
      }
    }

    // Buat dummy stream jika kamera & mic gagal agar WebRTC tetap bisa menyambung dua arah
    function createFallbackDummyStream() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          const dst = ctx.createMediaStreamDestination();
          gain.connect(dst);
          osc.start();
          return dst.stream;
        }
      } catch (e) {}
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        return canvas.captureStream(1);
      } catch (e2) {}
      return null;
    }

    // Inisialisasi Media Hardware dengan Polyfill & Multi-stage Fallback Kamera
    let initMediaPromise = null;
    async function initMedia() {
      if (localStream && localStream.getAudioTracks().some(function(t) { return t.readyState === 'live'; })) {
        return localStream;
      }
      if (initMediaPromise) {
        return initMediaPromise;
      }
      initMediaPromise = (async function() {
      // Polyfill navigator.mediaDevices untuk lingkungan WebView Android / iOS
      if (typeof navigator !== 'undefined') {
        if (!navigator.mediaDevices) {
          navigator.mediaDevices = {};
        }
        if (!navigator.mediaDevices.getUserMedia) {
          const legacyGUM = navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;
          if (legacyGUM) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
              return new Promise(function(resolve, reject) {
                legacyGUM.call(navigator, constraints, resolve, reject);
              });
            };
          }
        }
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        console.warn('getUserMedia not supported in this WebView');
        localStream = createFallbackDummyStream();
        mediaInitDone = true;
        return;
      }

      // Stage 1: Kamera depan + audio dengan AEC
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: isVoiceOnly ? false : {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        console.log('[WebRTC] Stage 1 getUserMedia sukses');
      } catch (err1) {
        console.warn('[WebRTC] Stage 1 gagal, mencoba stage 2:', err1);
        try {
          // Stage 2: Kamera depan basic
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVoiceOnly ? false : { facingMode: 'user' },
          });
          console.log('[WebRTC] Stage 2 getUserMedia sukses');
        } catch (err2) {
          console.warn('[WebRTC] Stage 2 gagal, mencoba stage 3:', err2);
          try {
            // Stage 3: Kamera umum (true)
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: isVoiceOnly ? false : true,
            });
            console.log('[WebRTC] Stage 3 getUserMedia sukses');
          } catch (err3) {
            console.warn('[WebRTC] Stage 3 gagal, mencoba stage 3b (pisah audio & video):', err3);
            try {
              // Stage 3b: Ambil audio dan video secara terpisah jika driver hardware Android bentrok
              const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              if (!isVoiceOnly) {
                try {
                  const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
                  localStream = new MediaStream([
                    ...aStream.getAudioTracks(),
                    ...vStream.getVideoTracks(),
                  ]);
                  console.log('[WebRTC] Stage 3b (pisah audio & video) sukses');
                } catch (eVid) {
                  console.warn('[WebRTC] Stage 3b video gagal:', eVid);
                  localStream = aStream;
                }
              } else {
                localStream = aStream;
              }
            } catch (err3b) {
              console.warn('[WebRTC] Stage 3b gagal, fallback ke audio-only:', err3b);
              try {
                // Stage 4: Hanya audio jika kamera fisik bermasalah
                localStream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                  video: false,
                });
                console.log('[WebRTC] Stage 4 (audio-only) sukses');
              } catch (err4) {
                console.error('[WebRTC] Semua percobaan mic & kamera gagal:', err4);
                localStream = createFallbackDummyStream();
              }
            }
          }
        }
      }

      // Pastikan localStream benar-benar memiliki audio track mikrofon yang aktif
      if (localStream && localStream.getAudioTracks().length === 0) {
        try {
          const extraAudio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          extraAudio.getAudioTracks().forEach(function(t) {
            localStream.addTrack(t);
          });
        } catch (eAud) {
          console.warn('[WebRTC] Extra audio acquisition gagal:', eAud);
        }
      }

      if (localStream) {
        localStream.getAudioTracks().forEach(function(t) {
          t.enabled = !isMicMuted;
        });
      }

      const vTracks = localStream ? localStream.getVideoTracks() : [];
      const hasVideo = vTracks.length > 0 && vTracks[0].enabled;
      isCamOff = !hasVideo;

      if (localVideo) {
        localVideo.muted = true;
        localVideo.setAttribute('playsinline', '');
        localVideo.setAttribute('webkit-playsinline', '');
        if (localStream) {
          localVideo.srcObject = localStream;
          localVideo.onloadedmetadata = function() {
            localVideo.play().catch(function() {});
          };
          localVideo.play().catch(function(e) { console.warn('localVideo play error:', e); });
        }
      }

      if (localCamOffAvatar) {
        localCamOffAvatar.style.display = hasVideo ? 'none' : 'flex';
      }

      if (isVoiceOnly && btnCam) {
        btnCam.style.display = 'none';
      }

      mediaInitDone = true;

      if (localStream) {
        const aInfo = localStream.getAudioTracks().map(function(t) {
          return t.label + ':' + t.readyState + ':enabled=' + t.enabled + ':muted=' + t.muted;
        }).join(',');
        console.log('[WebRTC] AudioTracks siap:', aInfo);
        setupLocalVoiceDetection(localStream, slotLocal);
        syncLocalTracksToPeerConnections();
      }
      processPendingPeers();
      return localStream;
      })();
      return initMediaPromise;
    }

    // Inisialisasi PeerJS Mesh
    function initPeer() {
      if (typeof Peer === 'undefined') {
        setTimeout(initPeer, 350);
        return;
      }

      try {
        peer = new Peer(myPeerId, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:stun.services.mozilla.com' },
              { urls: 'stun:stun.relay.metered.ca:80' },
              {
                urls: 'turn:standard.relay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
              },
              {
                urls: 'turn:standard.relay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
              },
              {
                urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject',
              },
            ],
          },
        });
      } catch (e) {
        console.error('Peer init error:', e);
        return;
      }

      peer.on('open', (id) => {
        console.log('Peer group siap:', id);
        showToast('Terhubung ke sesi belajar');
        notifyRN({ type: 'PEER_OPEN', id: id });
        processPendingPeers();
      });

      // Menerima koneksi data P2P dari teman satu grup
      peer.on('connection', (conn) => {
        console.log('[WebRTC] DataConnection masuk dari:', conn.peer);
        setupDataConn(conn);
      });

      function answerCallWhenReady(incomingCall) {
        const doAnswer = function() {
          const streamToUse = localStream || createFallbackDummyStream();
          if (localStream) {
            localStream.getAudioTracks().forEach(function(t) { t.enabled = !isMicMuted; });
          }
          try {
            incomingCall.answer(streamToUse);
            setupRemoteCall(incomingCall);
          } catch (e) {
            console.warn('[WebRTC] Answer error:', e);
          }
        };

        if (localStream || mediaInitDone) {
          doAnswer();
          return;
        }
        let checks = 0;
        const checkTimer = setInterval(function() {
          checks++;
          if (localStream || mediaInitDone || checks > 35) {
            clearInterval(checkTimer);
            doAnswer();
          }
        }, 120);
      }

      // Menerima panggilan video/suara masuk dari anggota server lain
      peer.on('call', (incomingCall) => {
        const callerPeerId = incomingCall.peer;
        console.log('Menerima panggilan peer:', callerPeerId);

        const meta = (incomingCall.metadata && typeof incomingCall.metadata === 'object')
          ? incomingCall.metadata
          : (window.__peerMeta[callerPeerId] || {});
        if (meta.name || meta.avatar) {
          window.registerPeerMeta(callerPeerId, meta.name, meta.avatar);
        }
        ensureRemoteCard(callerPeerId, meta.name, meta.avatar);

        // Jika stream dengan peer ini sudah aktif dan kita adalah Primary Caller (myPeerId < callerPeerId),
        // abaikan panggilan duplikat agar tidak memutus stream yang sudah tersambung (seperti webrtcHtml.ts)
        if (activeCalls[callerPeerId] && activeCalls[callerPeerId].stream) {
          const isLive = activeCalls[callerPeerId].stream.getTracks().some(function(t) { return t.readyState === 'live'; });
          if (isLive && myPeerId < callerPeerId) {
            console.log('[WebRTC] Sudah terhubung sebagai Primary Caller, abaikan panggilan duplikat dari:', callerPeerId);
            return;
          }
        }

        // Tie-breaker glare: HANYA peer dengan ID lebih besar (myPeerId > callerPeerId) yang membatalkan outgoing call-nya
        if (myPeerId > callerPeerId && ongoingCalls[callerPeerId] && ongoingCalls[callerPeerId].call !== incomingCall) {
          if (!activeCalls[callerPeerId] || !activeCalls[callerPeerId].stream) {
            try { ongoingCalls[callerPeerId].call.close(); } catch(e) {}
          }
        }

        ongoingCalls[callerPeerId] = {
          call: incomingCall,
          startedAt: Date.now(),
        };

        answerCallWhenReady(incomingCall);
      });

      peer.on('error', (err) => {
        console.warn('Peer error (tolerated):', err?.type, err);
        if (err && err.type === 'peer-unavailable') {
          // Bebaskan ongoingCalls untuk peer yang belum online agar retry berikutnya tidak terkunci 8 detik
          const msg = String(err.message || '');
          const match = msg.match(/peer\\s+([A-Za-z0-9_\\-]+)/i);
          if (match && match[1]) {
            delete ongoingCalls[match[1]];
          }
          return;
        }
        if (err?.type === 'unavailable-id') {
          setTimeout(() => {
            if (peer && !peer.destroyed) {
              try { peer.reconnect(); } catch(e) {}
            }
          }, 1500);
        }
      });
    }

    // Registrasi Nama & Avatar
    window.registerPeerMeta = function(targetPeerId, targetName, targetAvatar) {
      if (!targetPeerId) return;
      const prev = window.__peerMeta[targetPeerId] || {};
      window.__peerMeta[targetPeerId] = {
        name: targetName || prev.name,
        avatar: targetAvatar || prev.avatar,
        camOff: prev.camOff,
        micMuted: prev.micMuted,
      };
      const card = document.getElementById('card_' + targetPeerId);
      if (card) {
        const nameEl = card.querySelector('.card-name');
        if (nameEl && targetName) nameEl.innerText = targetName;
        const imgEl = card.querySelector('.avatar-img-wrap img');
        if (imgEl && targetAvatar) imgEl.src = targetAvatar;
      }
    };

    // Buat kartu remote partisipan BARU saat stream/koneksi aktif diterima
    function ensureRemoteCard(peerId, targetName, targetAvatar) {
      if (!peerId || peerId === myPeerId) return null;
      let card = document.getElementById('card_' + peerId);
      const meta = window.__peerMeta[peerId] || {};
      const displayName = targetName || meta.name || 'Teman Belajar';
      const displayAvatar = targetAvatar || meta.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=cd4f75&color=fff&size=200');

      if (!card) {
        card = document.createElement('div');
        card.className = 'p-card';
        card.id = 'card_' + peerId;
        gridArea.insertBefore(card, slotLocal);

        card.innerHTML = \`
          <div class="card-top">
            <div class="card-badge" id="badge_\${peerId}">🍅 25 : 00</div>
            <div class="card-mic" id="mic_\${peerId}">🎙️</div>
          </div>
          <div class="card-center">
            <video id="video_\${peerId}" class="card-video" autoplay playsinline webkit-playsinline muted></video>
            <div class="cam-off-avatar" id="avatar_\${peerId}" style="display: flex;">
              <div class="avatar-img-wrap">
                <img src="\${displayAvatar}" alt="\${displayName}" />
              </div>
              <div class="audio-waves">
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
              </div>
            </div>
          </div>
          <div class="card-bottom">
            <span class="card-name">\${displayName}</span>
          </div>
        \`;

        updateGridLayout();
      } else {
        const nameEl = card.querySelector('.card-name');
        if (nameEl && displayName) nameEl.innerText = displayName;
        const imgEl = card.querySelector('.avatar-img-wrap img');
        if (imgEl && displayAvatar) imgEl.src = displayAvatar;
      }
      return card;
    }

    // Antrean Panggilan Peer Tanpa Batas Percobaan Selama di Dalam Room
    const pendingPeers = {}; // targetPeerId -> { name, avatar, attempts }
    const peerFirstSeenAt = {}; // targetPeerId -> timestamp

    function callPeerNow(targetPeerId) {
      if (!peer || !peer.open || !targetPeerId || targetPeerId === myPeerId) return;
      // Tunggu sampai initMedia() selesai mengambil mikrofon asli sebelum menelepon peer
      if (!localStream && !mediaInitDone) return;
      const streamToSend = localStream || createFallbackDummyStream();
      if (!streamToSend) return;
      if (localStream) {
        localStream.getAudioTracks().forEach(function(t) { t.enabled = !isMicMuted; });
      }

      // Jika sudah ada stream aktif yang hidup, tidak perlu memanggil ulang
      if (activeCalls[targetPeerId] && activeCalls[targetPeerId].stream) {
        const tracks = activeCalls[targetPeerId].stream.getTracks();
        const isLive = tracks.some(function(t) { return t.readyState === 'live'; });
        if (isLive) return;
      }

      const now = Date.now();
      if (!peerFirstSeenAt[targetPeerId]) {
        peerFirstSeenAt[targetPeerId] = now;
      }

      // Pembagian peran Caller vs Receiver deterministik (persis seperti webrtcHtml.ts):
      // Peer dengan ID lebih kecil (myPeerId < targetPeerId) langsung menelepon (0ms).
      // Peer dengan ID lebih besar menunggu 2.2 detik agar tidak terjadi tabrakan panggilan (glare).
      if (myPeerId > targetPeerId && (now - peerFirstSeenAt[targetPeerId] < 2200)) {
        return;
      }

      if (ongoingCalls[targetPeerId] && (now - ongoingCalls[targetPeerId].startedAt < 4500)) {
        return;
      }

      const meta = window.__peerMeta[targetPeerId] || {};
      try {
        const outgoingCall = peer.call(targetPeerId, streamToSend, {
          metadata: {
            name: myName,
            avatar: myAvatar,
            camOff: isCamOff,
            micMuted: isMicMuted,
          },
        });
        if (outgoingCall) {
          ongoingCalls[targetPeerId] = {
            call: outgoingCall,
            startedAt: now,
          };
          setupRemoteCall(outgoingCall, meta.name, meta.avatar);
        }
      } catch (e) {
        console.warn('[WebRTC] peer.call error:', e);
      }
    }

    function connectDataToPeer(targetPeerId) {
      if (!peer || !peer.open || !targetPeerId || targetPeerId === myPeerId) return;
      if (dataConns[targetPeerId] && dataConns[targetPeerId].open) return;
      try {
        const conn = peer.connect(targetPeerId, {
          metadata: {
            name: myName,
            avatar: myAvatar,
            camOff: isCamOff,
            micMuted: isMicMuted,
            timeLeft: pomoSeconds,
            isRunning: pomoRunning,
          },
          reliable: true,
        });
        if (conn) {
          setupDataConn(conn);
        }
      } catch (e) {}
    }

    function processPendingPeers() {
      if (!peer || !peer.open) return;

      // Gabungkan peer dari Presence/Broadcast (pendingPeers) + seluruh member grup (backgroundProbePeers)
      const allTargetIds = new Set([
        ...Object.keys(pendingPeers),
        ...Object.keys(backgroundProbePeers),
      ]);

      allTargetIds.forEach(function(targetPeerId) {
        if (!targetPeerId || targetPeerId === myPeerId) return;

        // Jika sudah tersambung dan stream aktif, pastikan DataConnection tetap terhubung
        if (activeCalls[targetPeerId] && activeCalls[targetPeerId].stream) {
          const tracks = activeCalls[targetPeerId].stream.getTracks();
          const isLive = tracks.some(function(t) { return t.readyState === 'live'; });
          if (isLive) {
            delete ongoingCalls[targetPeerId];
            return;
          }
        }

        // Hubungkan DataConnection P2P agar lawan tahu kita online & langsung menampilkan kartu kita
        connectDataToPeer(targetPeerId);

        // Lakukan panggilan media
        callPeerNow(targetPeerId);
      });
    }

    setInterval(processPendingPeers, 2500);

    // Hubungi Peer Lain & Tampilkan Kartunya di Grid
    window.connectToPeer = function(targetPeerId, targetName, targetAvatar) {
      if (!targetPeerId || targetPeerId === myPeerId) return;

      if (targetName || targetAvatar) {
        window.registerPeerMeta(targetPeerId, targetName, targetAvatar);
      }

      // Kartu remote TIDAK dibuat di sini; hanya muncul setelah peer benar-benar terhubung

      pendingPeers[targetPeerId] = {
        name: targetName,
        avatar: targetAvatar,
      };

      connectDataToPeer(targetPeerId);
      callPeerNow(targetPeerId);
    };

    // Daftarkan seluruh anggota grup server agar WebRTC langsung mem-probe koneksi P2P
    // meskipun Supabase Presence terlambat atau terputus
    window.syncServerMembers = function(members) {
      if (!members) return;
      if (typeof members === 'string') {
        try { members = JSON.parse(members); } catch(e) { return; }
      }
      if (!Array.isArray(members)) return;

      members.forEach(function(m) {
        if (!m || !m.peerId || m.peerId === myPeerId) return;
        window.registerPeerMeta(m.peerId, m.name, m.avatar);
        backgroundProbePeers[m.peerId] = {
          name: m.name,
          avatar: m.avatar,
        };
      });

      processPendingPeers();
    };

    // Putus Peer & Kembalikan ke Empty Slot
    window.disconnectPeer = function(targetPeerId) {
      delete ongoingCalls[targetPeerId];
      delete pendingPeers[targetPeerId];

      if (dataConns[targetPeerId]) {
        try { dataConns[targetPeerId].close(); } catch(e) {}
        delete dataConns[targetPeerId];
      }

      if (activeCalls[targetPeerId]) {
        try { activeCalls[targetPeerId].call.close(); } catch(e) {}
        delete activeCalls[targetPeerId];
      }

      releaseAudioElement(targetPeerId);
      const audioEl = document.getElementById('audio_' + targetPeerId);
      if (audioEl) audioEl.remove();

      const card = document.getElementById('card_' + targetPeerId);
      if (card) {
        card.remove();
      }
      updateGridLayout();
    };

    // Sinkronisasi Seluruh Partisipan Presence (Semua teman langsung muncul di 1 frame yang sama)
    window.syncPresencePeers = function(peers) {
      if (!peers) return;
      if (typeof peers === 'string') {
        try { peers = JSON.parse(peers); } catch(e) { return; }
      }
      if (!Array.isArray(peers)) return;

      const activePeerIds = new Set();
      peers.forEach(function(item) {
        if (!item) return;
        const targetPeerId = item.peerId || item.targetPeerId;
        if (!targetPeerId || targetPeerId === myPeerId) return;
        activePeerIds.add(targetPeerId);

        const name = item.name || item.targetName || 'Teman Belajar';
        const avatar = item.avatar || item.targetAvatar || '';

        // Simpan metadata saja. Kartu partisipan BARU muncul setelah peer benar-benar terhubung
        // (stream/data masuk), sehingga anggota yang belum join tidak tampil di frame.
        window.registerPeerMeta(targetPeerId, name, avatar);
        const card = document.getElementById('card_' + targetPeerId);

        // Perbarui timer Pomodoro jika ada data
        if (card && item.timeLeft !== undefined) {
          const badge = document.getElementById('badge_' + targetPeerId);
          if (badge) {
            const m = String(Math.floor(item.timeLeft / 60)).padStart(2, '0');
            const s = String(item.timeLeft % 60).padStart(2, '0');
            badge.innerText = '🍅 ' + m + ' : ' + s;
          }
        }

        // Lakukan koneksi WebRTC
        window.connectToPeer(targetPeerId, name, avatar);
      });

      // Lepas kartu partisipan yang sudah tidak lagi berada di ruang presence
      const remoteCards = document.querySelectorAll('.p-card:not(#slot_local)');
      remoteCards.forEach(function(cardEl) {
        const pId = cardEl.id.replace('card_', '');
        if (pId && !activePeerIds.has(pId)) {
          window.disconnectPeer(pId);
        }
      });

      updateGridLayout();
    };

    // Setup Call Remote & Pasang Video
    function setupRemoteCall(call, targetName, targetAvatar) {
      const peerId = call.peer;
      const meta = window.__peerMeta[peerId] || {};
      const displayName = targetName || meta.name || 'Teman Belajar';
      const displayAvatar = targetAvatar || meta.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=cd4f75&color=fff&size=200');

      const card = document.getElementById('card_' + peerId);

      call.on('stream', (remoteStream) => {
        console.log('Stream diterima dari:', peerId, 'tracks:', remoteStream ? remoteStream.getTracks().length : 0);

        delete ongoingCalls[peerId];

        const currentCard = document.getElementById('card_' + peerId) || ensureRemoteCard(peerId, displayName, displayAvatar) || card;
        const remoteVid = document.getElementById('video_' + peerId);
        const avWrap = document.getElementById('avatar_' + peerId);

        // Pastikan seluruh audio track dari remoteStream dalam keadaan enabled
        if (remoteStream && remoteStream.getAudioTracks) {
          remoteStream.getAudioTracks().forEach(function(t) {
            t.enabled = true;
          });
        }

        // Gunakan elemen <audio> yang sudah dideklarasikan di HTML awal (#remoteAudioPool)
        // persis seperti webrtcHtml.ts agar Android WebView tidak memblokir pemutaran suara.
        // PENTING: Jangan menimpa srcObject ulang jika stream yang sama memicu event 'stream' untuk track ke-2!
        const remoteAud = getOrAssignAudioElement(peerId);
        if (remoteAud) {
          remoteAud.muted = false;
          remoteAud.volume = 1.0;
          if (remoteAud.srcObject !== remoteStream) {
            remoteAud.srcObject = remoteStream;
          }
          if (remoteAud.paused) {
            const playPromise = remoteAud.play();
            if (playPromise !== undefined) {
              playPromise.then(function() {
                console.log('[WebRTC] remoteAudio berhasil diputar untuk:', peerId);
              }).catch(function(err) {
                console.warn('remoteAudio play error, fallback ke remoteVideo audio:', err && err.message ? err.message : err);
                if (remoteVid) {
                  remoteVid.muted = false;
                  remoteVid.volume = 1.0;
                  if (remoteVid.paused) remoteVid.play().catch(function() {});
                }
              });
            }
          }
          remoteAud.onplaying = function() {
            if (remoteVid) {
              remoteVid.muted = true;
            }
          };
        }

        // Cek video track & tampilkan video secara langsung tanpa display:none yang menghentikan decoder WebView
        const vTracks = remoteStream ? remoteStream.getVideoTracks() : [];
        const peerMeta = window.__peerMeta[peerId] || {};
        const hasVideoTrack = vTracks.length > 0 && !peerMeta.camOff;

        function playAndRevealVideo() {
          if (remoteVid) {
            remoteVid.style.display = 'block';
            if (remoteVid.paused) {
              remoteVid.play().catch(function(e) {
                console.warn('remoteVid play error:', e && e.message ? e.message : e);
              });
            }
          }
          const currentMeta = window.__peerMeta[peerId] || {};
          if (avWrap && vTracks.length > 0 && !currentMeta.camOff) {
            avWrap.style.display = 'none';
          }
        }

        if (remoteVid) {
          remoteVid.setAttribute('playsinline', '');
          remoteVid.setAttribute('webkit-playsinline', '');
          remoteVid.style.display = 'block';
          if (remoteVid.srcObject !== remoteStream) {
            remoteVid.muted = true;
            remoteVid.srcObject = remoteStream;
            remoteVid.onloadedmetadata = playAndRevealVideo;
            remoteVid.onloadeddata = playAndRevealVideo;
            remoteVid.oncanplay = playAndRevealVideo;
          }
        }

        if (hasVideoTrack) {
          playAndRevealVideo();
        } else if (avWrap) {
          avWrap.style.display = 'flex';
        }

        activeCalls[peerId] = {
          call: call,
          name: displayName,
          avatar: displayAvatar,
          stream: remoteStream,
          audioEl: remoteAud,
          cardEl: currentCard,
        };

        syncLocalTracksToPeerConnections();
        updateGridLayout();
        window.unlockAudio();
        notifyRN({ type: 'CONNECTED', peerId: peerId });
      });

      call.on('close', () => {
        console.log('[WebRTC] Call close:', peerId);
        window.disconnectPeer(peerId);
      });

      call.on('error', (e) => {
        console.warn('Call error:', peerId, e);
        if (ongoingCalls[peerId] && ongoingCalls[peerId].call === call) {
          delete ongoingCalls[peerId];
        }
      });
    }

    // Kontrol Mikrofon
    function toggleMic() {
      if (!localStream) return;
      isMicMuted = !isMicMuted;
      localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
      syncLocalTracksToPeerConnections();
      if (isMicMuted) {
        isLocalSpeaking = false;
        if (slotLocal) slotLocal.classList.remove('speaking');
      }

      if (isMicMuted) {
        btnMic.classList.add('muted');
        iconMic.innerText = '🔇';
        labelMic.innerText = 'Unmute';
        if (localMicBadge) {
          localMicBadge.innerText = '🔇';
          localMicBadge.classList.add('muted');
        }
      } else {
        btnMic.classList.remove('muted');
        iconMic.innerText = '🎙️';
        labelMic.innerText = 'Mute';
        if (localMicBadge) {
          localMicBadge.innerText = '🎙️';
          localMicBadge.classList.remove('muted');
        }
      }
      broadcastMyPeerState();
      notifyRN({ type: 'MIC_TOGGLED', muted: isMicMuted });
    }

    // Kontrol Kamera
    function toggleCam() {
      if (!localStream || isVoiceOnly) return;
      isCamOff = !isCamOff;
      localStream.getVideoTracks().forEach(t => { t.enabled = !isCamOff; });

      if (isCamOff) {
        btnCam.classList.add('muted');
        iconCam.innerText = '🚫';
        labelCam.innerText = 'Cam On';
        if (localCamOffAvatar) localCamOffAvatar.style.display = 'flex';
      } else {
        btnCam.classList.remove('muted');
        iconCam.innerText = '📹';
        labelCam.innerText = 'Cam Off';
        if (localVideo) {
          localVideo.style.display = 'block';
          localVideo.play().catch(function() {});
        }
        if (localCamOffAvatar) localCamOffAvatar.style.display = 'none';
      }
      broadcastMyPeerState();
      notifyRN({ type: 'CAM_TOGGLED', camOff: isCamOff });
    }

    // Pomodoro Controls
    function togglePomodoro() {
      pomoRunning = !pomoRunning;
      console.log('[POMO_TOGGLE] New state pomoRunning =', pomoRunning, 'pomoSeconds =', pomoSeconds);
      if (pomoRunning) {
        pomoBtn.innerText = 'Pause';
        pomoBtn.classList.add('active');
        if (pomoInterval) clearInterval(pomoInterval);
        pomoInterval = setInterval(() => {
          if (pomoSeconds > 0) {
            pomoSeconds--;
            updatePomoDisplay();
            console.log('[POMO_TICK] Second:', pomoSeconds, 'time:', pomoTime ? pomoTime.innerText : '');
            if (pomoSeconds % 5 === 0) broadcastMyPeerState();
          } else {
            clearInterval(pomoInterval);
            pomoRunning = false;
            pomoBtn.innerText = 'Start';
            pomoBtn.classList.remove('active');
            broadcastMyPeerState();
            notifyRN({ type: 'POMO_COMPLETE' });
          }
        }, 1000);
      } else {
        pomoBtn.innerText = 'Start';
        pomoBtn.classList.remove('active');
        if (pomoInterval) clearInterval(pomoInterval);
      }
      broadcastMyPeerState();
      notifyRN({ type: 'POMO_STATE', isRunning: pomoRunning, timeLeft: pomoSeconds });
    }
    window.togglePomodoro = togglePomodoro;

    function resetPomodoro() {
      pomoRunning = false;
      if (pomoInterval) clearInterval(pomoInterval);
      pomoSeconds = (pomoMode === 'study' ? 25 : pomoMode === 'short_break' ? 5 : 15) * 60;
      pomoBtn.innerText = 'Start';
      pomoBtn.classList.remove('active');
      updatePomoDisplay();
      broadcastMyPeerState();
      notifyRN({ type: 'POMO_STATE', isRunning: false, timeLeft: pomoSeconds });
    }

    function updatePomoDisplay() {
      const m = Math.floor(pomoSeconds / 60);
      const s = pomoSeconds % 60;
      const str = String(m).padStart(2, '0') + ' : ' + String(s).padStart(2, '0');
      if (pomoTime) pomoTime.innerText = str;
      if (localTimerBadge) {
        localTimerBadge.innerText = (pomoRunning ? '🍅 ' : '⏸️ ') + str;
      }
    }

    window.setPomodoroMode = function(mode, seconds) {
      pomoMode = mode;
      pomoSeconds = seconds || (mode === 'study' ? 25 : mode === 'short_break' ? 5 : 15) * 60;
      pomoRunning = false;
      if (pomoInterval) clearInterval(pomoInterval);
      pomoBtn.innerText = 'Start';
      pomoBtn.classList.remove('active');
      updatePomoDisplay();
      broadcastMyPeerState();

      const cap = document.getElementById('capsuleBadge');
      if (cap) {
        if (mode === 'study') {
          cap.innerHTML = '<span class="capsule-orange">Study </span><span class="capsule-green">Session</span>';
        } else if (mode === 'short_break') {
          cap.innerHTML = '<span class="capsule-green">Short </span><span class="capsule-orange">Break</span>';
        } else {
          cap.innerHTML = '<span class="capsule-green">Long </span><span class="capsule-orange">Break</span>';
        }
      }
    };

    function leaveRoom() {
      if (pomoInterval) clearInterval(pomoInterval);
      Object.keys(dataConns).forEach(function(pid) {
        const dc = dataConns[pid];
        if (dc && dc.open) {
          try { dc.send({ type: 'PEER_LEAVE', peerId: myPeerId }); } catch(e) {}
        }
        try { dc.close(); } catch(e) {}
      });
      if (localStream) {
        try { localStream.getTracks().forEach(t => t.stop()); } catch(e) {}
      }
      Object.keys(activeCalls).forEach(function(pid) {
        try { activeCalls[pid].call.close(); } catch(e) {}
      });
      if (peer) {
        try { peer.destroy(); } catch(e) {}
      }
      notifyRN({ type: 'LEAVE_MEET' });
    }

    // Mulai saat DOM siap (pastikan HANYA dijalankan 1 kali agar getUserMedia & Peer tidak bentrok!)
    let engineStarted = false;
    async function startEngine() {
      if (engineStarted) return;
      engineStarted = true;
      await initMedia();
      initPeer();
      updateGridLayout();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(startEngine, 30);
    } else {
      window.addEventListener('DOMContentLoaded', startEngine);
      window.addEventListener('load', startEngine);
    }
  </script>
</body>
</html>`;
}
