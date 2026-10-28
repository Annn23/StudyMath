/**
 * Self-contained WebRTC HTML generator for StudyMath Calls (Voice & Video)
 * Powered by WebRTC & PeerJS with direct P2P connections and TURN/STUN fallback.
 * Includes dedicated <audio> stream element, Web Audio API unlocking, and mic activity detection.
 */

export interface WebRtcParams {
  room: string;
  type: 'video' | 'voice';
  role: 'caller' | 'receiver' | 'joiner';
  myName: string;
  partnerName: string;
  partnerAvatar?: string;
}

export function getWebRtcHtml({
  room,
  type,
  role,
  myName,
  partnerName,
  partnerAvatar,
}: WebRtcParams): string {
  const isVideo = type === 'video';
  const cleanRoom = room.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  const avatarUrl =
    partnerAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      partnerName
    )}&background=cd4f75&color=fff&size=300`;

  const isCaller = role === 'caller';
  const myPeerId = `sm_${cleanRoom}_${isCaller ? 'c' : 'r'}`;
  const targetPeerId = `sm_${cleanRoom}_${isCaller ? 'r' : 'c'}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: gap: https://ssl.gstatic.com;" />
  <title>StudyMath Call</title>
  <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100%; height: 100%; overflow: hidden;
      background: #0d0714;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #fff;
      user-select: none;
      -webkit-user-select: none;
    }
    #container {
      position: relative; width: 100%; height: 100%;
      display: flex; flex-direction: column; justify-content: space-between;
      align-items: center;
      background: radial-gradient(circle at center, #2d1222 0%, #0d0714 100%);
    }

    /* Video Utama (Partner) */
    #remoteVideoWrap {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #000;
      display: ${isVideo ? 'flex' : 'none'};
      align-items: center; justify-content: center;
      overflow: hidden; z-index: 1;
    }
    #remoteVideo {
      width: 100%; height: 100%; object-fit: cover;
    }

    /* Voice Call Center Avatar View */
    #voiceCenterView {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: ${isVideo ? 'none' : 'flex'};
      flex-direction: column; align-items: center; justify-content: center;
      z-index: 2; pointer-events: none;
    }
    .avatar-glow-ring {
      width: 140px; height: 140px; border-radius: 50%;
      border: 4px solid #cd4f75;
      box-shadow: 0 0 35px rgba(205, 79, 117, 0.65);
      overflow: hidden; margin-bottom: 20px;
      animation: pulseAvatar 2.2s infinite ease-in-out;
    }
    .avatar-glow-ring img { width: 100%; height: 100%; object-fit: cover; }
    @keyframes pulseAvatar {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(205, 79, 117, 0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 45px rgba(205, 79, 117, 0.85); }
      100% { transform: scale(1); box-shadow: 0 0 20px rgba(205, 79, 117, 0.4); }
    }

    /* Soundwaves animasi saat suara aktif */
    .sound-waves {
      display: flex; gap: 6px; align-items: center; height: 32px; margin-top: 14px;
    }
    .wave-bar {
      width: 5px; height: 12px; background: #ff758c; border-radius: 4px;
      opacity: 0.6;
      animation: waveBounce 1.2s infinite ease-in-out;
      transition: opacity 0.2s;
    }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 24px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 32px; }
    .wave-bar:nth-child(4) { animation-delay: 0.15s; height: 20px; }
    .wave-bar:nth-child(5) { animation-delay: 0.3s; height: 14px; }
    @keyframes waveBounce {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1.35); }
    }

    /* Mic Status Indicator */
    #micStatusText {
      font-size: 12px; color: #4ade80; margin-top: 10px; font-weight: 600;
    }

    /* Video Sendiri (PIP Floating) */
    #localVideoWrap {
      position: absolute; top: 60px; right: 16px; width: 105px; height: 150px;
      border-radius: 16px; overflow: hidden;
      border: 2px solid rgba(255,255,255,0.45);
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      background: #180b20; z-index: 10;
      display: ${isVideo ? 'block' : 'none'};
      transition: all 0.3s ease;
    }
    #localVideo {
      width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
    }

    /* Placeholder saat partner belum tersambung */
    #waitingOverlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(13, 7, 20, 0.75); backdrop-filter: blur(8px);
      z-index: 5; transition: opacity 0.4s ease;
    }
    #waitingOverlay.hidden {
      opacity: 0; pointer-events: none;
    }
    .spinner {
      width: 44px; height: 44px; border-radius: 50%;
      border: 3px solid rgba(255, 117, 140, 0.2);
      border-top-color: #ff758c;
      animation: spin 1s infinite linear;
      margin-bottom: 16px;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Top Bar */
    #topBar {
      position: relative; z-index: 20; width: 100%;
      padding: 48px 20px 14px;
      display: flex; flex-direction: column; align-items: center;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      pointer-events: none;
    }
    #partnerTitle { font-size: 21px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.9); }
    #callTimer { font-size: 13px; color: rgba(255,255,255,0.9); margin-top: 4px; font-weight: 600; letter-spacing: 0.5px; }
    #statusBadge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
      padding: 4px 14px; border-radius: 20px; font-size: 11px;
      margin-top: 6px; color: #fde047; border: 1px solid rgba(255,255,255,0.18);
      font-weight: 600;
    }
    #statusBadge.connected { color: #4ade80; border-color: rgba(74, 222, 128, 0.4); }

    /* Bottom Control Bar */
    #controlBar {
      position: relative; z-index: 20; width: 100%;
      padding: 20px 24px 38px;
      display: flex; justify-content: center; align-items: center; gap: 18px;
      background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%);
    }
    .btn {
      width: 56px; height: 56px; border-radius: 50%;
      border: none; outline: none; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-size: 22px; color: #fff;
      background: rgba(255,255,255,0.22); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.2);
      transition: all 0.2s; -webkit-tap-highlight-color: transparent;
    }
    .btn:active { transform: scale(0.9); }
    .btn.active-off { background: #e11d48; border-color: #f43f5e; }
    .btn.hangup {
      width: 68px; height: 68px; background: #ef4444; font-size: 30px;
      box-shadow: 0 6px 25px rgba(239,68,68,0.65);
      border: none;
    }
  </style>
</head>
<body>
  <div id="container">
    <!-- Dedicated Remote Audio Element: selalu aktif memutar suara tanpa bergantung pada rendering video -->
    <audio id="remoteAudio" autoplay playsinline></audio>

    <!-- Remote Video Element (Muted agar tidak duplikasi/echo dengan remoteAudio) -->
    <div id="remoteVideoWrap">
      <video id="remoteVideo" autoplay playsinline muted></video>
    </div>

    <!-- Voice Call Center Avatar -->
    <div id="voiceCenterView">
      <div class="avatar-glow-ring">
        <img src="${avatarUrl}" alt="${partnerName}" />
      </div>
      <div style="font-size: 20px; font-weight: 700;">${partnerName}</div>
      <div id="micStatusText">🎤 Menyiapkan Mikrofon...</div>
      <div class="sound-waves">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>
    </div>

    <!-- Local Floating PIP Video -->
    <div id="localVideoWrap">
      <video id="localVideo" autoplay playsinline muted></video>
    </div>

    <!-- Waiting Overlay -->
    <div id="waitingOverlay">
      <div class="spinner"></div>
      <div style="font-size: 15px; font-weight: 600; color: #fff;">Menghubungkan ke ${partnerName}…</div>
      <div id="waitingSubText" style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 6px;">Menyiapkan mikrofon & WebRTC P2P...</div>
    </div>

    <!-- Top Bar -->
    <div id="topBar">
      <div id="partnerTitle">${partnerName}</div>
      <div id="callTimer">00:00</div>
      <div id="statusBadge">🟡 Menyambungkan…</div>
    </div>

    <!-- Bottom Control Bar -->
    <div id="controlBar">
      <!-- Mute Mic -->
      <button class="btn" id="btnMic" onclick="toggleMic()">
        <span id="iconMic">🎤</span>
      </button>

      <!-- Video On/Off & Flip Camera (Only for video calls) -->
      ${
        isVideo
          ? `<button class="btn" id="btnCam" onclick="toggleCam()">
              <span id="iconCam">📹</span>
            </button>
            <button class="btn" id="btnFlip" onclick="toggleFlipCamera()">
              <span>🔄</span>
            </button>`
          : ''
      }

      <!-- Hang Up Button -->
      <button class="btn hangup" id="btnHangup" onclick="hangUp()">
        <span>✕</span>
      </button>
    </div>
  </div>

  <script>
    const isVideoCall = ${isVideo};
    const isCaller = ${isCaller};
    const myId = "${myPeerId}";
    const targetId = "${targetPeerId}";
    
    let localStream = null;
    let peer = null;
    let currentCall = null;
    let isConnected = false;
    let seconds = 0;
    let timerInterval = null;
    let callRetryInterval = null;
    let micMuted = false;
    let camOff = false;
    let facingMode = 'user';
    let audioContext = null;

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const remoteAudio = document.getElementById('remoteAudio');
    const statusBadge = document.getElementById('statusBadge');
    const callTimer = document.getElementById('callTimer');
    const waitingOverlay = document.getElementById('waitingOverlay');
    const btnMic = document.getElementById('btnMic');
    const iconMic = document.getElementById('iconMic');
    const btnCam = document.getElementById('btnCam');
    const iconCam = document.getElementById('iconCam');
    const micStatusText = document.getElementById('micStatusText');
    const waitingSubText = document.getElementById('waitingSubText');

    function notifyRN(data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    window.onerror = function(message, source, lineno, colno, error) {
      console.warn('WebRTC WebView Error:', message, lineno);
      return false;
    };

    // Audio unlocker untuk mengatasi browser autoplay policy
    function unlockAudio() {
      try {
        if (!audioContext) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) audioContext = new AudioCtx();
        }
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume();
        }
      } catch (e) {
        console.warn('AudioContext resume error:', e);
      }

      if (remoteAudio && remoteAudio.srcObject) {
        try {
          const p = remoteAudio.play();
          if (p !== undefined) {
            p.catch(function(e) {
              console.warn('remoteAudio play catch:', e);
            });
          }
        } catch(e) {}
      }
      if (remoteVideo && remoteVideo.srcObject) {
        try {
          const p = remoteVideo.play();
          if (p !== undefined) {
            p.catch(function(e) {
              console.warn('remoteVideo play catch:', e);
            });
          }
        } catch(e) {}
      }
    }

    // Buka audio lock saat user menyentuh layar
    document.addEventListener('touchstart', unlockAudio, { passive: true });
    document.addEventListener('click', unlockAudio);

    async function initMedia() {
      if (waitingSubText) {
        waitingSubText.innerText = 'Memeriksa akses mikrofon...';
      }

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
        notifyRN({ type: 'ERROR', message: 'Fitur mikrofon WebRTC tidak didukung oleh versi WebView ini.' });
        return;
      }

      // Percobaan 1: Constraints audio standar dengan AEC, NS, AGC
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: isVideoCall ? {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          } : false,
        });
        console.log('getUserMedia attempt 1 sukses');
      } catch (err1) {
        console.warn('getUserMedia attempt 1 gagal, mencoba fallback 2:', err1);
        try {
          // Percobaan 2: Audio basic boolean
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideoCall ? { facingMode: 'user' } : false,
          });
          console.log('getUserMedia attempt 2 sukses');
        } catch (err2) {
          console.warn('getUserMedia attempt 2 gagal, mencoba fallback 3 audio-only:', err2);
          try {
            // Percobaan 3: Audio murni tanpa video
            localStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            console.log('getUserMedia attempt 3 sukses');
          } catch (err3) {
            console.error('Semua percobaan mic gagal:', err3);
            const errMsg = err3 ? (err3.name || err3.message || String(err3)) : 'Izin ditolak';
            notifyRN({ type: 'ERROR', message: 'Tidak dapat mengakses mikrofon (' + errMsg + '). Pastikan izin telah diberikan di pengaturan HP.' });
            
            // Dummy silent stream agar WebRTC tetap bisa berjalan mendengarkan lawan
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const dst = ctx.createMediaStreamDestination();
                osc.connect(dst);
                localStream = dst.stream;
              }
            } catch (eDummy) {
              const canvas = document.createElement('canvas');
              canvas.width = 10; canvas.height = 10;
              localStream = canvas.captureStream(1);
            }
          }
        }
      }

      if (localVideo && localStream && isVideoCall) {
        localVideo.srcObject = localStream;
        localVideo.play().catch(function() {});
      }

      const audioTracks = localStream ? localStream.getAudioTracks() : [];
      console.log('Audio tracks tersedia:', audioTracks.length);
      if (audioTracks.length === 0 && micStatusText) {
        micStatusText.innerText = '⚠️ Mikrofon Tidak Terdeteksi';
        micStatusText.style.color = '#f87171';
        if (waitingSubText) {
          waitingSubText.innerText = 'Mikrofon tidak aktif, menunggu sambungan...';
        }
      } else {
        if (micStatusText) {
          micStatusText.innerText = '🎤 Mikrofon Siap';
          micStatusText.style.color = '#34d399';
        }
        if (waitingSubText) {
          waitingSubText.innerText = 'Mikrofon siap! Menghubungkan ke teman belajar...';
        }
      }

      // Deteksi aktivitas suara mikrofon lokal (animasi gelombang bergerak saat ada suara)
      setupLocalVoiceDetection(localStream);
    }

    function setupLocalVoiceDetection(stream) {
      try {
        if (!stream || stream.getAudioTracks().length === 0) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(function() {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function checkVoice() {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const waves = document.querySelectorAll('.wave-bar');
          if (avg > 14 && !micMuted) {
            waves.forEach(function(w) { w.style.opacity = '1'; });
          } else {
            waves.forEach(function(w) { w.style.opacity = '0.4'; });
          }
          requestAnimationFrame(checkVoice);
        }
        checkVoice();
      } catch (e) {
        console.warn('setupLocalVoiceDetection error:', e);
      }
    }

    let peerInitAttempts = 0;
    function initPeer() {
      // Pastikan library PeerJS sudah dimuat dari script CDN
      if (typeof Peer === 'undefined') {
        peerInitAttempts++;
        if (peerInitAttempts < 30) {
          console.warn('PeerJS library belum siap, mencoba lagi dalam 300ms (attempt ' + peerInitAttempts + ')...');
          setTimeout(initPeer, 300);
          return;
        } else {
          console.error('PeerJS gagal dimuat setelah 30 percobaan');
          notifyRN({ type: 'ERROR', message: 'Gagal memuat modul koneksi panggilan. Periksa koneksi internet.' });
          return;
        }
      }

      try {
        peer = new Peer(myId, {
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
      } catch (err) {
        console.error('new Peer() error:', err);
        return;
      }

      peer.on('open', (id) => {
        console.log('PeerJS ID siap:', id);
        notifyRN({ type: 'PEER_OPEN', id });
        if (waitingSubText) {
          waitingSubText.innerText = 'Menyambungkan audio dengan ' + "${partnerName}" + '...';
        }

        // Caller langsung mencoba memanggil target dan retry setiap 2.5 detik sampai terhubung
        if (isCaller) {
          callTarget();
          if (!callRetryInterval) {
            callRetryInterval = setInterval(() => {
              if (!isConnected) {
                callTarget();
              } else {
                clearInterval(callRetryInterval);
                callRetryInterval = null;
              }
            }, 2500);
          }
        } else {
          // Receiver: standby menunggu panggilan dari caller.
          // Sebagai backup, jika setelah 5 detik caller belum terhubung, receiver juga mencoba memanggil.
          setTimeout(() => {
            if (!isConnected && !callRetryInterval) {
              callTarget();
              callRetryInterval = setInterval(() => {
                if (!isConnected) {
                  callTarget();
                } else {
                  clearInterval(callRetryInterval);
                  callRetryInterval = null;
                }
              }, 3000);
            }
          }, 5000);
        }
      });

      // Menerima panggilan dari lawan
      peer.on('call', (incomingCall) => {
        console.log('Menerima panggilan masuk dari:', incomingCall.peer);
        if (isConnected) {
          console.log('Sudah terhubung, abaikan panggilan duplikat');
          return;
        }

        const answerCall = (stream) => {
          try {
            incomingCall.answer(stream);
            setupCallListeners(incomingCall);
          } catch (e) {
            console.warn('incomingCall.answer catch:', e);
          }
        };

        if (localStream) {
          answerCall(localStream);
        } else {
          let waitAttempts = 0;
          const waitStream = setInterval(() => {
            waitAttempts++;
            if (localStream || waitAttempts > 10) {
              clearInterval(waitStream);
              answerCall(localStream);
            }
          }, 300);
        }
      });

      peer.on('error', (err) => {
        console.warn('Peer error event:', err ? err.type : '', err);
        // Error 'peer-unavailable' sangat wajar bila lawan belum membuka aplikasi atau sedang memuat
        if (err && err.type === 'peer-unavailable') {
          console.log('Lawan belum online di server PeerJS, terus mencoba menyambungkan...');
          return;
        }
        if (err && err.type === 'unavailable-id') {
          console.warn('ID peer sementara sibuk, mencoba menyambung ulang...');
          setTimeout(() => {
            if (peer && !peer.destroyed && !isConnected) {
              try { peer.reconnect(); } catch(e) {}
            }
          }, 1500);
          return;
        }
      });
    }

    function callTarget() {
      if (!peer || peer.destroyed || isConnected || !localStream) return;
      console.log('Mencoba memanggil target:', targetId);
      try {
        const outgoingCall = peer.call(targetId, localStream);
        if (outgoingCall) {
          setupCallListeners(outgoingCall);
        }
      } catch (err) {
        console.warn('peer.call catch:', err);
      }
    }

    function setupCallListeners(activeCall) {
      currentCall = activeCall;

      activeCall.on('stream', (remoteStream) => {
        console.log('Remote stream diterima! Audio tracks:', remoteStream ? remoteStream.getAudioTracks().length : 0);
        if (!isConnected) {
          isConnected = true;
          if (callRetryInterval) {
            clearInterval(callRetryInterval);
            callRetryInterval = null;
          }
          onCallConnected(remoteStream);
        }
      });

      activeCall.on('close', () => {
        console.log('activeCall close event. isConnected =', isConnected);
        // PENTING: Hanya hang up dan keluar jika panggilan SUDAH PERNAH TERHUBUNG!
        // Jangan pernah hang up saat masih dalam proses menghubungkan / retry!
        if (isConnected) {
          hangUp();
        }
      });

      activeCall.on('error', (e) => {
        console.warn('activeCall error event (tolerated):', e);
      });
    }

    function onCallConnected(remoteStream) {
      console.log('Panggilan berhasil terhubung!');

      // Putar remote audio di elemen <audio> khusus
      if (remoteAudio && remoteStream) {
        remoteAudio.srcObject = remoteStream;
        remoteAudio.volume = 1.0;
        try {
          const p = remoteAudio.play();
          if (p !== undefined) {
            p.then(function() {
              console.log('remoteAudio berhasil diputar');
            }).catch(function(err) {
              console.warn('remoteAudio play catch:', err);
            });
          }
        } catch(e) {}
      }

      // Putar video jika video call
      if (remoteVideo && remoteStream && isVideoCall) {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch(function(err) {
          console.warn('remoteVideo play catch:', err);
        });
      }

      unlockAudio();

      if (waitingOverlay) waitingOverlay.classList.add('hidden');
      if (statusBadge) {
        statusBadge.innerText = '🟢 Terhubung';
        statusBadge.classList.add('connected');
      }
      if (micStatusText) {
        micStatusText.innerText = '🔊 Suara Terhubung';
        micStatusText.style.color = '#34d399';
      }

      // Mulai timer durasi panggilan
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          seconds++;
          const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
          const secs = String(seconds % 60).padStart(2, '0');
          if (callTimer) callTimer.innerText = mins + ':' + secs;
        }, 1000);
      }

      notifyRN({ type: 'CONNECTED' });
    }

    function toggleMic() {
      if (!localStream) return;
      micMuted = !micMuted;
      localStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
      if (micMuted) {
        btnMic.classList.add('active-off');
        iconMic.innerText = '🔇';
        if (micStatusText) {
          micStatusText.innerText = '🔇 Mikrofon Dimatikan';
          micStatusText.style.color = '#ef4444';
        }
      } else {
        btnMic.classList.remove('active-off');
        iconMic.innerText = '🎤';
        if (micStatusText) {
          micStatusText.innerText = '🎤 Mikrofon Aktif';
          micStatusText.style.color = '#4ade80';
        }
      }
    }

    function toggleCam() {
      if (!localStream) return;
      camOff = !camOff;
      localStream.getVideoTracks().forEach(t => { t.enabled = !camOff; });
      if (camOff) {
        btnCam.classList.add('active-off');
        iconCam.innerText = '📷✕';
      } else {
        btnCam.classList.remove('active-off');
        iconCam.innerText = '📹';
      }
    }

    async function toggleFlipCamera() {
      if (!localStream || !isVideoCall) return;
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        localStream.addTrack(newVideoTrack);
        if (localVideo) localVideo.srcObject = localStream;
        if (currentCall && currentCall.peerConnection) {
          const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack);
        }
      } catch (e) {
        console.warn('Gagal flip kamera:', e);
      }
    }

    function hangUp() {
      console.log('hangUp dipanggil');
      if (timerInterval) clearInterval(timerInterval);
      if (callRetryInterval) clearInterval(callRetryInterval);
      if (localStream) {
        try {
          localStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
      }
      if (peer) {
        try {
          peer.destroy();
        } catch(e) {}
      }
      notifyRN({ type: 'HANGUP' });
    }

    // Jalankan engine panggilan saat DOM siap atau segera bila sudah dimuat
    let engineStarted = false;
    async function startCallEngine() {
      if (engineStarted) return;
      engineStarted = true;
      console.log('Memulai engine panggilan StudyMatch...');
      try {
        await initMedia();
      } catch (err) {
        console.warn('initMedia caught:', err);
      }
      initPeer();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(startCallEngine, 30);
    } else {
      window.addEventListener('DOMContentLoaded', startCallEngine);
      window.addEventListener('load', startCallEngine);
    }
  </script>
</body>
</html>`;
}
