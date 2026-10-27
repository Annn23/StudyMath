import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getProfile, updateProfile, uploadAvatar, getUserReviews, getCurrentUser, signOut } from '../../lib/api';
import { Profile, Review } from '../../types';
import { getMbtiInfo } from '../../constants/mbti';
import { router, useFocusEffect } from 'expo-router';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const loadProfile = async () => {
    const user = await getCurrentUser();
    if (!user) { router.replace('/welcome'); return; }
    const [p, r] = await Promise.all([getProfile(user.id), getUserReviews(user.id)]);
    setProfile(p);
    setReviews(r);
    setLoading(false);
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izinkan akses galeri untuk memilih foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true, aspect: [1, 1], quality: 0.6,
      base64: true,
    });
    if (!result.canceled && profile) {
      const asset = result.assets[0];
      const selectedUri = asset.uri;

      // Optimistic update — tampilkan foto lokal langsung
      setLocalAvatarUri(selectedUri);
      setUploadingAvatar(true);

      const { url, error } = await uploadAvatar(profile.id, asset.base64 || '');
      if (!error && url) {
        console.log('[Avatar] Upload berhasil, URL:', url);
        await updateProfile(profile.id, { avatar_url: url });
        setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
        // Ganti ke Supabase URL setelah berhasil
        setLocalAvatarUri(null);
      } else {
        console.error('[Avatar] Upload error:', JSON.stringify(error));
        // Tetap tampilkan foto lokal, tapi kasih tahu ada error sync
        Alert.alert(
          'Upload Gagal',
          `Foto tampil sementara di lokal, tapi gagal disimpan ke server.\nError: ${(error as any)?.message || 'Unknown'}`
        );
      }
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/welcome'); },
      },
    ]);
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    const updated = { is_available: !profile.is_available };
    await updateProfile(profile.id, updated);
    setProfile(prev => prev ? { ...prev, ...updated } : prev);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <LinearGradient colors={['#fce4f3', '#e8f7ff']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Prioritas: local file URI (optimistic) > Supabase URL > placeholder
  const avatarUri = localAvatarUri
    || profile?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=cd4f75&color=fff&size=300`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil Saya</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/edit-profile')}>
              <Text style={styles.headerBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings')}>
              <Text style={styles.headerBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <View style={[styles.avatar, styles.avatarLoading]}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              <Image
                key={avatarUri}
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="none"
              />
            )}
            <View style={styles.avatarEditBtn}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{profile?.full_name || 'Nama belum diisi'}</Text>
          <Text style={styles.profileUsername}>@{profile?.username || 'username'}</Text>

          {profile?.location && (
            <Text style={styles.profileLocation}>📍 {profile.location}</Text>
          )}

          {profile?.university && (
            <View style={styles.profileUnivBadge}>
              <Text style={styles.profileUnivBadgeText}>🏛️ {profile.university}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.total_sessions || 0}</Text>
              <Text style={styles.statLabel}>Sesi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ⭐ {reviews.length > 0
                  ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)
                  : (profile?.average_rating && profile.average_rating > 0 ? profile.average_rating.toFixed(1) : '—')}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Ulasan</Text>
            </View>
          </View>

          {/* Availability Toggle */}
          <TouchableOpacity style={styles.availToggle} onPress={toggleAvailability}>
            <LinearGradient
              colors={profile?.is_available ? ['#10b981', '#059669'] : ['#9ca3af', '#6b7280']}
              style={styles.availToggleGradient}
            >
              <Text style={styles.availToggleText}>
                {profile?.is_available ? '● Tersedia untuk belajar' : '○ Sedang tidak tersedia'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tentang Aku</Text>
            <View style={styles.bioCard}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </View>
        )}

        {/* Subjects */}
        {profile?.subjects && profile.subjects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mata Pelajaran</Text>
            <View style={styles.subjectGrid}>
              {profile.subjects.map(s => (
                <View key={s} style={styles.subjectChip}>
                  <Text style={styles.subjectChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Kampus / Universitas */}
        {profile?.university && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kampus / Universitas</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardText}>🏛️ {profile.university}</Text>
            </View>
          </View>
        )}

        {/* Study Style */}
        {profile?.study_style && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gaya Belajar</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardText}>
                {profile.study_style === 'visual' ? '👁️ Visual — Belajar dengan gambar & diagram' :
                  profile.study_style === 'auditory' ? '👂 Auditori — Belajar dengan mendengarkan' :
                    profile.study_style === 'reading' ? '📖 Membaca — Belajar dengan teks & catatan' :
                      '✋ Kinestetik — Belajar dengan praktik langsung'}
              </Text>
            </View>
          </View>
        )}

        {/* MBTI Personality Showcase Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kepribadian MBTI</Text>
            {profile?.mbti && (
              <TouchableOpacity onPress={() => router.push('/mbti-test')} activeOpacity={0.7}>
                <Text style={styles.sectionActionText}>Ubah / Tes Ulang 🔄</Text>
              </TouchableOpacity>
            )}
          </View>

          {profile?.mbti && getMbtiInfo(profile.mbti) ? (
            (() => {
              const mbtiData = getMbtiInfo(profile.mbti)!;
              return (
                <TouchableOpacity
                  style={[styles.mbtiProfileCard, { borderColor: mbtiData.color }]}
                  onPress={() => router.push('/mbti-test')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[mbtiData.bgColor, '#ffffff']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.mbtiProfileTop}>
                    <View style={styles.mbtiBadgeWrap}>
                      <Text style={styles.mbtiProfileEmoji}>{mbtiData.emoji}</Text>
                      <View style={[styles.mbtiProfileCodeBadge, { backgroundColor: mbtiData.color }]}>
                        <Text style={styles.mbtiProfileCodeText}>{mbtiData.code}</Text>
                      </View>
                    </View>
                    <View style={[styles.mbtiArchetypeTag, { borderColor: mbtiData.color }]}>
                      <Text style={[styles.mbtiArchetypeTagText, { color: mbtiData.color }]}>
                        {mbtiData.archetype}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.mbtiProfileName}>{mbtiData.name}</Text>
                  <Text style={styles.mbtiProfileTagline}>"{mbtiData.tagline}"</Text>

                  <View style={styles.mbtiDivider} />

                  <Text style={styles.mbtiStudyTitle}>🎯 Gaya Belajar Matematika:</Text>
                  <Text style={styles.mbtiStudyText} numberOfLines={3}>
                    {mbtiData.studyStyle}
                  </Text>

                  <View style={styles.mbtiFooterRow}>
                    <Text style={styles.mbtiPartnerText}>
                      🤝 Partner Cocok: <Text style={styles.mbtiPartnerBold}>{mbtiData.compatibleMbti.join(', ')}</Text>
                    </Text>
                    <Text style={styles.mbtiDetailArrow}>Detail ›</Text>
                  </View>
                </TouchableOpacity>
              );
            })()
          ) : (
            <TouchableOpacity
              style={styles.mbtiEmptyCard}
              onPress={() => router.push('/mbti-test')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#fdf4ff', '#e0e7ff']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.mbtiEmptyContent}>
                <Text style={styles.mbtiEmptyEmoji}>🔮</Text>
                <View style={styles.mbtiEmptyTextWrap}>
                  <Text style={styles.mbtiEmptyTitle}>Temukan Tipe MBTI Kamu!</Text>
                  <Text style={styles.mbtiEmptySub}>
                    Cari tahu apakah kamu seorang ENFJ, INTJ, atau INFP serta gaya belajar matematika terbaikmu.
                  </Text>
                </View>
                <View style={styles.mbtiEmptyBtn}>
                  <Text style={styles.mbtiEmptyBtnText}>Mulai Tes 🚀</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ulasan ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyReview}>
              <Text style={styles.emptyReviewText}>Belum ada ulasan</Text>
            </View>
          ) : (
            reviews.slice(0, 3).map(review => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewerName}>{review.reviewer?.full_name || 'Pengguna'}</Text>
                  <Text style={styles.reviewRating}>{'⭐'.repeat(review.rating)}</Text>
                </View>
                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              </View>
            ))
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>🚪 Keluar dari Akun</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 120 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 8, paddingBottom: 16,
  },
  headerTitle: { fontFamily: Fonts.extraBold, fontSize: 26, color: Colors.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.8)', ...Shadow.small,
  },
  headerBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.textPrimary },
  profileCard: {
    marginHorizontal: Spacing.lg, backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', ...Shadow.medium, marginBottom: Spacing.md,
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.secondary },
  avatarLoading: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary,
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarEditIcon: { fontSize: 14 },
  profileName: { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.textPrimary, marginBottom: 2 },
  profileUsername: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted, marginBottom: 4 },
  profileLocation: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  profileUnivBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 16,
  },
  profileUnivBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#1d4ed8',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.primary },
  statLabel: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(205,79,117,0.2)' },
  availToggle: { borderRadius: BorderRadius.full, overflow: 'hidden', width: '100%' },
  availToggleGradient: { paddingVertical: 10, alignItems: 'center' },
  availToggleText: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.white },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary, marginBottom: 10 },
  bioCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadow.small,
  },
  bioText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent, borderWidth: 1.5, borderColor: Colors.accent,
  },
  subjectChipText: { fontFamily: Fonts.medium, fontSize: 13, color: '#1a5f7a' },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadow.small },
  infoCardText: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.textPrimary },
  reviewCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.small },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewerName: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.textPrimary },
  reviewRating: { fontSize: 14 },
  reviewComment: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  emptyReview: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center' },
  emptyReviewText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textMuted },
  signOutBtn: {
    marginHorizontal: Spacing.lg, marginTop: 8, paddingVertical: 14, borderRadius: BorderRadius.full,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.error, backgroundColor: 'rgba(239,68,68,0.08)',
  },
  signOutText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.error },

  // MBTI Showcase Styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionActionText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  mbtiProfileCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...Shadow.medium,
  },
  mbtiProfileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mbtiBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mbtiProfileEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  mbtiProfileCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  mbtiProfileCodeText: {
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  mbtiArchetypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  mbtiArchetypeTagText: {
    fontFamily: Fonts.bold,
    fontSize: 10.5,
  },
  mbtiProfileName: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  mbtiProfileTagline: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  mbtiDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 10,
  },
  mbtiStudyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  mbtiStudyText: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  mbtiFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mbtiPartnerText: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  mbtiPartnerBold: {
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  mbtiDetailArrow: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  mbtiEmptyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    ...Shadow.small,
  },
  mbtiEmptyContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  mbtiEmptyEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  mbtiEmptyTextWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  mbtiEmptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  mbtiEmptySub: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  mbtiEmptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  mbtiEmptyBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#ffffff',
  },
});
