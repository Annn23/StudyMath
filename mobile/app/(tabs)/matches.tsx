import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getMatches, getCurrentUser, getOrCreateConversation } from '../../lib/api';
import { Match } from '../../types';
import { router, useFocusEffect } from 'expo-router';

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { loadMatches(); }, []));

  const loadMatches = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) return;
    setUserId(user.id);
    const data = await getMatches(user.id);
    setMatches(data);
    setLoading(false);
  };

  const handleOpenChat = async (match: Match) => {
    if (!userId || !match.profile?.id) return;
    setOpeningChat(match.id);
    const convId = await getOrCreateConversation(userId, match.profile.id);
    setOpeningChat(null);
    if (!convId) {
      Alert.alert('Gagal', 'Tidak bisa membuka chat. Coba lagi.');
      return;
    }
    router.push(`/chat-detail/${convId}`);
  };

  const renderMatch = ({ item }: { item: Match }) => {
    const profile = item.profile;
    if (!profile) return null;
    const avatarUri = profile.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'User')}&background=cd4f75&color=fff&size=200`;
    const isOpening = openingChat === item.id;

    return (
      <TouchableOpacity
        style={styles.matchCard}
        activeOpacity={0.85}
        onPress={() => router.push(`/user/${profile.id}`)}
      >
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          {profile.is_available && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.matchInfo}>
          <Text style={styles.matchName}>{profile.full_name || 'Pengguna'}</Text>
          {profile.university ? (
            <Text style={styles.matchGrade}>🏛️ {profile.university}</Text>
          ) : null}
          {profile.subjects && profile.subjects.length > 0 && (
            <Text style={styles.matchSubjects} numberOfLines={1}>
              📚 {profile.subjects.slice(0, 2).join(', ')}
              {profile.subjects.length > 2 ? ` +${profile.subjects.length - 2}` : ''}
            </Text>
          )}
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>⭐ {profile.average_rating?.toFixed(1) || '—'}</Text>
            <Text style={styles.sessions}>• {profile.total_sessions} sesi</Text>
          </View>
          {profile.is_available && (
            <View style={styles.availBadge}>
              <Text style={styles.availText}>● Tersedia</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionCircleBtn}
            onPress={() => router.push(`/new-session?partner=${profile.id}`)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.sessionBtnContent}>
              <Text style={styles.sessionBtnText}>📅</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => handleOpenChat(item)}
            disabled={isOpening}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.chatBtnGradient}
            >
              {isOpening
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.chatBtnText}>💬</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Teman Belajar 👥</Text>
        <Text style={styles.headerSub}>
          {matches.length} partner belajar terhubung
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>Belum ada teman belajar</Text>
          <Text style={styles.emptySubtitle}>
            Cari teman belajar via username atau mata kuliah untuk mulai belajar bareng!
          </Text>
          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={() => router.push('/(tabs)/home')}
          >
            <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.discoverGradient}>
              <Text style={styles.discoverText}>Cari Teman Belajar 🔍</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          renderItem={renderMatch}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.primary },
  headerSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: Spacing.lg, paddingBottom: 100 },
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadow.small,
  },
  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: Colors.secondary },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, borderColor: Colors.white,
  },
  matchInfo: { flex: 1 },
  matchName: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary, marginBottom: 2 },
  matchGrade: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.primary, marginBottom: 3 },
  matchSubjects: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 3 },
  ratingRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  rating: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.yellow },
  sessions: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted },
  availBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  availText: { fontFamily: Fonts.medium, fontSize: 11, color: '#059669' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionCircleBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.25)',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Shadow.small,
  },
  sessionBtnContent: { alignItems: 'center', justifyContent: 'center' },
  sessionBtnText: { fontSize: 18 },
  chatBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  chatBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatBtnText: { fontSize: 18 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  discoverBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  discoverGradient: { paddingHorizontal: 32, paddingVertical: 14 },
  discoverText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.white },
});
