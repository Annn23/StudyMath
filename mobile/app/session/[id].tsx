import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import {
  getCurrentUser,
  getProfile,
  getSessionById,
  updateSessionStatus,
  notifySessionResponse,
  getOrCreateConversation,
} from '../../lib/api';
import { StudySession, Profile } from '../../types';
import { parseSafeDate } from '../../lib/date';

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Menunggu Konfirmasi',
    icon: '⏳',
    color: '#d97706',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  confirmed: {
    label: 'Sesi Dikonfirmasi',
    icon: '✅',
    color: '#059669',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  completed: {
    label: 'Sesi Telah Selesai',
    icon: '🎓',
    color: '#cd4f75',
    bg: 'rgba(205, 79, 117, 0.12)',
    border: 'rgba(205, 79, 117, 0.35)',
  },
  cancelled: {
    label: 'Sesi Dibatalkan',
    icon: '❌',
    color: '#dc2626',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
  },
};

const avatarOf = (p?: Profile | null, fallback = 'Teman') =>
  p?.avatar_url ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    p?.full_name || fallback
  )}&background=cd4f75&color=fff`;

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();

  const [session, setSession] = useState<StudySession | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  const loadSessionDetail = async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [user, s] = await Promise.all([
        getCurrentUser(),
        getSessionById(sessionId),
      ]);
      if (user) {
        const prof = await getProfile(user.id);
        if (prof) setCurrentUser(prof);
      }
      setSession(s);
    } catch (e) {
      console.warn('loadSessionDetail error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = () => {
    if (!session?.meeting_link) return;
    let url = session.meeting_link.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Gagal Membuka Link', 'Tautan pertemuan tidak valid atau tidak didukung.');
    });
  };

  const handleShare = async () => {
    if (!session) return;
    try {
      const scheduledDate = parseSafeDate(session.scheduled_at);
      const formattedDate = format(scheduledDate, 'EEEE, d MMMM yyyy HH:mm', {
        locale: localeId,
      });
      await Share.share({
        title: session.title,
        message: `Yuk belajar bareng di StudyMath!\n\n📚 ${session.title}\n📅 Waktu: ${formattedDate} (${session.duration_minutes} menit)${
          session.meeting_link ? `\n🔗 Link: ${session.meeting_link}` : ''
        }`,
      });
    } catch {
      // ignore
    }
  };

  const handleChatUser = async (targetId: string) => {
    if (!currentUser) return;
    try {
      const convId = await getOrCreateConversation(currentUser.id, targetId);
      if (convId) {
        router.push(`/chat-detail/${convId}`);
      }
    } catch {
      Alert.alert('Gagal', 'Tidak dapat membuka ruang obrolan.');
    }
  };

  const handleAcceptInvite = async () => {
    if (!session || !currentUser) return;
    setActionLoading(true);
    const { error } = await updateSessionStatus(session.id, 'confirmed');
    if (!error) {
      await notifySessionResponse(
        session.id,
        session.organizer_id,
        currentUser.full_name || 'Partner',
        true,
        session.title
      );
      setSession((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
      Alert.alert('Undangan Diterima! 🎉', 'Sesi belajar telah dikonfirmasi dan masuk ke jadwalmu.');
    } else {
      Alert.alert('Gagal', 'Gagal menerima undangan: ' + error.message);
    }
    setActionLoading(false);
  };

  const handleRejectInvite = () => {
    if (!session || !currentUser) return;
    Alert.alert(
      'Tolak Undangan Sesi?',
      'Apakah kamu yakin ingin menolak undangan sesi belajar ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tolak',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await updateSessionStatus(session.id, 'cancelled');
            if (!error) {
              await notifySessionResponse(
                session.id,
                session.organizer_id,
                currentUser.full_name || 'Partner',
                false,
                session.title
              );
              setSession((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              Alert.alert('Undangan Ditolak', 'Undangan telah ditolak.');
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  const handleMarkCompleted = async () => {
    if (!session) return;
    setActionLoading(true);
    const { error } = await updateSessionStatus(session.id, 'completed');
    setActionLoading(false);
    if (!error) {
      setSession((prev) => (prev ? { ...prev, status: 'completed' } : null));
      const targetPartner =
        session.organizer_id === currentUser?.id
          ? session.partner
          : session.organizer;

      if (targetPartner?.id) {
        Alert.alert(
          'Sesi Selesai! 🎉',
          `Bagus sekali! Ingin memberikan ulasan & rating untuk ${targetPartner.full_name || 'teman belajarmu'}?`,
          [
            { text: 'Nanti', style: 'cancel' },
            {
              text: 'Beri Ulasan ⭐',
              onPress: () =>
                router.push(
                  `/review?sessionId=${session.id}&partnerId=${targetPartner.id}&partnerName=${encodeURIComponent(
                    targetPartner.full_name || ''
                  )}&sessionTitle=${encodeURIComponent(session.title)}`
                ),
            },
          ]
        );
      }
    }
  };

  const handleCancelSession = () => {
    if (!session) return;
    Alert.alert(
      'Batalkan Sesi Belajar?',
      'Sesi ini akan dibatalkan untuk seluruh peserta.',
      [
        { text: 'Kembali', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await updateSessionStatus(session.id, 'cancelled');
            setSession((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
            setActionLoading(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memuat detail sesi belajar...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 50, marginBottom: 12 }}>📅</Text>
        <Text style={styles.notFoundTitle}>Sesi Belajar Tidak Ditemukan</Text>
        <Text style={styles.notFoundDesc}>
          Sesi ini mungkin telah dihapus atau kamu belum memiliki akses ke undangan ini.
        </Text>
        <TouchableOpacity
          style={styles.backHomeBtn}
          onPress={() => router.replace('/(tabs)/schedule')}
        >
          <Text style={styles.backHomeBtnText}>Ke Jadwal Belajar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOrganizer = currentUser?.id === session.organizer_id;
  const statusCfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending;
  const scheduledDate = parseSafeDate(session.scheduled_at);

  // Kumpulkan semua peserta (organizer + partner + participants)
  const allParticipantsMap = new Map<string, Profile>();
  if (session.partner) {
    allParticipantsMap.set(session.partner.id, session.partner);
  }
  if (session.participants && session.participants.length > 0) {
    session.participants.forEach((p) => {
      if (p.id !== session.organizer_id) {
        allParticipantsMap.set(p.id, p);
      }
    });
  }
  const partnersList = Array.from(allParticipantsMap.values());

  const isInvitedPartner =
    !isOrganizer &&
    currentUser &&
    (session.partner_id === currentUser.id ||
      session.partner_ids?.includes(currentUser.id) ||
      partnersList.some((p) => p.id === currentUser.id));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#fce4f3', '#f0f9ff', '#ffffff']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/schedule');
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Sesi Belajar</Text>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.shareIcon}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
          ]}
        >
          <Text style={styles.statusBannerIcon}>{statusCfg.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerLabel, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
            <Text style={styles.statusBannerSub}>
              {session.status === 'pending'
                ? isOrganizer
                  ? 'Menunggu konfirmasi kehadiran dari teman belajarmu'
                  : 'Kamu diundang untuk bergabung dalam sesi belajar ini'
                : session.status === 'confirmed'
                ? 'Sesi siap dilaksanakan sesuai jadwal yang disepakati'
                : session.status === 'completed'
                ? 'Sesi belajar bersama telah selesai dilaksanakan'
                : 'Sesi belajar telah dibatalkan'}
            </Text>
          </View>
        </View>

        {/* Main Info Card */}
        <View style={styles.card}>
          {session.subject && (
            <View style={styles.subjectChip}>
              <Text style={styles.subjectChipText}>📚 {session.subject}</Text>
            </View>
          )}

          <Text style={styles.sessionTitle}>{session.title}</Text>

          {/* Schedule Info */}
          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Text style={styles.metaIcon}>📅</Text>
            </View>
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>Hari & Tanggal</Text>
              <Text style={styles.metaVal}>
                {format(scheduledDate, 'EEEE, d MMMM yyyy', { locale: localeId })}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaIconWrap}>
              <Text style={styles.metaIcon}>🕐</Text>
            </View>
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>Waktu & Durasi</Text>
              <Text style={styles.metaVal}>
                Pukul {format(scheduledDate, 'HH:mm')} WIB ({session.duration_minutes} menit)
              </Text>
            </View>
          </View>

          {/* Meeting Link Card */}
          {session.meeting_link ? (
            <View style={styles.meetingLinkBox}>
              <View style={styles.meetingLinkHeader}>
                <Text style={styles.meetingLinkLabel}>🔗 Ruang Belajar Online</Text>
              </View>
              <Text style={styles.meetingLinkUrl} numberOfLines={1}>
                {session.meeting_link}
              </Text>
              <TouchableOpacity
                style={styles.openMeetingBtn}
                onPress={handleOpenLink}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.openMeetingGradient}
                >
                  <Text style={styles.openMeetingText}>🚀 Masuk Ruang Belajar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noMeetingBox}>
              <Text style={styles.noMeetingText}>
                💡 Belajar tatap muka langsung atau via ruang obrolan chat StudyMath.
              </Text>
            </View>
          )}

          {/* Notes / Description */}
          {session.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>📝 Catatan & Bahasan Materi</Text>
              <Text style={styles.descContent}>{session.description}</Text>
            </View>
          ) : null}
        </View>

        {/* Participants Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>👥 Peserta Sesi Belajar</Text>
          <View style={styles.participantCountBadge}>
            <Text style={styles.participantCountText}>
              {1 + partnersList.length} Orang
            </Text>
          </View>
        </View>

        {/* Organizer Card */}
        {session.organizer && (
          <View style={styles.memberCard}>
            <Image
              source={{ uri: avatarOf(session.organizer, 'Penyelenggara') }}
              style={styles.memberAvatar}
              contentFit="cover"
            />
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {session.organizer.full_name}
                </Text>
                <View style={styles.organizerBadge}>
                  <Text style={styles.organizerBadgeText}>👑 Penyelenggara</Text>
                </View>
              </View>
              <Text style={styles.memberSub} numberOfLines={1}>
                {session.organizer.university || session.organizer.grade_level || 'Mahasiswa'}
                {session.organizer.subjects && session.organizer.subjects.length > 0
                  ? ` • ${session.organizer.subjects.slice(0, 2).join(', ')}`
                  : ''}
              </Text>
            </View>
            {session.organizer.id !== currentUser?.id && (
              <TouchableOpacity
                style={styles.chatIconBtn}
                onPress={() => handleChatUser(session.organizer!.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.chatIconText}>💬</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Partners List */}
        {partnersList.map((p) => {
          const isMe = p.id === currentUser?.id;
          return (
            <View key={p.id} style={styles.memberCard}>
              <Image
                source={{ uri: avatarOf(p, 'Partner') }}
                style={styles.memberAvatar}
                contentFit="cover"
              />
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {p.full_name} {isMe ? '(Kamu)' : ''}
                  </Text>
                  <View style={styles.partnerBadge}>
                    <Text style={styles.partnerBadgeText}>
                      {session.status === 'confirmed' ? '✅ Bergabung' : '⏳ Diundang'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.memberSub} numberOfLines={1}>
                  {p.university || p.grade_level || 'Teman Belajar'}
                  {p.subjects && p.subjects.length > 0
                    ? ` • ${p.subjects.slice(0, 2).join(', ')}`
                    : ''}
                </Text>
              </View>
              {!isMe && (
                <TouchableOpacity
                  style={styles.chatIconBtn}
                  onPress={() => handleChatUser(p.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chatIconText}>💬</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Quick Shortcut to Full Schedule */}
        <TouchableOpacity
          style={styles.scheduleLinkBtn}
          onPress={() => router.push('/(tabs)/schedule')}
          activeOpacity={0.8}
        >
          <Text style={styles.scheduleLinkText}>📅 Lihat Semua Jadwal Belajar →</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {actionLoading ? (
          <View style={styles.actionLoadingWrap}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.actionLoadingText}>Menyimpan perubahan...</Text>
          </View>
        ) : session.status === 'pending' && isInvitedPartner ? (
          <View style={styles.inviteActionRow}>
            <TouchableOpacity
              style={styles.rejectOutlineBtn}
              onPress={handleRejectInvite}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectOutlineText}>❌ Tolak</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptSolidBtn}
              onPress={handleAcceptInvite}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                <Text style={styles.acceptSolidText}>✅ Terima Undangan</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : session.status === 'confirmed' ? (
          <View style={styles.confirmedActionRow}>
            <TouchableOpacity
              style={styles.markDoneBtn}
              onPress={handleMarkCompleted}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.markDoneGradient}
              >
                <Text style={styles.markDoneText}>🎓 Tandai Selesai</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelSessionBtn}
              onPress={handleCancelSession}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelSessionText}>❌ Batalkan</Text>
            </TouchableOpacity>
          </View>
        ) : session.status === 'completed' ? (
          <TouchableOpacity
            style={styles.reviewFullBtn}
            onPress={() => {
              const partner = isOrganizer ? session.partner : session.organizer;
              if (partner?.id) {
                router.push(
                  `/review?sessionId=${session.id}&partnerId=${partner.id}&partnerName=${encodeURIComponent(
                    partner.full_name || ''
                  )}&sessionTitle=${encodeURIComponent(session.title)}`
                );
              }
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#f59e0b', '#d97706']}
              style={styles.reviewGradient}
            >
              <Text style={styles.reviewBtnText}>⭐ Beri Ulasan & Rating</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backScheduleFullBtn}
            onPress={() => router.push('/(tabs)/schedule')}
            activeOpacity={0.85}
          >
            <Text style={styles.backScheduleFullText}>Kembali ke Jadwal Belajar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  notFoundTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  notFoundDesc: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  backHomeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  backHomeBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  backIcon: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.primary,
  },
  headerTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    color: Colors.primary,
  },
  shareBtn: {
    padding: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  shareIcon: {
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 14,
    ...Shadow.small,
  },
  statusBannerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  statusBannerLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 15,
    marginBottom: 2,
  },
  statusBannerSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: BorderRadius.xl,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.12)',
    ...Shadow.small,
  },
  subjectChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(147, 220, 252, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginBottom: 10,
  },
  subjectChipText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: '#0369a1',
  },
  sessionTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 22,
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(205, 79, 117, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  metaIcon: {
    fontSize: 18,
  },
  metaContent: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  metaVal: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  meetingLinkBox: {
    marginTop: 6,
    backgroundColor: 'rgba(147, 220, 252, 0.2)',
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(147, 220, 252, 0.6)',
  },
  meetingLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingLinkLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0369a1',
  },
  meetingLinkUrl: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#0284c7',
    marginBottom: 10,
  },
  openMeetingBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  openMeetingGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  openMeetingText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.white,
  },
  noMeetingBox: {
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BorderRadius.md,
    padding: 10,
  },
  noMeetingText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  descBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(205, 79, 117, 0.08)',
  },
  descLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  descContent: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  participantCountBadge: {
    backgroundColor: 'rgba(205, 79, 117, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  participantCountText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.08)',
    ...Shadow.small,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  memberInfo: {
    flex: 1,
    marginRight: 8,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  memberName: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  organizerBadge: {
    backgroundColor: 'rgba(205, 79, 117, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  organizerBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: Colors.primary,
  },
  partnerBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  partnerBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: '#059669',
  },
  memberSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  chatIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(205, 79, 117, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: {
    fontSize: 18,
  },
  scheduleLinkBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  scheduleLinkText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(205, 79, 117, 0.12)',
    paddingTop: 12,
    paddingHorizontal: Spacing.md,
    ...Shadow.medium,
  },
  actionLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  actionLoadingText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inviteActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectOutlineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectOutlineText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#ef4444',
  },
  acceptSolidBtn: {
    flex: 2,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  acceptGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptSolidText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  confirmedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  markDoneBtn: {
    flex: 2,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  markDoneGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDoneText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  cancelSessionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cancelSessionText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#ef4444',
  },
  reviewFullBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  reviewGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  backScheduleFullBtn: {
    backgroundColor: 'rgba(205, 79, 117, 0.1)',
    borderRadius: BorderRadius.full,
    paddingVertical: 13,
    alignItems: 'center',
  },
  backScheduleFullText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.primary,
  },
});
