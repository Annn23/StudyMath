import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getProfile, getUserReviews, getCurrentUser, getOrCreateConversation, actionOnProfile } from '../../lib/api';
import { Profile, Review } from '../../types';
import { formatRelativeTime } from '../../lib/date';
import { getMbtiInfo } from '../../constants/mbti';

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id: targetUserId } = useLocalSearchParams<{ id: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    init();
  }, [targetUserId]);

  const init = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (user) setCurrentUserId(user.id);

    if (targetUserId) {
      const [p, r] = await Promise.all([
        getProfile(targetUserId),
        getUserReviews(targetUserId),
      ]);
      setProfile(p);
      setReviews(r);
    }
    setLoading(false);
  };

  const [liking, setLiking] = useState(false);

  const handleStartChat = async () => {
    if (!currentUserId || !targetUserId || openingChat) return;
    setOpeningChat(true);
    const convId = await getOrCreateConversation(currentUserId, targetUserId);
    setOpeningChat(false);
    if (convId) {
      router.push(`/chat-detail/${convId}`);
    }
  };

  const handleLikeUser = async () => {
    if (!currentUserId || !targetUserId || liking) return;
    setLiking(true);
    const { error } = await actionOnProfile(currentUserId, targetUserId, 'like');
    setLiking(false);

    if (error) {
      Alert.alert('Gagal', error.message || 'Tidak dapat mengajak belajar.');
      return;
    }

    Alert.alert(
      'Partner Belajar Terhubung! 🎉',
      `Kamu dan ${profile?.full_name || 'teman belajarmu'} sekarang sudah terhubung! Mau langsung jadwalkan sesi belajar atau mengobrol?`,
      [
        { text: 'Nanti', style: 'cancel' },
        {
          text: 'Jadwalkan Sesi 📅',
          onPress: () => router.push(`/new-session?partner=${targetUserId}`),
        },
        {
          text: 'Chat 💬',
          onPress: handleStartChat,
        },
      ]
    );
  };

  const avatarUri = profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=cd4f75&color=fff&size=250`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profil Partner</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Profil pengguna tidak ditemukan.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              {profile.is_available && <View style={styles.onlineDot} />}
            </View>
            <Text style={styles.name}>{profile.full_name || 'Pengguna'}</Text>
            {profile.username && <Text style={styles.username}>@{profile.username}</Text>}
            {profile.location && <Text style={styles.location}>📍 {profile.location}</Text>}
            {profile.university && (
              <View style={styles.univHeaderRow}>
                <Text style={styles.univHeaderText}>🏛️ {profile.university}</Text>
              </View>
            )}

            {/* Badges */}
            <View style={styles.badgeRow}>
              {profile.university && (
                <View style={[styles.badge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1 }]}>
                  <Text style={[styles.badgeText, { color: '#1d4ed8', fontFamily: Fonts.bold }]}>
                    🏛️ {profile.university}
                  </Text>
                </View>
              )}
              {profile.study_style && (
                <View style={[styles.badge, { backgroundColor: 'rgba(96,184,232,0.15)' }]}>
                  <Text style={[styles.badgeText, { color: '#0284c7' }]}>
                    {profile.study_style === 'visual' ? '👁️ Visual' :
                      profile.study_style === 'auditory' ? '👂 Auditori' :
                      profile.study_style === 'reading' ? '📖 Membaca' : '✋ Kinestetik'}
                  </Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: profile.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)' }]}>
                <Text style={[styles.badgeText, { color: profile.is_available ? '#059669' : '#6b7280' }]}>
                  {profile.is_available ? '● Siap Belajar' : '○ Istirahat'}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  ⭐ {reviews.length > 0
                    ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)
                    : (profile.average_rating && profile.average_rating > 0 ? profile.average_rating.toFixed(1) : '—')}
                </Text>
                <Text style={styles.statLbl}>{reviews.length} Ulasan</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statVal}>📚 {profile.total_sessions || 0}</Text>
                <Text style={styles.statLbl}>Sesi Selesai</Text>
              </View>
            </View>

            {/* Bio */}
            {profile.bio && (
              <View style={styles.bioBox}>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </View>
            )}

            {/* Subjects */}
            {profile.subjects && profile.subjects.length > 0 && (
              <View style={styles.subjectsBox}>
                <Text style={styles.boxTitle}>Mata Kuliah yang Dikuasai:</Text>
                <View style={styles.tagsWrap}>
                  {profile.subjects.map(s => (
                    <View key={s} style={styles.tag}>
                      <Text style={styles.tagText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* MBTI Personality Showcase */}
            {profile.mbti && getMbtiInfo(profile.mbti) && (() => {
              const mbtiData = getMbtiInfo(profile.mbti)!;
              return (
                <View style={[styles.mbtiBox, { borderColor: mbtiData.color }]}>
                  <View style={styles.mbtiBoxTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, marginRight: 8 }}>{mbtiData.emoji}</Text>
                      <View>
                        <Text style={{ fontFamily: Fonts.bold, fontSize: 15, color: Colors.textPrimary }}>
                          {mbtiData.code} — {mbtiData.name}
                        </Text>
                        <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted }}>
                          {mbtiData.archetype}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.mbtiTagline}>"{mbtiData.tagline}"</Text>
                  <Text style={styles.mbtiStudyText} numberOfLines={3}>
                    🎯 <Text style={{ fontFamily: Fonts.bold }}>Gaya Belajar:</Text> {mbtiData.studyStyle}
                  </Text>
                  <Text style={styles.mbtiPartnerText}>
                    🤝 Partner Cocok: <Text style={{ fontFamily: Fonts.bold }}>{mbtiData.compatibleMbti.join(', ')}</Text>
                  </Text>
                </View>
              );
            })()}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnLike}
                onPress={handleLikeUser}
                disabled={liking}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnLikeText}>{liking ? '...' : '🤝 Ajak Belajar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={handleStartChat}
                disabled={openingChat}
                activeOpacity={0.8}
              >
                {openingChat ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Text style={styles.actionBtnSecondaryText}>💬 Chat</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => router.push(`/new-session?partner=${profile.id}`)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.actionBtnGradient}>
                  <Text style={styles.actionBtnPrimaryText}>📅 Sesi</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewHeaderRow}>
              <Text style={styles.reviewSectionTitle}>Ulasan & Rating ({reviews.length})</Text>
              <TouchableOpacity
                onPress={() => router.push(`/review?partnerId=${profile.id}&partnerName=${encodeURIComponent(profile.full_name || '')}`)}
              >
                <Text style={styles.writeReviewLink}>+ Beri Ulasan</Text>
              </TouchableOpacity>
            </View>

            {reviews.length === 0 ? (
              <View style={styles.noReviews}>
                <Text style={styles.noReviewsEmoji}>⭐</Text>
                <Text style={styles.noReviewsTitle}>Belum Ada Ulasan</Text>
                <Text style={styles.noReviewsSubtitle}>
                  Jadilah yang pertama belajar dan memberikan rating untuk {profile.full_name?.split(' ')[0] || 'partner ini'}!
                </Text>
              </View>
            ) : (
              reviews.map(rev => {
                const reviewerName = rev.reviewer?.full_name || 'Partner Belajar';
                const reviewerAvatar = rev.reviewer?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=93dcfc&color=1a5f7a`;

                return (
                  <View key={rev.id} style={styles.reviewItem}>
                    <View style={styles.reviewItemTop}>
                      <Image source={{ uri: reviewerAvatar }} style={styles.reviewerAvatar} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewerName}>{reviewerName}</Text>
                        <Text style={styles.reviewTime}>{formatRelativeTime(rev.created_at)}</Text>
                      </View>
                      <View style={styles.starBadge}>
                        <Text style={styles.starBadgeText}>
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </Text>
                      </View>
                    </View>
                    {rev.comment && (
                      <Text style={styles.reviewComment}>{rev.comment}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(205,79,117,0.08)',
  },
  backBtn: { padding: 6 },
  backIcon: { fontSize: 24, color: Colors.primary, fontWeight: '700' },
  topBarTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFoundText: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textMuted },
  scrollContent: { padding: Spacing.md, paddingBottom: 50 },

  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.md,
    ...Shadow.small,
  },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Colors.secondary },
  onlineDot: {
    position: 'absolute', bottom: 3, right: 3, width: 18, height: 18,
    borderRadius: 9, backgroundColor: '#10b981', borderWidth: 2.5, borderColor: Colors.white,
  },
  name: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.textPrimary, marginBottom: 2 },
  username: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.primary, marginBottom: 4 },
  location: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  univHeaderRow: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 10,
  },
  univHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#1d4ed8',
  },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 },
  badge: {
    backgroundColor: 'rgba(205,79,117,0.1)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  badgeText: { fontFamily: Fonts.semiBold, fontSize: 11, color: Colors.primary },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(205,79,117,0.08)', marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.textPrimary, marginBottom: 2 },
  statLbl: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(205,79,117,0.12)' },

  bioBox: {
    width: '100%', backgroundColor: '#fcf8fa', borderRadius: BorderRadius.md,
    padding: 12, marginBottom: 14,
  },
  bioText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },

  subjectsBox: { width: '100%', marginBottom: 16 },
  boxTitle: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(205,79,117,0.08)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(205,79,117,0.18)',
  },
  tagText: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.primary },

  actionRow: { flexDirection: 'row', width: '100%', gap: 8, marginTop: 4 },
  actionBtnLike: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.secondary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.1)',
  },
  actionBtnLikeText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.secondary },
  actionBtnSecondary: {
    flex: 1, paddingVertical: 12, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(205,79,117,0.05)',
  },
  actionBtnSecondaryText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.primary },
  actionBtnPrimary: { flex: 1.1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  actionBtnGradient: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimaryText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.white },

  reviewsSection: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl, padding: Spacing.md,
    ...Shadow.small,
  },
  reviewHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingHorizontal: 4,
  },
  reviewSectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary },
  writeReviewLink: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.primary },

  noReviews: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  noReviewsEmoji: { fontSize: 36, marginBottom: 8 },
  noReviewsTitle: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textPrimary, marginBottom: 4 },
  noReviewsSubtitle: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  reviewItem: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(205,79,117,0.08)',
  },
  reviewItemTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  reviewerAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Colors.secondary },
  reviewerName: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.textPrimary },
  reviewTime: { fontFamily: Fonts.regular, fontSize: 10, color: Colors.textMuted },
  starBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  starBadgeText: { fontSize: 12, color: '#f59e0b', letterSpacing: 1 },
  reviewComment: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },

  // MBTI Showcase Box
  mbtiBox: {
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.lg,
    padding: 12,
    borderWidth: 1.5,
    marginTop: 12,
    ...Shadow.small,
  },
  mbtiBoxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mbtiTagline: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  mbtiStudyText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 6,
  },
  mbtiPartnerText: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
});
