import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Rect, Path } from 'react-native-svg';
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
import { buildCallUrl, CallType } from '../../lib/call';
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
  const { id: serverId, type = 'video', name: serverNameParam } = useLocalSearchParams<{
    id: string;
    type?: CallType | 'pomodoro';
    name?: string;
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

  const roomName = `StudyServer_${(serverId || 'room').replace(/-/g, '').slice(0, 16)}`;
  const callUrl = buildCallUrl(
    roomName,
    type === 'voice' ? 'voice' : 'video',
    currentUser?.full_name || 'You'
  );

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
        `🍅 ${senderName} telah memulai Sesi Focus Mode (Pomodoro 25m) di "${srv.name}". Ayo gabung belajar!`,
        senderName
      ).catch(() => {});
    }
  };

  // Realtime Presence: Melacak siapa saja anggota yang BENAR-BENAR membuka / gabung sesi
  useEffect(() => {
    if (!serverId || !currentUser?.id) return;

    const channel = supabase.channel(`focus_presence_${serverId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeList: ActiveFocusParticipant[] = [];
        const seen = new Set<string>();

        // Pastikan diri sendiri selalu ada
        seen.add(currentUser.id);
        activeList.push({
          user_id: currentUser.id,
          full_name: currentUser.full_name || 'You',
          username: currentUser.username || null,
          avatar_url: currentUser.avatar_url || null,
          is_running: isRunning,
          time_left: timeLeft,
          mode: mode,
          joined_at: new Date().toISOString(),
        });

        for (const key of Object.keys(state)) {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const p = presences[0] as ActiveFocusParticipant;
            if (p?.user_id && !seen.has(p.user_id)) {
              seen.add(p.user_id);
              activeList.push(p);
            }
          }
        }

        // Pertahankan simulated buddy jika sedang diaktifkan untuk pengujian
        setActiveParticipants((prev) => {
          const simulated = prev.filter((p) => p.is_simulated && !seen.has(p.user_id));
          return [...activeList, ...simulated];
        });
      })
      .on('broadcast', { event: 'timer_update' }, ({ payload }) => {
        if (!payload?.user_id || payload.user_id === currentUser.id) return;
        setActiveParticipants((prev) =>
          prev.map((p) => (p.user_id === payload.user_id ? { ...p, ...payload } : p))
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            full_name: currentUser.full_name || 'Anggota',
            username: currentUser.username || null,
            avatar_url: currentUser.avatar_url || null,
            is_running: isRunning,
            time_left: timeLeft,
            mode: mode,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [serverId, currentUser?.id]);

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

    if (currentUser?.id) {
      setActiveParticipants((prev) =>
        prev.map((p) =>
          p.user_id === currentUser.id
            ? { ...p, mode: newMode, is_running: false, time_left: newSec }
            : p
        )
      );

      try {
        const channel = supabase.channel(`focus_presence_${serverId}`);
        channel.send({
          type: 'broadcast',
          event: 'timer_update',
          payload: {
            user_id: currentUser.id,
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
        const channel = supabase.channel(`focus_presence_${serverId}`);
        channel.send({
          type: 'broadcast',
          event: 'timer_update',
          payload: {
            user_id: currentUser.id,
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

  // Panggil anggota grup agar masuk sesi
  const handleNotifyMember = async (member: ServerMember) => {
    if (!serverId || !currentUser?.id) return;
    const name = member.profile?.full_name || `@${member.profile?.username}` || 'Teman';
    const myName = currentUser.full_name || 'Teman Belajar';
    try {
      await sendServerMessage(
        serverId,
        currentUser.id,
        `🍅 Halo @${name}, ${myName} sedang belajar di Sesi Pomodoro (${taskName}). Ayo gabung belajar bareng!`,
        myName
      );
      Alert.alert('Ajakan Terkirim! 🔔', `Panggilan untuk ${name} telah dikirim ke obrolan grup.`);
    } catch {
      Alert.alert('Gagal', 'Tidak dapat mengirim ajakan.');
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

  return (
    <View style={styles.container}>
      {/* Background Pastel Dreamy Ethereal Glow persis sesuai Gambar Referensi */}
      <LinearGradient
        colors={['#c4b5fd', '#f472b6', '#7dd3fc', '#86efac']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="dark" />

      {/* WebRTC Video Call Engine di Background */}
      <View style={styles.hiddenWebview}>
        <WebView
          source={{ uri: callUrl }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
        />
      </View>

      {/* Main Single-Screen Wrapper (Terstruktur & Proporsional Sempurna) */}
      <View
        style={[
          styles.mainWrapper,
          {
            paddingTop: insets.top + 4,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {/* ==================== 1. TOP HEADER ==================== */}
        <View style={styles.topNavRow}>
          {/* Tombol Back Cyan Bulat */}
          <TouchableOpacity
            style={styles.cyanBackBtn}
            onPress={() => router.back()}
            activeOpacity={0.75}
          >
            <Text style={styles.cyanBackArrow}>←</Text>
          </TouchableOpacity>

          {/* Judul: Focus Mode & N Members Studying */}
          <View style={styles.titleWrap}>
            <Text style={styles.focusModeTitle}>
              <Text style={styles.focusWord}>Focus </Text>
              <Text style={styles.modeWord}>Mode</Text>
            </Text>
            <Text style={styles.membersStudyingSubtitle}>
              {membersStudyingCount} Members Studying
            </Text>
          </View>

          {/* Tombol Pengaturan Pomodoro & Tugas */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== 2. SESSION CAPSULE & SERVER NAME ==================== */}
        <View style={styles.sessionHeaderSection}>
          <TouchableOpacity
            style={styles.frostedCapsule}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.capsuleTitle}>
              {mode === 'study' ? (
                <>
                  <Text style={styles.capsuleOrange}>Study </Text>
                  <Text style={styles.capsuleGreen}>Session</Text>
                </>
              ) : mode === 'short_break' ? (
                <>
                  <Text style={styles.capsuleGreen}>Short </Text>
                  <Text style={styles.capsuleOrange}>Break</Text>
                </>
              ) : (
                <>
                  <Text style={styles.capsuleGreen}>Long </Text>
                  <Text style={styles.capsuleOrange}>Break</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>

          {/* Nama Server / Grup (e.g. Math Study Club) */}
          <Text style={styles.serverNameHeading} numberOfLines={1}>
            {server?.name || serverNameParam || 'Math Study Club'}
          </Text>
        </View>

        {/* ==================== 3. KOTAK TIMER (PERSIS GAMBAR REFERENSI) ==================== */}
        {/* Kotak minimalis bersih: hanya berisi angka 25 : 00 dan tombol pil Start di bawahnya */}
        <View style={styles.timerCard}>
          <Text style={styles.timerNumbers}>{timeFormatted}</Text>

          <TouchableOpacity
            style={[styles.glassPillButton, isRunning && styles.glassPillButtonActive]}
            onPress={toggleStartPause}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.glassPillButtonText,
                isRunning && styles.glassPillButtonTextActive,
              ]}
            >
              {isRunning ? 'Pause' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ==================== 4. 2x2 KOTAK ORANG / PARTISIPAN (PERSIS GAMBAR REFERENSI) ==================== */}
        {/* Persegi panjang vertikal tinggi & elegan, ikon kamera putih solid di tengah, nama tebal di bawah */}
        <View style={styles.gridContainer}>
          {/* Row 1: Slot 1 (Kiri Atas) & Slot 2 (Kanan Atas) */}
          <View style={styles.gridRow}>
            <ParticipantCard
              name={slot1 ? (slot1.full_name || `@${slot1.username}` || 'Partner 1') : '+ Undang Teman'}
              isSelf={false}
              isEmpty={!slot1}
              statusBadge={
                slot1
                  ? `${slot1.is_running ? '🍅' : '⏸️'} ${formatSeconds(slot1.time_left ?? 25 * 60)}`
                  : undefined
              }
              avatarUrl={slot1?.avatar_url}
              onPress={!slot1 ? () => setShowInviteModal(true) : undefined}
            />
            <ParticipantCard
              name={slot2 ? (slot2.full_name || `@${slot2.username}` || 'Partner 2') : 'Menunggu Teman'}
              isSelf={false}
              isEmpty={!slot2}
              statusBadge={
                slot2
                  ? `${slot2.is_running ? '🍅' : '⏸️'} ${formatSeconds(slot2.time_left ?? 25 * 60)}`
                  : undefined
              }
              avatarUrl={slot2?.avatar_url}
              onPress={!slot2 ? () => setShowInviteModal(true) : undefined}
            />
          </View>

          {/* Row 2: Slot 3 (Kiri Bawah) & Slot 4 (Kanan Bawah - You) */}
          <View style={styles.gridRow}>
            <ParticipantCard
              name={slot3 ? (slot3.full_name || `@${slot3.username}` || 'Partner 3') : 'Menunggu Teman'}
              isSelf={false}
              isEmpty={!slot3}
              statusBadge={
                slot3
                  ? `${slot3.is_running ? '🍅' : '⏸️'} ${formatSeconds(slot3.time_left ?? 25 * 60)}`
                  : undefined
              }
              avatarUrl={slot3?.avatar_url}
              onPress={!slot3 ? () => setShowInviteModal(true) : undefined}
            />
            <ParticipantCard
              name="You"
              isSelf={true}
              isEmpty={false}
              statusBadge={`${isRunning ? '🍅' : '⏸️'} ${timeFormatted}`}
              isCameraOff={isCameraOff}
              isMicMuted={isMicMuted}
              avatarUrl={currentUser?.avatar_url}
            />
          </View>
        </View>

        {/* ==================== 5. FLOATING BOTTOM CONTROLS DOCK ==================== */}
        <View style={styles.bottomDock}>
          {/* Mute Mic */}
          <TouchableOpacity
            style={[styles.dockBtn, isMicMuted && styles.dockBtnMuted]}
            onPress={() => setIsMicMuted(!isMicMuted)}
            activeOpacity={0.8}
          >
            <Text style={styles.dockBtnIcon}>{isMicMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.dockBtnLabel}>{isMicMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Toggle Video */}
          <TouchableOpacity
            style={[styles.dockBtn, isCameraOff && styles.dockBtnMuted]}
            onPress={() => setIsCameraOff(!isCameraOff)}
            activeOpacity={0.8}
          >
            <Text style={styles.dockBtnIcon}>{isCameraOff ? '🚫' : '📹'}</Text>
            <Text style={styles.dockBtnLabel}>{isCameraOff ? 'Cam Off' : 'Cam On'}</Text>
          </TouchableOpacity>

          {/* Reset Pomodoro */}
          <TouchableOpacity
            style={styles.dockBtn}
            onPress={resetTimer}
            activeOpacity={0.8}
          >
            <Text style={styles.dockBtnIcon}>🔄</Text>
            <Text style={styles.dockBtnLabel}>Reset</Text>
          </TouchableOpacity>

          {/* Keluar dari Sesi */}
          <TouchableOpacity
            style={[styles.dockBtn, styles.dockBtnLeave]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.dockBtnIcon}>📞</Text>
            <Text style={[styles.dockBtnLabel, { color: '#ef4444' }]}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

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
});
