import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import {
  getCurrentUser,
  getProfile,
  searchNearbyProfiles,
  actionOnProfile,
  getOrCreateConversation,
} from '../lib/api';
import { Profile, SUBJECTS } from '../types';

const POPULAR_UNIV_CHIPS = [
  'Semua Univ',
  'UI',
  'ITB',
  'UGM',
  'ITS',
  'UNAIR',
  'UNDIP',
  'UB',
  'UNPAD',
  'Telkom',
  'Binus',
];

const POPULAR_CITIES = [
  'Semua',
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
  'Semarang',
  'Medan',
  'Malang',
  'Solo',
  'Bali',
  'Makassar',
  'Palembang',
  'Bogor',
  'Depok',
  'Tangerang',
  'Bekasi',
];

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Semua');
  const [selectedUniv, setSelectedUniv] = useState('Semua Univ');
  const [selectedSubject, setSelectedSubject] = useState('Semua');

  // Data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [greetedUserIds, setGreetedUserIds] = useState<Set<string>>(new Set());

  // Load user profile on mount
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/welcome');
        return;
      }
      setMyUserId(user.id);
      const prof = await getProfile(user.id);
      setCurrentUser(prof);
    })();
  }, []);

  // Fetch profiles based on filters
  const fetchProfiles = useCallback(async () => {
    if (!myUserId) return;
    setLoading(true);
    try {
      const results = await searchNearbyProfiles({
        currentUserId: myUserId,
        searchQuery: searchQuery.trim() || undefined,
        location: selectedCity !== 'Semua' ? selectedCity : undefined,
        university: selectedUniv !== 'Semua Univ' ? selectedUniv : undefined,
        subject: selectedSubject !== 'Semua' ? selectedSubject : undefined,
      });
      setProfiles(results);
    } catch (e) {
      console.error('[NearbyScreen] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [myUserId, searchQuery, selectedCity, selectedUniv, selectedSubject]);

  useEffect(() => {
    if (myUserId) {
      const timeout = setTimeout(() => {
        fetchProfiles();
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [fetchProfiles, myUserId]);

  const handleSapa = async (partner: Profile) => {
    if (!myUserId) return;
    setActionLoadingId(partner.id);
    try {
      const { data, error } = await actionOnProfile(myUserId, partner.id, 'like');
      if (error) {
        Alert.alert('Gagal', error.message || 'Tidak dapat mengirim sapaan.');
      } else {
        setGreetedUserIds(prev => new Set(prev).add(partner.id));
        if (data?.is_matched) {
          Alert.alert(
            'Partner Belajar Terhubung! 🎉',
            `Kamu dan ${partner.full_name || 'teman belajarmu'} sekarang sudah terhubung! Mau langsung jadwalkan sesi belajar atau chat?`,
            [
              { text: 'Nanti', style: 'cancel' },
              {
                text: 'Jadwalkan Sesi 📅',
                onPress: () => router.push(`/new-session?partner=${partner.id}`),
              },
              {
                text: 'Chat 💬',
                onPress: () => handleDirectChat(partner),
              },
            ]
          );
        } else {
          Alert.alert('Ajakan Terkirim! 🤝', `Ajakan belajar berhasil dikirim ke ${partner.full_name || 'teman'}.`);
        }
      }
    } catch {
      Alert.alert('Error', 'Terjadi kesalahan saat menyapa.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDirectChat = async (partner: Profile) => {
    if (!myUserId) return;
    setActionLoadingId(partner.id);
    try {
      const convId = await getOrCreateConversation(myUserId, partner.id);
      if (convId) {
        router.push(`/chat-detail/${convId}`);
      } else {
        Alert.alert('Gagal', 'Tidak dapat membuka percakapan.');
      }
    } catch {
      Alert.alert('Error', 'Terjadi kesalahan saat membuka chat.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('Semua');
    setSelectedUniv('Semua Univ');
    setSelectedSubject('Semua');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCity !== 'Semua' ||
    selectedUniv !== 'Semua Univ' ||
    selectedSubject !== 'Semua';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Teman di Sekitar 📍</Text>
          <Text style={styles.headerSubtitle}>Cari partner belajar terdekat atau ketik nama teman</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfiles} activeOpacity={0.7}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Lokasi Profil Saya Banner */}
      {currentUser && !currentUser.location && (
        <View style={styles.locationAlertBanner}>
          <View style={styles.locationAlertTextWrap}>
            <Text style={styles.locationAlertTitle}>📍 Lokasimu belum diset</Text>
            <Text style={styles.locationAlertSub}>Atur kotamu agar teman sekitar mudah menemukanmu!</Text>
          </View>
          <TouchableOpacity
            style={styles.locationAlertBtn}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.locationAlertBtnText}>Atur ⚙️</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentUser && currentUser.location && (
        <View style={styles.myLocationPill}>
          <Text style={styles.myLocationText}>
            📍 Lokasimu: <Text style={styles.myLocationBold}>{currentUser.location}</Text>
          </Text>
          <TouchableOpacity onPress={() => router.push('/edit-profile')}>
            <Text style={styles.myLocationChange}>Ubah</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input Box */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama teman, @username, atau kata kunci..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* PANEL FILTER WILAYAH / KOTA & KATEGORI */}
      <View style={styles.filterCard}>
        {/* Header Bagian Kota */}
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterTitleBadge}>
            <Text style={styles.filterTitleIcon}>📍</Text>
            <Text style={styles.filterTitleText}>Pilih Wilayah / Kota</Text>
          </View>
          {selectedCity !== 'Semua' && (
            <TouchableOpacity onPress={() => setSelectedCity('Semua')} style={styles.activeCityBadge}>
              <Text style={styles.activeCityText}>{selectedCity} ✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scroll Horizontal Kota */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityScrollContent}
          style={styles.cityScrollView}
        >
          {POPULAR_CITIES.map(city => {
            const isSelected = selectedCity === city;
            return (
              <TouchableOpacity
                key={city}
                style={[styles.cityChip, isSelected && styles.cityChipActive]}
                onPress={() => setSelectedCity(city)}
                activeOpacity={0.8}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={[Colors.secondary, Colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cityChipGradient}
                  >
                    <Text style={styles.cityChipTextActive}>
                      {city === 'Semua' ? '🌍 Semua Kota' : `📍 ${city}`}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.cityChipInner}>
                    <Text style={styles.cityChipText}>
                      {city === 'Semua' ? '🌍 Semua Kota' : `📍 ${city}`}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter Univ & Matkul */}
        <View style={styles.secondaryFilterDivider} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagScrollContent}
          style={styles.tagScrollView}
        >
          {/* Universitas */}
          {POPULAR_UNIV_CHIPS.map(univ => {
            const isSelected = selectedUniv === univ;
            return (
              <TouchableOpacity
                key={`univ-${univ}`}
                style={[styles.tagChip, isSelected && styles.tagChipActive]}
                onPress={() => setSelectedUniv(univ)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}>
                  {univ === 'Semua Univ' ? '🏛️ Semua Univ' : `🏛️ ${univ}`}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.chipDivider} />

          {/* Mata Kuliah */}
          {['Semua', ...SUBJECTS.slice(0, 10)].map(subj => {
            const isSelected = selectedSubject === subj;
            return (
              <TouchableOpacity
                key={`subj-${subj}`}
                style={[styles.tagChip, isSelected && styles.tagChipActive]}
                onPress={() => setSelectedSubject(subj)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}>
                  {subj === 'Semua' ? '📚 Semua Matkul' : subj}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Header Info */}
      <View style={styles.resultsInfoRow}>
        <Text style={styles.resultsCountText}>
          {loading ? 'Mencari partner belajar...' : `✨ ${profiles.length} teman belajar ditemukan`}
        </Text>
        {hasActiveFilters && (
          <TouchableOpacity onPress={handleResetFilters} style={styles.resetFilterBtn}>
            <Text style={styles.resetFilterText}>Reset Semua Filter ✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List of Profiles */}
      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat teman di sekitar...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          data={profiles}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>Tidak ada teman ditemukan</Text>
              <Text style={styles.emptyDesc}>
                {searchQuery
                  ? `Tidak ada profil dengan kata kunci "${searchQuery}".`
                  : 'Belum ada teman di lokasi/filter yang dipilih.'}
              </Text>
              <Text style={styles.emptyTip}>
                💡 <Text style={styles.emptyTipBold}>Tips:</Text> Teman kamu mungkin belum mengatur nama kotanya
                atau universitasnya di profil. Coba ketik namanya langsung di kolom pencarian di atas atau klik tombol di bawah.
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.resetBtnPrimary} onPress={handleResetFilters}>
                  <LinearGradient
                    colors={[Colors.secondary, Colors.primary]}
                    style={styles.resetBtnGradient}
                  >
                    <Text style={styles.resetBtnText}>Bersihkan Semua Filter 🔄</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const isGreeted = greetedUserIds.has(item.id);
            const isActing = actionLoadingId === item.id;
            const avatarUrl =
              item.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                item.full_name || 'User'
              )}&background=cd4f75&color=fff&size=200`;

            return (
              <View style={styles.profileCard}>
                {/* Main Card Header (Tappable to see full profile) */}
                <TouchableOpacity
                  style={styles.cardHeaderArea}
                  onPress={() => router.push(`/user/${item.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                    {item.is_available && <View style={styles.onlineBadge} />}
                  </View>

                  <View style={styles.cardMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.fullName} numberOfLines={1}>
                        {item.full_name || 'Teman Belajar'}
                      </Text>
                      {item.average_rating > 0 && (
                        <View style={styles.ratingBadge}>
                          <Text style={styles.ratingStar}>⭐</Text>
                          <Text style={styles.ratingValue}>
                            {Number(item.average_rating).toFixed(1)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.username && (
                      <Text style={styles.username}>@{item.username}</Text>
                    )}

                    <View style={styles.badgesRow}>
                      {item.university ? (
                        <View style={styles.univBadge}>
                          <Text style={styles.univBadgeText} numberOfLines={1}>
                            🏛️ {item.university}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.locationBadge}>
                        <Text style={styles.locationBadgeText}>
                          📍 {item.location || 'Lokasi belum diatur'}
                        </Text>
                      </View>
                      {item.study_style && (
                        <View style={styles.styleBadge}>
                          <Text style={styles.styleBadgeText}>
                            {item.study_style === 'visual'
                              ? '👁️ Visual'
                              : item.study_style === 'auditory'
                              ? '👂 Auditori'
                              : item.study_style === 'reading'
                              ? '📖 Membaca'
                              : '✋ Kinestetik'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Bio Snippet */}
                {item.bio ? (
                  <Text style={styles.bioText} numberOfLines={2}>
                    {item.bio}
                  </Text>
                ) : null}

                {/* Subjects Chips */}
                {item.subjects && item.subjects.length > 0 && (
                  <View style={styles.subjectTagsRow}>
                    {item.subjects.slice(0, 4).map((s, idx) => (
                      <View key={idx} style={styles.subjectChip}>
                        <Text style={styles.subjectChipText}>{s}</Text>
                      </View>
                    ))}
                    {item.subjects.length > 4 && (
                      <View style={styles.subjectChipMore}>
                        <Text style={styles.subjectChipMoreText}>
                          +{item.subjects.length - 4} lagi
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Card Actions Footer */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => router.push(`/user/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailBtnText}>ℹ️ Detail & Ulasan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chatBtn, isActing && styles.btnDisabled]}
                    onPress={() => handleDirectChat(item)}
                    disabled={isActing}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chatBtnText}>💬 Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sapaBtn,
                      isGreeted && styles.sapaBtnDone,
                      isActing && styles.btnDisabled,
                    ]}
                    onPress={() => handleSapa(item)}
                    disabled={isActing}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={
                        isGreeted
                          ? ['#10b981', '#059669']
                          : [Colors.secondary, Colors.primary]
                      }
                      style={styles.sapaGradient}
                    >
                      {isActing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.sapaBtnText}>
                          {isGreeted ? 'Terkirim 🤝' : '🤝 Sapa'}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.small,
  },
  backBtnText: {
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '700',
    lineHeight: 24,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.small,
  },
  refreshIcon: {
    fontSize: 18,
  },

  // Alert Banner
  locationAlertBanner: {
    flexShrink: 0,
    marginHorizontal: Spacing.md,
    marginTop: 4,
    padding: Spacing.sm + 4,
    backgroundColor: 'rgba(255, 237, 213, 0.95)',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  locationAlertTextWrap: {
    flex: 1,
  },
  locationAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
  },
  locationAlertSub: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 2,
  },
  locationAlertBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginLeft: 8,
  },
  locationAlertBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // My location pill
  myLocationPill: {
    flexShrink: 0,
    marginHorizontal: Spacing.md,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.2)',
  },
  myLocationText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  myLocationBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  myLocationChange: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Search box
  searchBox: {
    flexShrink: 0,
    marginHorizontal: Spacing.md,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.12)',
    ...Shadow.small,
  },
  searchIcon: {
    fontSize: 17,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  // PANEL FILTER WILAYAH / KOTA & KATEGORI
  filterCard: {
    flexShrink: 0,
    marginHorizontal: Spacing.md,
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BorderRadius.lg,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.18)',
    ...Shadow.small,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  filterTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterTitleIcon: {
    fontSize: 14,
  },
  filterTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  activeCityBadge: {
    backgroundColor: 'rgba(205, 79, 117, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.3)',
  },
  activeCityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },

  // City Horizontal Scroll
  cityScrollView: {
    flexGrow: 0,
  },
  cityScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  cityChip: {
    borderRadius: BorderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(205, 79, 117, 0.22)',
    overflow: 'hidden',
  },
  cityChipActive: {
    borderColor: 'transparent',
    ...Shadow.small,
  },
  cityChipInner: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cityChipGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cityChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  cityChipTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Secondary Filter (Univ & Matkul)
  secondaryFilterDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  tagScrollView: {
    flexGrow: 0,
  },
  tagScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#f3f4f6',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tagChipActive: {
    backgroundColor: 'rgba(205, 79, 117, 0.15)',
    borderColor: Colors.primary,
  },
  tagChipText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 4,
  },

  // Results info
  resultsInfoRow: {
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: 8,
    marginBottom: 6,
  },
  resultsCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resetFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  // FlatList & Cards
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.12)',
    ...Shadow.medium,
  },
  cardHeaderArea: {
    flexDirection: 'row',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: Spacing.sm + 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ratingStar: {
    fontSize: 11,
    marginRight: 2,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  username: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  univBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    maxWidth: 160,
  },
  univBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  locationBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  gradeBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  styleBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  styleBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  // Bio
  bioText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 10,
  },

  // Subjects
  subjectTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  subjectChip: {
    backgroundColor: 'rgba(205,79,117,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  subjectChipText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  subjectChipMore: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  subjectChipMoreText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Card Actions
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  chatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  sapaBtn: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  sapaBtnDone: {
    opacity: 0.9,
  },
  sapaGradient: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sapaBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Loading
  loadingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyTip: {
    fontSize: 12,
    color: '#4b5563',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#fde68a',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyTipBold: {
    fontWeight: '700',
    color: '#92400e',
  },
  resetBtnPrimary: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  resetBtnGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
