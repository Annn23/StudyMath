import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Vibration,
  Alert,
  Modal,
  Platform,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Rect, Path } from 'react-native-svg';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { requestCameraPermissionsAsync } from 'expo-image-picker';
import { Colors, Fonts, BorderRadius, Shadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  getCurrentUser,
  getProfile,
  getStudyServerDetail,
  getServerMembers,
  sendServerMessage,
  searchUsersForGroup,
  addServerMembers,
} from '../../lib/api';
import { buildCallUrl, CallType, initiateCallSession, sendGroupMeetInvite } from '../../lib/call';
import { getGroupWebRtcHtml } from '../../lib/groupWebRtcHtml';
import { StudyServer, ServerMember, Profile } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PomodoroMode = 'study' | 'short_break' | 'long_break';

export type ActiveFocusParticipant = {
  user_id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  is_running?: boolean;
  time_left?: number;
  mode?: PomodoroMode;
  joined_at?: string;
  is_simulated?: boolean;
};

/**
 * Custom SVG Video Camera Icon persis sesuai screenshot referensi
 * (Bodi bulat di kiri + lensa trapesium di kanan, warna putih solid)
 */
function VideoCamIcon({ size = 38, color = '#ffffff' }: { size?: number; color?: string }) {
  const width = size * 1.35;
  const height = size;
  return (
    <Svg width={width} height={height} viewBox="0 0 46 34" fill="none">
      <Rect x="0" y="2" width="30" height="30" rx="8" fill={color} />
      <Path
        d="M32 11.5L44 4.5C44.8 4.0 46 4.6 46 5.6V28.4C46 29.4 44.8 30.0 44 29.5L32 22.5V11.5Z"
        fill={color}
      />
    </Svg>
  );
}

