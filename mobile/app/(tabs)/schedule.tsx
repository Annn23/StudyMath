import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getStudySessions, getCurrentUser, updateSessionStatus } from '../../lib/api';
import { StudySession } from '../../types';
import { router, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { parseSafeDate } from '../../lib/date';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Menunggu',
  confirmed: '✅ Dikonfirmasi',
  completed: '🎓 Selesai',
  cancelled: '❌ Dibatalkan',
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');

  useFocusEffect(useCallback(() => { loadSessions(); }, []));

  const openSessionActions = (item: StudySession) => {
    const isOrganizer = item.organizer_id === userId;
    const partner = isOrganizer ? item.partner : item.organizer;
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (item.meeting_link) {
      buttons.push({ text: '🔗 Buka Link Meeting', onPress: () => Linking.openURL(item.meeting_link!) });
    }
    if (item.status === 'confirmed') {
      buttons.push({
        text: '🎓 Tandai Selesai',
        onPress: () => {
          updateSessionStatus(item.id, 'completed').then(() => {
            loadSessions();
            if (partner?.id) {
              setTimeout(() => {
                Alert.alert(
                  'Sesi Selesai! 🎉',
                  `Bagus sekali! Ingin memberikan ulasan & rating untuk ${partner.full_name || 'partner belajarmu'} sekarang?`,
                  [
                    { text: 'Nanti', style: 'cancel' },
                    {
                      text: 'Beri Ulasan ⭐',
                      onPress: () => router.push(`/review?sessionId=${item.id}&partnerId=${partner.id}&partnerName=${encodeURIComponent(partner.full_name || '')}&sessionTitle=${encodeURIComponent(item.title)}`),
                    },
                  ]
                );
              }, 400);
            }
          });
        },
      });
    }
    if (item.status === 'completed' && partner?.id) {
      buttons.push({
        text: '⭐ Beri / Cek Ulasan',
        onPress: () => router.push(`/review?sessionId=${item.id}&partnerId=${partner.id}&partnerName=${encodeURIComponent(partner.full_name || '')}&sessionTitle=${encodeURIComponent(item.title)}`),
      });
    }
    if (item.status === 'pending' || item.status === 'confirmed') {
      buttons.push({ text: '❌ Batalkan Sesi', style: 'destructive', onPress: () => updateSessionStatus(item.id, 'cancelled').then(loadSessions) });
    }
    buttons.push({ text: 'Tutup', style: 'cancel' });
    Alert.alert(item.title, item.description || 'Pilih aksi untuk sesi ini', buttons);
  };

  const loadSessions = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) return;
    setUserId(user.id);
    const data = await getStudySessions(user.id);
    setSessions(data);
    setLoading(false);
  };

  const filteredSessions = sessions.filter(s => {
    if (filter === 'upcoming') return s.status === 'pending' || s.status === 'confirmed';
    if (filter === 'completed') return s.status === 'completed';
    return true;
  });

  const renderSession = ({ item }: { item: StudySession }) => {
    const isOrganizer = item.organizer_id === userId;
    const partner = isOrganizer ? item.partner : item.organizer;
    const scheduledDate = parseSafeDate(item.scheduled_at);
    const isPending = item.status === 'pending' && !isOrganizer;

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        activeOpacity={0.9}
        onPress={() => openSessionActions(item)}
      >
        {/* Status Bar */}
        <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[item.status] }]} />

        <View style={styles.sessionContent}>
          <View style={styles.sessionTop}>
            <Text style={styles.sessionTitle}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>

          <View style={styles.sessionMeta}>
            <Text style={styles.sessionDate}>
              📅 {format(scheduledDate, 'EEEE, d MMMM yyyy', { locale: id })}
            </Text>
            <Text style={styles.sessionTime}>
              🕐 {format(scheduledDate, 'HH:mm')} ({item.duration_minutes} menit)
            </Text>
            {item.subject && <Text style={styles.sessionSubject}>📚 {item.subject}</Text>}
            {partner && (
              <Text style={styles.sessionPartner}>
                👤 {isOrganizer ? 'Dengan' : 'Diundang oleh'}: {partner.full_name}
              </Text>
            )}
          </View>

          {/* Actions for pending invites */}
          {isPending && (
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => updateSessionStatus(item.id, 'cancelled').then(loadSessions)}
              >
                <Text style={styles.rejectBtnText}>❌ Tolak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => updateSessionStatus(item.id, 'confirmed').then(loadSessions)}
              >
                <LinearGradient colors={[Colors.accent, '#60b8e8']} style={styles.acceptGradient}>
                  <Text style={styles.acceptBtnText}>✅ Terima</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Action for completed sessions: Beri Ulasan */}
          {item.status === 'completed' && partner?.id && (
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.reviewBtn}
                onPress={() => router.push(`/review?sessionId=${item.id}&partnerId=${partner.id}&partnerName=${encodeURIComponent(partner.full_name || '')}&sessionTitle=${encodeURIComponent(item.title)}`)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.reviewGradient}>
                  <Text style={styles.reviewBtnText}>⭐ Beri Ulasan & Rating</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Jadwal Belajar 📅</Text>
          <Text style={styles.headerSub}>Kelola sesi belajarmu</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/new-session')}
        >
          <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.addBtnGradient}>
            <Text style={styles.addBtnText}>+ Buat</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['upcoming', 'all', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'upcoming' ? '📌 Mendatang' : f === 'all' ? '📋 Semua' : '✅ Selesai'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>Belum ada jadwal</Text>
          <Text style={styles.emptySubtitle}>Buat sesi belajar bersama partnermu!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={item => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.primary },
  headerSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  addBtnGradient: { paddingHorizontal: 18, paddingVertical: 10 },
  addBtnText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.white },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 8, marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.2)',
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  sessionCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, ...Shadow.small, overflow: 'hidden',
  },
  statusBar: { width: 5 },
  sessionContent: { flex: 1, padding: Spacing.md },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  sessionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusText: { fontFamily: Fonts.semiBold, fontSize: 11 },
  sessionMeta: { gap: 4 },
  sessionDate: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textPrimary },
  sessionTime: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  sessionSubject: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.primary },
  sessionPartner: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  sessionActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.full, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.error, backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rejectBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.error },
  acceptBtn: { flex: 1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  acceptGradient: { paddingVertical: 10, alignItems: 'center' },
  acceptBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.white },
  reviewBtn: { flex: 1, borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadow.small },
  reviewGradient: { paddingVertical: 10, alignItems: 'center' },
  reviewBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.white },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
