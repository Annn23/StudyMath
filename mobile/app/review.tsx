import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getCurrentUser, getProfile, createReview, getSessionReview } from '../lib/api';
import { Profile } from '../types';

const RATING_LABELS = [
  '',
  '😞 Kurang Puas',
  '😐 Cukup Baik',
  '🙂 Menyenangkan',
  '😊 Sangat Membantu',
  '🤩 Luar Biasa!',
];

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId, partnerId, partnerName, sessionTitle } = useLocalSearchParams<{
    sessionId?: string;
    partnerId: string;
    partnerName?: string;
    sessionTitle?: string;
  }>();

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [partner, setPartner] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    init();
  }, [partnerId, sessionId]);

  const init = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      router.replace('/welcome');
      return;
    }
    setUserId(user.id);

    // Cek apakah sudah pernah mengulas sesi ini
    if (sessionId) {
      const existing = await getSessionReview(sessionId, user.id);
      if (existing) {
        setAlreadyReviewed(true);
        setRating(existing.rating);
        setComment(existing.comment || '');
      }
    }

    // Ambil profil partner
    if (partnerId) {
      const p = await getProfile(partnerId);
      setPartner(p);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!userId || !partnerId) return;
    if (rating === 0) {
      Alert.alert('Perhatian', 'Silakan pilih jumlah bintang terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    const { error } = await createReview({
      reviewer_id: userId,
      reviewed_id: partnerId,
      session_id: sessionId || null,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Sudah Diulas', 'Kamu sudah memberikan ulasan untuk sesi ini sebelumnya.');
        router.back();
      } else {
        Alert.alert('Gagal Mengirim', error.message || 'Terjadi kesalahan saat menyimpan ulasan.');
      }
      return;
    }

    Alert.alert(
      'Terima Kasih! 🎉',
      'Ulasan dan rating darimu sangat berharga untuk meningkatkan kualitas belajar partner.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const avatarUri = partner?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.full_name || partnerName || 'User')}&background=cd4f75&color=fff&size=200`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Beri Ulasan & Rating</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card Info Partner */}
          <View style={styles.partnerCard}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            <Text style={styles.partnerName}>{partner?.full_name || partnerName || 'Partner Belajar'}</Text>
            {partner?.grade_level && (
              <Text style={styles.partnerGrade}>Jenjang: {partner.grade_level}</Text>
            )}
            {sessionTitle && (
              <View style={styles.sessionBadge}>
                <Text style={styles.sessionBadgeText} numberOfLines={1}>📖 {sessionTitle}</Text>
              </View>
            )}
          </View>

          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.sectionLabel}>Bagaimana pengalaman belajarmu?</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => !alreadyReviewed && setRating(star)}
                  activeOpacity={0.7}
                  disabled={alreadyReviewed}
                  style={styles.starBtn}
                >
                  <Text style={[styles.starIcon, rating >= star ? styles.starActive : styles.starInactive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingDesc}>{RATING_LABELS[rating]}</Text>
          </View>

          {/* Comment Section */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionLabel}>Komentar / Masukan (Opsional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder={alreadyReviewed ? 'Tidak ada komentar' : 'Tuliskan kesan belajarmu bersama partner, materi yang dipelajari, atau apresiasi...'}
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!alreadyReviewed}
              textAlignVertical="top"
            />
            {!alreadyReviewed && (
              <Text style={styles.charCount}>{comment.length}/500 karakter</Text>
            )}
          </View>

          {/* Submit Button */}
          {alreadyReviewed ? (
            <View style={styles.alreadyBox}>
              <Text style={styles.alreadyText}>✅ Sesi ini sudah pernah kamu beri ulasan.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.submitGradient}>
                {submitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.submitText}>Kirim Ulasan & Rating ⭐</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(205,79,117,0.08)',
  },
  backBtn: { padding: 6 },
  backIcon: { fontSize: 24, color: Colors.primary, fontWeight: '700' },
  headerTitle: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },

  partnerCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: Colors.secondary, marginBottom: 12 },
  partnerName: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textPrimary, marginBottom: 2 },
  partnerGrade: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  sessionBadge: {
    backgroundColor: 'rgba(205,79,117,0.08)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.full, maxWidth: '90%',
  },
  sessionBadgeText: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.primary },

  ratingSection: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.lg,
    ...Shadow.small,
  },
  sectionLabel: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textPrimary, marginBottom: 12 },
  starRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 44 },
  starActive: { color: '#f59e0b' },
  starInactive: { color: '#e5e7eb' },
  ratingDesc: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.primary },

  commentSection: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.small,
  },
  commentInput: {
    backgroundColor: '#f8f4ff',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.15)',
    padding: 14, fontFamily: Fonts.regular, fontSize: 14,
    color: Colors.textPrimary, minHeight: 110,
  },
  charCount: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 6 },

  submitBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadow.medium },
  submitGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },

  alreadyBox: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: BorderRadius.lg, padding: 16, alignItems: 'center',
  },
  alreadyText: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#059669' },
});