export default function ServerFocusScreen() {
  const insets = useSafeAreaInsets();
  const { id: serverId, type = 'video', name: serverNameParam, autostart } = useLocalSearchParams<{
    id: string;
    type?: CallType | 'pomodoro';
    name?: string;
    autostart?: string;
  }>();

  const [server, setServer] = useState<StudyServer | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [activeParticipants, setActiveParticipants] = useState<ActiveFocusParticipant[]>([]);

  // Pomodoro Timer States (Aturan 2: 25m, Aturan 3: 5m, Aturan 5: 15m)
  const [mode, setMode] = useState<PomodoroMode>('study');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [cycle, setCycle] = useState<number>(1);

  // Aturan 1: Tugas belajar yang dipilih
  const [taskName, setTaskName] = useState<string>('Latihan Soal Matematika');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Invite Modal States
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState<string>('');
  const [inviteSearchResults, setInviteSearchResults] = useState<Profile[]>([]);
  const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<string[]>([]);
  const [isSearchingInvite, setIsSearchingInvite] = useState<boolean>(false);
  const [isAddingInvite, setIsAddingInvite] = useState<boolean>(false);

  // Call / WebRTC States
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== 'android');
  const [micGranted, setMicGranted] = useState(Platform.OS !== 'android');
  const [permissionAttempt, setPermissionAttempt] = useState(0);
  const webViewRef = React.useRef<WebView>(null);
  const channelRef = React.useRef<any>(null);

  // ID unik untuk WebRTC PeerJS di room server ini (menggunakan currentUser.id yang valid)
  const cleanServerId = (serverId || 'room').replace(/[^a-zA-Z0-9]/g, '').slice(-16);
  const cleanUserId = (currentUser?.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  const myPeerId = cleanUserId ? `sm_g_${cleanServerId}_${cleanUserId}` : '';

  const webrtcHtml = React.useMemo(() => {
    if (!currentUser?.id) return '';
    return getGroupWebRtcHtml({
      serverId: serverId || 'room',
      myUserId: currentUser.id,
      myName: currentUser.full_name || 'You',
      myAvatar: currentUser.avatar_url || undefined,
      type: (type as any) === 'voice' ? 'voice' : 'video',
      serverName: server?.name || serverNameParam || 'Ruang Belajar',
    });
    // PENTING: Jangan masukkan server?.name ke dependency useMemo agar WebView tidak reload ulang
    // di tengah inisialisasi mikrofon saat getStudyServerDetail selesai!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, currentUser?.id, type]);

  useEffect(() => {
    const title = server?.name || serverNameParam;
    if (title && webViewRef.current) {
      const safeTitle = JSON.stringify(title);
      (webViewRef.current as any)?.injectJavaScript(
        `var el = document.getElementById('roomName'); if (el) el.innerText = ${safeTitle}; true;`
      );
    }
  }, [server?.name, serverNameParam]);

  // Minta izin hardware (mikrofon & kamera) eksplisit di Android saat layar dibuka
  useEffect(() => {
    let mounted = true;
    const requestHardwarePermissions = async () => {
      if (Platform.OS === 'android') {
        setPermissionsReady(false);
        setMicGranted(false);
        try {
          const { granted: audioOk } = await requestRecordingPermissionsAsync();
          if (audioOk && type !== 'voice') {
            await requestCameraPermissionsAsync();
          }
          if (mounted) {
            setMicGranted(audioOk);
            if (!audioOk) {
              Alert.alert(
                'Izin Mikrofon Diperlukan 🎤',
                'Aplikasi membutuhkan izin mikrofon agar suara Anda dapat didengar di Google Meet Room.',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (err) {
          console.warn('[ServerFocusScreen] Hardware permission error:', err);
        } finally {
          if (mounted) setPermissionsReady(true);
        }
      }
    };

    requestHardwarePermissions();
    return () => {
      mounted = false;
    };
  }, [type, permissionAttempt]);

  useEffect(() => {
    loadData();
  }, [serverId]);

  const loadData = async () => {
    if (!serverId) return;
    const user = await getCurrentUser();
    let userProfile: Profile | null = null;
    if (user) {
      userProfile = await getProfile(user.id);
      setCurrentUser(userProfile);

      // Inisialisasi diri sendiri sebagai partisipan aktif awal
      setActiveParticipants([
        {
          user_id: user.id,
          full_name: userProfile?.full_name || 'You',
          username: userProfile?.username || null,
          avatar_url: userProfile?.avatar_url || null,
          is_running: false,
          time_left: 25 * 60,
          mode: 'study',
          joined_at: new Date().toISOString(),
        },
      ]);
    }

    const [srv, mems] = await Promise.all([
      getStudyServerDetail(serverId),
      getServerMembers(serverId),
    ]);

    const allMembers: ServerMember[] = [...(mems || [])];
    if (srv && srv.owner_id && !allMembers.some((m) => m.user_id === srv.owner_id)) {
      const ownerProf = await getProfile(srv.owner_id);
      if (ownerProf) {
        allMembers.unshift({
          id: `owner_${srv.owner_id}`,
          server_id: serverId,
          user_id: srv.owner_id,
          role: 'owner',
          joined_at: srv.created_at,
          profile: ownerProf,
        });
      }
    }

    setServer(srv);
    setMembers(allMembers);

    // Kirim pesan pengumuman ke chat grup server
    if (user && srv) {
      const senderName = userProfile?.full_name || 'Anggota';
      sendServerMessage(
        serverId,
        user.id,
        `🍅 ${senderName} telah membuka Ruang Google Meet (Focus Mode) di "${srv.name}". Ayo gabung belajar!`,
        senderName
      ).catch(() => {});
    }
  };

  // Sinkronisasi seluruh partisipan (Presence, Broadcast, & Anggota Server) ke WebView agar langsung tampil dalam 1 frame
  const syncParticipantsToWebView = useCallback(() => {
    if (!webViewRef.current || !currentUser?.id) return;

    const remoteBuddies = activeParticipants
      .filter((p) => p.user_id !== currentUser.id)
      .map((p) => {
        const remoteUserIdClean = p.user_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
        const targetPeerId = (p as any).peer_id || `sm_g_${cleanServerId}_${remoteUserIdClean}`;
        const targetName = p.full_name || p.username || 'Teman Belajar';
        const targetAvatar = p.avatar_url || '';
        return {
          peerId: targetPeerId,
          name: targetName,
          avatar: targetAvatar,
          timeLeft: p.time_left,
          isRunning: p.is_running,
          mode: p.mode,
        };
      });

    const serverMembersPayload = members
      .filter((m) => m.user_id && m.user_id !== currentUser.id)
      .map((m) => {
        const memberUserIdClean = m.user_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
        return {
          peerId: `sm_g_${cleanServerId}_${memberUserIdClean}`,
          name: m.profile?.full_name || m.profile?.username || 'Teman Belajar',
          avatar: m.profile?.avatar_url || '',
        };
      });

    const presenceJson = JSON.stringify(remoteBuddies);
    const membersJson = JSON.stringify(serverMembersPayload);
    const script = `
      if (typeof window.syncServerMembers === 'function') {
        window.syncServerMembers(${membersJson});
      }
      if (typeof window.syncPresencePeers === 'function') {
        window.syncPresencePeers(${presenceJson});
      }
      true;
    `;
    (webViewRef.current as any)?.injectJavaScript(script);
  }, [activeParticipants, members, currentUser?.id, cleanServerId]);

  // Sinkronisasi otomatis saat daftar partisipan atau anggota server berubah
  useEffect(() => {
    syncParticipantsToWebView();
  }, [activeParticipants, members, syncParticipantsToWebView]);

  // Re-sync berkala agar koneksi peer WebRTC dan kartu partisipan selalu terjaga dalam 1 frame
  useEffect(() => {
    if (!permissionsReady || !micGranted) return;
    const interval = setInterval(() => {
      syncParticipantsToWebView();
    }, 2000);
    return () => clearInterval(interval);
  }, [permissionsReady, micGranted, syncParticipantsToWebView]);

  // Helper untuk mengirim pengumuman kehadiran via Broadcast
  const sendMyPeerAnnounce = useCallback(() => {
    if (!channelRef.current || !currentUser?.id || !myPeerId) return;
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'peer_announce',
        payload: {
          user_id: currentUser.id,
          peer_id: myPeerId,
          full_name: currentUser.full_name || 'Anggota',
          username: currentUser.username || null,
          avatar_url: currentUser.avatar_url || null,
          is_running: isRunning,
          time_left: timeLeft,
          mode: mode,
        },
      });
    } catch {}
  }, [currentUser?.id, currentUser?.full_name, currentUser?.username, currentUser?.avatar_url, myPeerId, isRunning, timeLeft, mode]);

  // Realtime Presence + Broadcast Heartbeat: Melacak siapa saja anggota yang membuka / gabung sesi
  useEffect(() => {
    if (!serverId || !currentUser?.id || !myPeerId) return;

    const topicName = `focus_presence_${cleanServerId}`;
    const existing = supabase.getChannels().find(
      (c) => c.topic === topicName || c.topic === `realtime:${topicName}`
    );
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel(topicName, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });
    channelRef.current = channel;

    const mergePresenceState = () => {
      const state = channel.presenceState();
      const fromPresence: (ActiveFocusParticipant & { peer_id?: string })[] = [];

      for (const key of Object.keys(state)) {
        const presences = state[key] as any[];
        if (presences && presences.length > 0) {
          const p = presences[0] as ActiveFocusParticipant & { peer_id?: string };
          if (p?.user_id && p.user_id !== currentUser.id) {
            fromPresence.push(p);
          }
        }
      }

      setActiveParticipants((prev) => {
        const map = new Map<string, ActiveFocusParticipant & { peer_id?: string }>();
        // Pertahankan partisipan yang ditambahkan via simulasi testing
        prev.forEach((item) => {
          if (item.is_simulated) {
            map.set(item.user_id, item);
          }
        });
        // Pastikan diri sendiri selalu ada
        map.set(currentUser.id, {
          user_id: currentUser.id,
          full_name: currentUser.full_name || 'You',
          username: currentUser.username || null,
          avatar_url: currentUser.avatar_url || null,
          is_running: isRunning,
          time_left: timeLeft,
          mode: mode,
          joined_at: new Date().toISOString(),
        });
        // Gabungkan dari presence
        fromPresence.forEach((p) => {
          const existingItem = map.get(p.user_id);
          map.set(p.user_id, { ...(existingItem || {}), ...p });
        });
        return Array.from(map.values());
      });
    };

    channel
      .on('presence', { event: 'sync' }, mergePresenceState)
      .on('presence', { event: 'join' }, () => {
        mergePresenceState();
        sendMyPeerAnnounce();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        if (Array.isArray(leftPresences)) {
          const leftUserIds = new Set<string>();
          leftPresences.forEach((lp: any) => {
            if (lp?.user_id && lp.user_id !== currentUser.id) {
              leftUserIds.add(lp.user_id);
              const remoteUserIdClean = lp.user_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
              const targetPeerId = lp.peer_id || `sm_g_${cleanServerId}_${remoteUserIdClean}`;
              (webViewRef.current as any)?.injectJavaScript(
                `if (typeof window.disconnectPeer === 'function') { window.disconnectPeer('${targetPeerId}'); } true;`
              );
            }
          });
          if (leftUserIds.size > 0) {
            setActiveParticipants((prev) =>
              prev.filter((p) => p.is_simulated || !leftUserIds.has(p.user_id))
            );
          }
        }
      })
      .on('broadcast', { event: 'peer_announce' }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === currentUser.id) return;
        setActiveParticipants((prev) => {
          const exists = prev.some((p) => p.user_id === payload.user_id);
          if (exists) {
            return prev.map((p) => (p.user_id === payload.user_id ? { ...p, ...payload } : p));
          }
          return [...prev, payload];
        });
      })
      .on('broadcast', { event: 'peer_leave' }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === currentUser.id) return;
        const remoteUserIdClean = payload.user_id.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
        const targetPeerId = payload.peer_id || `sm_g_${cleanServerId}_${remoteUserIdClean}`;
        (webViewRef.current as any)?.injectJavaScript(
          `if (typeof window.disconnectPeer === 'function') { window.disconnectPeer('${targetPeerId}'); } true;`
        );
        setActiveParticipants((prev) =>
          prev.filter((p) => p.is_simulated || p.user_id !== payload.user_id)
        );
      })
      .on('broadcast', { event: 'timer_update' }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === currentUser.id) return;
        setActiveParticipants((prev) => {
          const exists = prev.some((p) => p.user_id === payload.user_id);
          if (exists) {
            return prev.map((p) => (p.user_id === payload.user_id ? { ...p, ...payload } : p));
          }
          return [...prev, payload];
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              user_id: currentUser.id,
              peer_id: myPeerId,
              full_name: currentUser.full_name || 'Anggota',
              username: currentUser.username || null,
              avatar_url: currentUser.avatar_url || null,
              is_running: isRunning,
              time_left: timeLeft,
              mode: mode,
              joined_at: new Date().toISOString(),
            });
          } catch {}
          sendMyPeerAnnounce();
        }
      });

    const announceTimer = setInterval(() => {
      sendMyPeerAnnounce();
    }, 3000);

    return () => {
      clearInterval(announceTimer);
      try {
        channel.send({
          type: 'broadcast',
          event: 'peer_leave',
          payload: { user_id: currentUser.id, peer_id: myPeerId },
        });
      } catch {}
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [serverId, currentUser?.id, myPeerId, cleanServerId]);

  // Pomodoro Interval Timer untuk User ini
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 600, 300, 600]);
      }
      handleTimerComplete();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft]);

  // Interval timer independen untuk simulated buddies (untuk testing multi-member)
  useEffect(() => {
    const hasRunningSim = activeParticipants.some(
      (p) => p.is_simulated && p.is_running
    );
    if (!hasRunningSim) return;

    const interval = setInterval(() => {
      setActiveParticipants((prev) =>
        prev.map((p) => {
          if (p.is_simulated && p.is_running && (p.time_left ?? 0) > 0) {
            return { ...p, time_left: (p.time_left ?? 0) - 1 };
          }
          return p;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeParticipants]);

  const handleTimerComplete = () => {
    setIsRunning(false);

    if (mode === 'study') {
      if (cycle < 4) {
        Alert.alert(
          'Sesi Belajar Selesai! 🎉',
          `Sesi Pomodoro ke-${cycle} selesai!\nWaktunya istirahat sejenak 5 menit ☕`,
          [
            {
              text: 'Mulai Istirahat (5m)',
              onPress: () => switchMode('short_break', cycle),
            },
          ]
        );
      } else {
        Alert.alert(
          '4 Siklus Selesai! 🏆🎉',
          'Luar biasa! Anda menyelesaikan 4 siklus penuh.\nSekarang istirahat panjang (15–30 menit) 🌴',
          [
            {
              text: 'Istirahat Panjang (15m)',
              onPress: () => switchMode('long_break', 1),
            },
          ]
        );
      }
    } else if (mode === 'short_break') {
      const nextCycle = cycle + 1;
      Alert.alert(
        'Istirahat Selesai! ⏰',
        `Waktunya kembali fokus belajar untuk siklus ke-${nextCycle} 📚`,
        [
          {
            text: `Mulai Belajar Siklus ${nextCycle}`,
            onPress: () => switchMode('study', nextCycle),
          },
        ]
      );
    } else {
      Alert.alert('Istirahat Panjang Selesai! ✨', 'Siap memulai 4 siklus Pomodoro baru?', [
        {
          text: 'Mulai Siklus 1',
          onPress: () => switchMode('study', 1),
        },
      ]);
    }
  };

  const switchMode = (newMode: PomodoroMode, newCycle?: number) => {
    setMode(newMode);
    if (newCycle !== undefined) setCycle(newCycle);
    setIsRunning(false);

    let newSec = 25 * 60;
    if (newMode === 'study') newSec = 25 * 60;
    else if (newMode === 'short_break') newSec = 5 * 60;
    else newSec = 15 * 60;
    setTimeLeft(newSec);

    (webViewRef.current as any)?.injectJavaScript(
      `if (typeof window.setPomodoroMode === "function") { window.setPomodoroMode('${newMode}', ${newSec}); } true;`
    );

    if (currentUser?.id) {
      setActiveParticipants((prev) =>
        prev.map((p) =>
          p.user_id === currentUser.id
            ? { ...p, mode: newMode, is_running: false, time_left: newSec }
            : p
        )
      );

      try {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'timer_update',
          payload: {
            user_id: currentUser.id,
            peer_id: myPeerId,
            full_name: currentUser.full_name || 'Anggota',
            avatar_url: currentUser.avatar_url || null,
            is_running: false,
            time_left: newSec,
            mode: newMode,
          },
        });
      } catch (e) {}
    }
  };

  const toggleStartPause = () => {
    const nextRunning = !isRunning;
    setIsRunning(nextRunning);

    if (currentUser?.id) {
      setActiveParticipants((prev) =>
        prev.map((p) =>
          p.user_id === currentUser.id
            ? { ...p, is_running: nextRunning, time_left: timeLeft }
            : p
        )
      );

      try {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'timer_update',
          payload: {
            user_id: currentUser.id,
            peer_id: myPeerId,
            full_name: currentUser.full_name || 'Anggota',
            avatar_url: currentUser.avatar_url || null,
            is_running: nextRunning,
            time_left: timeLeft,
            mode: mode,
          },
        });
      } catch (e) {}
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    let sec = 25 * 60;
    if (mode === 'study') sec = 25 * 60;
    else if (mode === 'short_break') sec = 5 * 60;
    else sec = 15 * 60;
    setTimeLeft(sec);

    if (currentUser?.id) {
      setActiveParticipants((prev) =>
        prev.map((p) =>
          p.user_id === currentUser.id ? { ...p, is_running: false, time_left: sec } : p
        )
      );
    }
  };

  // Helper format detik ke MM : SS
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
  };

  const timeFormatted = formatSeconds(timeLeft);

  // Filter HANYA partisipan yang benar-benar telah join ke sesi Pomodoro
  const otherActiveParticipants = activeParticipants.filter(
    (p) => p.user_id !== currentUser?.id
  );
  const otherGroupMembers = members.filter((m) => m.user_id !== currentUser?.id);

  // 4 Slot Partisipan
  const slot1 = otherActiveParticipants[0];
  const slot2 = otherActiveParticipants[1];
  const slot3 = otherActiveParticipants[2];

  // Jumlah partisipan yang benar-benar sedang belajar di sesi ini
  const membersStudyingCount = 1 + otherActiveParticipants.length;

  // Panggil anggota grup agar masuk sesi (mengirim ringing call modal & push notification)
  const handleNotifyMember = async (member: ServerMember) => {
    if (!serverId || !currentUser?.id) return;
    const name = member.profile?.full_name || `@${member.profile?.username}` || 'Teman';
    const myName = currentUser.full_name || 'Teman Belajar';
    const sName = server?.name || serverNameParam || 'Ruang Belajar';
    try {
      await initiateCallSession({
        conversationId: serverId,
        callerId: currentUser.id,
        callerName: myName,
        callerAvatar: currentUser.avatar_url || undefined,
        receiverId: member.user_id,
        room: `StudyServer_${cleanServerId}`,
        type: (type as any) === 'voice' ? 'voice' : 'video',
        status: 'calling',
        is_group_meet: true,
        server_id: serverId,
        server_name: sName,
      });

      await sendServerMessage(
        serverId,
        currentUser.id,
        `🍅 Halo @${name}, ${myName} sedang belajar di Sesi Pomodoro (${taskName}). Ayo gabung belajar bareng!`,
        myName
      );
      Alert.alert('Panggilan Terkirim! 🔔', `Panggilan dan notifikasi dering telah dikirim ke HP ${name}.`);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat mengirim panggilan.');
    }
  };

  // Panggil semua anggota grup sekaligus
  const handleNotifyAllMembers = async () => {
    if (!serverId || !currentUser?.id || otherGroupMembers.length === 0) return;
    const myName = currentUser.full_name || 'Teman Belajar';
    const sName = server?.name || serverNameParam || 'Ruang Belajar';
    try {
      await sendGroupMeetInvite({
        serverId,
        serverName: sName,
        callerId: currentUser.id,
        callerName: myName,
        callerAvatar: currentUser.avatar_url || undefined,
        receiverUserIds: otherGroupMembers.map((m) => m.user_id),
        type: (type as any) === 'voice' ? 'voice' : 'video',
      });

      await sendServerMessage(
        serverId,
        currentUser.id,
        `📢 @all ${myName} mengundang seluruh anggota grup belajar ke Google Meet Room (${taskName}). Ayo gabung!`,
        myName
      );
      Alert.alert(
        'Panggilan Terkirim ke Semua Anggota! 🔔',
        `Panggilan dan dering telah dikirim ke ${otherGroupMembers.length} anggota grup.`
      );
    } catch {
      Alert.alert('Gagal', 'Tidak dapat memanggil semua anggota.');
    }
  };

  // Uji coba memasukkan anggota ke sesi (Simulasi belajar bareng)
  const handleSimulateBuddyJoin = (member: ServerMember) => {
    const prof = member.profile;
    const buddy: ActiveFocusParticipant = {
      user_id: member.user_id,
      full_name: prof?.full_name || 'Partner Belajar',
      username: prof?.username || null,
      avatar_url: prof?.avatar_url || null,
      is_running: true,
      time_left: 25 * 60,
      mode: 'study',
      joined_at: new Date().toISOString(),
      is_simulated: true,
    };
    setActiveParticipants((prev) => {
      if (prev.some((p) => p.user_id === member.user_id)) return prev;
      return [...prev, buddy];
    });
    Alert.alert(
      'Partner Masuk Sesi! 🎉',
      `${prof?.full_name || 'Partner'} telah masuk ke sesi Pomodoro dan memulai timernya sendiri!`
    );
  };

  const handleRemoveSimulatedBuddy = (userId: string) => {
    setActiveParticipants((prev) => prev.filter((p) => p.user_id !== userId));
  };

  // Search user untuk diundang ke grup
  const handleSearchInvite = async (q: string) => {
    setInviteSearchQuery(q);
    if (!q.trim()) {
      setInviteSearchResults([]);
      return;
    }
    const myId = currentUser?.id || '';
    const res = await searchUsersForGroup(q, myId);
    const existingIds = new Set(members.map((m) => m.user_id));
    setInviteSearchResults(res.filter((u) => !existingIds.has(u.id)));
    setIsSearchingInvite(false);
  };

  const toggleSelectInviteUser = (uid: string) => {
    if (selectedInviteUserIds.includes(uid)) {
      setSelectedInviteUserIds((prev) => prev.filter((id) => id !== uid));
    } else {
      setSelectedInviteUserIds((prev) => [...prev, uid]);
    }
  };

  const handleAddInvitedMembers = async () => {
    if (!serverId || selectedInviteUserIds.length === 0) return;
    setIsAddingInvite(true);
    const res = await addServerMembers(serverId, selectedInviteUserIds);
    setIsAddingInvite(false);
    if (res.success) {
      setSelectedInviteUserIds([]);
      setInviteSearchQuery('');
      setInviteSearchResults([]);
      loadData();
      Alert.alert('Berhasil', 'Anggota berhasil ditambahkan ke grup.');
    } else {
      Alert.alert('Gagal', 'Tidak dapat menambahkan anggota. Silakan coba lagi.');
    }
  };

  const handleExit = () => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'peer_leave',
        payload: { user_id: currentUser?.id, peer_id: myPeerId },
      });
    } catch {}
    if (router.canGoBack()) {
      router.back();
    } else if (serverId) {
      router.replace(`/server-chat/${serverId}`);
    } else {
      router.replace('/(tabs)/chat');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#c4b5fd', '#f472b6', '#7dd3fc', '#86efac']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="dark" />

      {permissionsReady && micGranted && !!currentUser?.id && !!webrtcHtml ? (
        <WebView
          key={myPeerId}
          ref={webViewRef as any}
          source={{
            html: webrtcHtml,
            baseUrl: 'https://studymatch.app',
          }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          allowsFullscreenVideo
          originWhitelist={['*']}
          style={styles.webview}
          onLoadEnd={() => {
            (webViewRef.current as any)?.injectJavaScript(
              'if (typeof unlockAudio === "function") { unlockAudio(); } true;'
            );
            if (autostart === '1' || autostart === 'true') {
              (webViewRef.current as any)?.injectJavaScript(
                'setTimeout(() => { if (typeof togglePomodoro === "function") { togglePomodoro(); } }, 1500); true;'
              );
            }
            syncParticipantsToWebView();
            sendMyPeerAnnounce();
          }}
          onMessage={(event: any) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'LEAVE_MEET') {
                handleExit();
              } else if (data.type === 'WEBVIEW_LOG') {
                console.log(`[GroupWebView:${data.level}]`, data.message);
              } else if (data.type === 'PEER_OPEN') {
                syncParticipantsToWebView();
                sendMyPeerAnnounce();
              } else if (data.type === 'CONNECTED') {
                (webViewRef.current as any)?.injectJavaScript(
                  'if (typeof window.unlockAudio === "function") { window.unlockAudio(); } true;'
                );
              } else if (data.type === 'OPEN_SETTINGS') {
                setShowSettingsModal(true);
              } else if (data.type === 'OPEN_INVITE') {
                setShowInviteModal(true);
              } else if (data.type === 'POMO_STATE') {
                setIsRunning(data.isRunning);
                setTimeLeft(data.timeLeft);
                if (currentUser?.id) {
                  try {
                    channelRef.current?.send({
                      type: 'broadcast',
                      event: 'timer_update',
                      payload: {
                        user_id: currentUser.id,
                        peer_id: myPeerId,
                        full_name: currentUser.full_name || 'Anggota',
                        avatar_url: currentUser.avatar_url || null,
                        is_running: data.isRunning,
                        time_left: data.timeLeft,
                        mode: mode,
                      },
                    });
                  } catch {}
                }
              } else if (data.type === 'POMO_COMPLETE') {
                handleTimerComplete();
              } else if (data.type === 'MIC_TOGGLED') {
                setIsMicMuted(data.muted);
              } else if (data.type === 'CAM_TOGGLED') {
                setIsCameraOff(data.camOff);
              } else if (data.type === 'ERROR') {
                Alert.alert('Perhatian', data.message || 'Kendala sambungan audio/video.');
              }
            } catch {}
          }}
        />
      ) : !permissionsReady || !currentUser?.id ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Menyiapkan ruang belajar & kamera...</Text>
        </View>
      ) : (
        <View style={styles.centerLoading}>
          <Text style={styles.permissionTitle}>Izin Mikrofon Dibutuhkan 🎤</Text>
          <Text style={styles.permissionSubtitle}>
            Aplikasi memerlukan izin mikrofon agar suaramu dapat didengar saat berbicara.
          </Text>
          <TouchableOpacity
            style={styles.permissionRetryBtn}
            onPress={() => setPermissionAttempt((prev) => prev + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionRetryText}>Coba lagi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.permissionSettingsBtn}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionSettingsText}>Buka pengaturan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={handleExit} activeOpacity={0.85}>
            <Text style={styles.endIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== MODAL PENGATURAN POMODORO & TUGAS ==================== */}
      <Modal visible={showSettingsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Pengaturan Focus Mode ⏱️</Text>
            <Text style={styles.modalSub}>
              Pilih mode interval Pomodoro dan tetapkan target tugas Anda:
            </Text>

            {/* Pilihan Interval */}
            <View style={styles.modeOptionsRow}>
              <TouchableOpacity
                style={[styles.modalModeOption, mode === 'study' && styles.modalModeOptionActive]}
                onPress={() => switchMode('study')}
              >
                <Text
                  style={[
                    styles.modalModeOptionText,
                    mode === 'study' && styles.modalModeOptionTextActive,
                  ]}
                >
                  📚 Belajar (25m)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalModeOption,
                  mode === 'short_break' && styles.modalModeOptionActive,
                ]}
                onPress={() => switchMode('short_break')}
              >
                <Text
                  style={[
                    styles.modalModeOptionText,
                    mode === 'short_break' && styles.modalModeOptionTextActive,
                  ]}
                >
                  ☕ Break (5m)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalModeOption,
                  mode === 'long_break' && styles.modalModeOptionActive,
                ]}
                onPress={() => switchMode('long_break')}
              >
                <Text
                  style={[
                    styles.modalModeOptionText,
                    mode === 'long_break' && styles.modalModeOptionTextActive,
                  ]}
                >
                  🌴 Break (15m)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Status Siklus */}
            <View style={styles.cycleModalBadge}>
              <Text style={styles.cycleModalText}>🍅 Siklus Pomodoro: {cycle} dari 4</Text>
            </View>

            {/* Input Target Belajar (Aturan 1) */}
            <Text style={styles.taskInputLabel}>Tugas yang sedang diselesaikan:</Text>
            <TextInput
              style={styles.taskInput}
              value={taskName}
              onChangeText={setTaskName}
              placeholder="Contoh: Latihan Soal Kalkulus Bab 3"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.modalSaveText}>Tutup & Lanjutkan Fokus 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL UNDANG TEMAN ==================== */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.inviteModalHeader}>
              <Text style={styles.modalHeading}>Undang Teman ke Sesi 👥</Text>
              <TouchableOpacity
                onPress={() => setShowInviteModal(false)}
                style={styles.modalCloseCircle}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* 1. Anggota Grup Server (Belum Masuk Sesi) */}
              <View style={styles.inviteSection}>
                <Text style={styles.inviteSectionTitle}>
                  Anggota Grup Ini ({otherGroupMembers.length})
                </Text>
                <Text style={styles.inviteSectionSubtitle}>
                  Panggil anggota grup untuk bergabung ke sesi Pomodoro Anda:
                </Text>

                {otherGroupMembers.length > 0 && (
                  <View style={styles.inviteAllRow}>
                    <TouchableOpacity
                      style={styles.notifyAllMembersBtn}
                      onPress={handleNotifyAllMembers}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.notifyAllMembersBtnText}>
                        🔔 Panggil Semua Anggota ({otherGroupMembers.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {otherGroupMembers.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada anggota lain di grup ini.</Text>
                ) : (
                  otherGroupMembers.map((m) => {
                    const prof = m.profile;
                    const isJoined = otherActiveParticipants.some((p) => p.user_id === m.user_id);
                    const isSimulated = activeParticipants.some(
                      (p) => p.user_id === m.user_id && p.is_simulated
                    );

                    return (
                      <View key={m.id} style={styles.groupMemberInviteRow}>
                        <View style={styles.groupMemberInfo}>
                          <Text style={styles.groupMemberName}>
                            {prof?.full_name || 'Anggota'}
                          </Text>
                          <Text style={styles.groupMemberRole}>
                            {isJoined ? '🟢 Sedang di dalam sesi' : '⚪ Belum join sesi'}
                          </Text>
                        </View>

                        <View style={styles.groupMemberActionButtons}>
                          {isSimulated ? (
                            <TouchableOpacity
                              style={styles.leaveSimBtn}
                              onPress={() => handleRemoveSimulatedBuddy(m.user_id)}
                            >
                              <Text style={styles.leaveSimBtnText}>❌ Keluarkan</Text>
                            </TouchableOpacity>
                          ) : isJoined ? (
                            <View style={styles.inSessionBadge}>
                              <Text style={styles.inSessionBadgeText}>✓ Di Sesi</Text>
                            </View>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.notifyMemberBtn}
                                onPress={() => handleNotifyMember(m)}
                              >
                                <Text style={styles.notifyMemberBtnText}>🔔 Panggil</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.simulateJoinBtn}
                                onPress={() => handleSimulateBuddyJoin(m)}
                              >
                                <Text style={styles.simulateJoinBtnText}>▶️ Uji Masuk</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* 2. Cari & Tambah Anggota Baru ke Grup */}
              <View style={[styles.inviteSection, { marginTop: 16 }]}>
                <Text style={styles.inviteSectionTitle}>Undang Teman Baru ke Grup</Text>
                <TextInput
                  style={styles.inviteSearchInput}
                  value={inviteSearchQuery}
                  onChangeText={handleSearchInvite}
                  placeholder="Cari nama atau @username..."
                  placeholderTextColor="#94a3b8"
                />

                {isSearchingInvite ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
                ) : (
                  inviteSearchResults.map((item) => {
                    const isSelected = selectedInviteUserIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.userPickRow, isSelected && styles.userPickRowSelected]}
                        onPress={() => toggleSelectInviteUser(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.userPickInfo}>
                          <Text style={styles.userPickName}>{item.full_name || 'Pengguna'}</Text>
                          <Text style={styles.userPickUsername}>@{item.username}</Text>
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}

                {selectedInviteUserIds.length > 0 && (
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, isAddingInvite && { opacity: 0.5 }]}
                    disabled={isAddingInvite}
                    onPress={handleAddInvitedMembers}
                  >
                    {isAddingInvite ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSaveText}>
                        Tambahkan ke Grup ({selectedInviteUserIds.length})
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

/**
 * Komponen Card Partisipan dalam Grid 2x2 Simetris
 * Setiap kartu adalah persegi panjang vertikal tinggi (aspect ratio ~1:1.25),
 * dengan ikon kamera video SVG putih di tengah dan nama tebal di bawah.
 */
function ParticipantCard({
  name,
  isSelf = false,
  isCameraOff = false,
  isMicMuted = false,
  isEmpty = false,
  statusBadge,
  avatarUrl,
  onPress,
}: {
  name: string;
  isSelf?: boolean;
  isCameraOff?: boolean;
  isMicMuted?: boolean;
  isEmpty?: boolean;
  statusBadge?: string;
  avatarUrl?: string | null;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.participantCard, isEmpty && styles.participantCardEmpty]}>
      {/* Top area untuk mic badge & status timer */}
      <View style={styles.cardTopArea}>
        {statusBadge && !isEmpty ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusBadge}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {isSelf && (
          <View style={styles.selfMicBadge}>
            <Text style={styles.selfMicText}>{isMicMuted ? '🔇' : '🎙️'}</Text>
          </View>
        )}
      </View>

      {/* Center area untuk Ikon / Avatar */}
      <View style={styles.cardCenterIconWrap}>
        {isEmpty ? (
          <View style={styles.emptySlotIconWrap}>
            <Text style={styles.emptySlotPlus}>➕</Text>
          </View>
        ) : isSelf && isCameraOff ? (
          <View style={styles.camOffBody}>
            <Text style={styles.camOffText}>🚫</Text>
          </View>
        ) : avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.participantAvatar} contentFit="cover" />
        ) : (
          <VideoCamIcon size={40} color="#ffffff" />
        )}
      </View>

      {/* Bottom area untuk Nama Partisipan */}
      <View style={styles.cardBottomArea}>
        <Text
          style={[styles.participantName, isEmpty && styles.participantNameEmpty]}
          numberOfLines={1}
        >
          {name}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.cardTouchable}>{content}</View>;
}

// Menghitung ukuran card agar selalu proporsional dan tinggi (aspect ratio ~1:1.25)
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 14) / 2; // (Screen - horizontal padding - gap) / 2
const CARD_HEIGHT = Math.min(210, Math.max(165, Math.round(CARD_WIDTH * 1.25)));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#c4b5fd',
  },
  webviewWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 14,
    color: '#0f172a',
    fontSize: 14,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionRetryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  permissionRetryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionSettingsBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionSettingsText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
  },
  endBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  endIcon: {
    fontSize: 26,
    transform: [{ rotate: '135deg' }],
  },
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  hiddenWebview: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
  },

  // ==================== 1. TOP NAVIGATION ====================
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cyanBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38bdf8', // Cyan khas gambar referensi
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  cyanBackArrow: {
    fontSize: 22,
    lineHeight: 26,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  titleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  focusModeTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 25,
    letterSpacing: -0.3,
  },
  focusWord: {
    color: '#2563eb', // Biru
  },
  modeWord: {
    color: '#9333ea', // Ungu
  },
  membersStudyingSubtitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#ffffff', // Putih terang persis seperti di gambar referensi
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  settingsBtnText: {
    fontSize: 18,
  },

  // ==================== 2. SESSION CAPSULE & TITLE ====================
  sessionHeaderSection: {
    alignItems: 'center',
    marginVertical: 2,
  },
  frostedCapsule: {
    paddingHorizontal: 22,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 3,
    ...Shadow.small,
  },
  capsuleTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 16.5,
  },
  capsuleOrange: {
    color: '#f59e0b',
  },
  capsuleGreen: {
    color: '#10b981',
  },
  serverNameHeading: {
    fontFamily: Fonts.extraBold,
    fontSize: 17,
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  // ==================== 3. KOTAK TIMER (PERSIS GAMBAR REFERENSI) ====================
  timerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 160,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    marginVertical: 4,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  timerNumbers: {
    fontFamily: Fonts.extraBold,
    fontSize: 38,
    color: '#ff4d15', // Oranye kemerahan menyala persis seperti gambar
    letterSpacing: 2,
    lineHeight: 44,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 77, 21, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  glassPillButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1.2,
    borderColor: '#ffffff',
    marginTop: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  glassPillButtonActive: {
    backgroundColor: '#ff4d15',
    borderColor: '#ff4d15',
  },
  glassPillButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    color: '#1e293b',
  },
  glassPillButtonTextActive: {
    color: '#ffffff',
  },

  // ==================== 4. 2x2 KOTAK ORANG / PARTISIPAN ====================
  gridContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
    marginVertical: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 14,
    height: CARD_HEIGHT, // Kunci tinggi agar kotak orang selalu tinggi & proporsional
  },
  cardTouchable: {
    flex: 1,
    height: '100%',
  },
  participantCard: {
    flex: 1,
    height: '100%',
    borderRadius: 28, // Sudut bulat lembut & elegan persis gambar referensi
    backgroundColor: 'rgba(255, 255, 255, 0.42)', // Frosted glass cards seragam
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopArea: {
    width: '100%',
    height: 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 6,
    paddingRight: 4,
  },
  selfMicBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 10,
    padding: 3,
  },
  selfMicText: {
    fontSize: 10,
  },
  cardCenterIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  camOffBody: {
    width: 48,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camOffText: {
    fontSize: 22,
  },
  cardBottomArea: {
    width: '100%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  participantName: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'center',
    paddingHorizontal: 6,
    letterSpacing: -0.2,
  },

  // ==================== 5. BOTTOM CONTROLS DOCK ====================
  bottomDock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...Shadow.medium,
  },
  dockBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dockBtnMuted: {
    opacity: 0.45,
  },
  dockBtnLeave: {},
  dockBtnIcon: {
    fontSize: 18,
    marginBottom: 1,
  },
  dockBtnLabel: {
    fontFamily: Fonts.medium,
    fontSize: 9.5,
    color: '#334155',
  },

  // ==================== MODAL PENGATURAN ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    ...Shadow.medium,
  },
  modalHeading: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 14,
  },
  modeOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  modalModeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalModeOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  modalModeOptionText: {
    fontFamily: Fonts.medium,
    fontSize: 10.5,
    color: '#475569',
  },
  modalModeOptionTextActive: {
    color: '#ffffff',
    fontFamily: Fonts.bold,
  },
  cycleModalBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    marginBottom: 14,
    alignItems: 'center',
  },
  cycleModalText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#ea580c',
  },
  taskInputLabel: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
  },
  taskInput: {
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    color: '#ffffff',
  },

  // ==================== MODAL UNDANG TEMAN ====================
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 'bold',
  },
  inviteSearchInput: {
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#0f172a',
    marginBottom: 12,
  },
  userPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  userPickRowSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  userPickInfo: {
    flex: 1,
  },
  userPickName: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0f172a',
  },
  userPickUsername: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#64748b',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginVertical: 14,
    fontFamily: Fonts.regular,
  },

  // Kartu Partisipan Kosong / Menunggu
  participantCardEmpty: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  participantNameEmpty: {
    color: 'rgba(15, 23, 42, 0.6)',
    fontStyle: 'italic',
    fontSize: 13,
  },
  emptySlotIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotPlus: {
    fontSize: 22,
    color: '#ffffff',
  },
  participantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#ff4d15',
  },
  statusPillText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: '#ff4d15',
  },

  // Modal Section & Group Members
  inviteSection: {
    marginBottom: 16,
  },
  inviteSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
    color: '#0f172a',
    marginBottom: 2,
  },
  inviteSectionSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  groupMemberInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  groupMemberInfo: {
    flex: 1,
    marginRight: 8,
  },
  groupMemberName: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0f172a',
  },
  groupMemberRole: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  groupMemberActionButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  notifyMemberBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  notifyMemberBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#1d4ed8',
  },
  simulateJoinBtn: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  simulateJoinBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#15803d',
  },
  leaveSimBtn: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  leaveSimBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#b91c1c',
  },
  inSessionBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  inSessionBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#166534',
  },
  inviteAllRow: {
    marginBottom: 12,
  },
  notifyAllMembersBtn: {
    backgroundColor: '#2563eb',
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  notifyAllMembersBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    color: '#ffffff',
  },
});
