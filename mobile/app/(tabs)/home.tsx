import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshControl,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import {
  getCurrentUser,
  getProfile,
  searchProfiles,
  actionOnProfile,
  getOrCreateConversation,
  getUnreadNotificationCount,
} from '../../lib/api';
import { Profile, SUBJECTS, UNIVERSITIES } from '../../types';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const ALL_SUBJECTS = ['Semua', ...SUBJECTS];
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
  'UNS',
  'IPB',
  'Telkom',
  'Binus',
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Semua');
  const [selectedUniv, setSelectedUniv] = useState('Semua');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [showUnivModal, setShowUnivModal] = useState(false);
  const [univSearchQuery, setUnivSearchQuery] = useState('');

  // Data States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [greetedUserIds, setGreetedUserIds] = useState<Set<string>>(new Set());

  // Search debounce timer
  const searchTimer = useRef<any>(null);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  // Realtime updates
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    getCurrentUser().then(user => {
      if (!user) return;
      ch = supabase
        .channel(`home_explore_${user.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            getUnreadNotificationCount(user.id).then(setUnreadNotifs);
          }
        )
        .subscribe();
    });

    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/welcome');
        return;
      }
      setMyUserId(user.id);
      const [profileData, notifCount] = await Promise.all([
        getProfile(user.id),
        getUnreadNotificationCount(user.id),
      ]);
      setCurrentUser(profileData);
      setUnreadNotifs(notifCount);

      await executeSearch(user.id, searchQuery, selectedSubject, onlyAvailable, selectedUniv);
    } catch (e) {
      console.error('[loadInitialData] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const executeSearch = async (
    userId: string,
    query: string,
    subject: string,
    availableOnly: boolean,
    univ: string = selectedUniv
  ) => {
    const results = await searchProfiles({
      currentUserId: userId,
      searchQuery: query,
      subject: subject,
      university: univ !== 'Semua' && univ !== 'Semua Univ' ? univ : undefined,
      isAvailable: availableOnly ? true : undefined,
    });
    setProfiles(results);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!myUserId) return;

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      executeSearch(myUserId, text, selectedSubject, onlyAvailable, selectedUniv);
    }, 280);
  };

  const handleSelectSubject = (subject: string) => {
    setSelectedSubject(subject);
    if (myUserId) {
      executeSearch(myUserId, searchQuery, subject, onlyAvailable, selectedUniv);
    }
  };

  const handleSelectUniv = (univ: string) => {
    const finalUniv = univ === 'Semua Univ' ? 'Semua' : univ;
    setSelectedUniv(finalUniv);
    if (myUserId) {
      executeSearch(myUserId, searchQuery, selectedSubject, onlyAvailable, finalUniv);
    }
  };

  const toggleAvailabilityFilter = () => {
    const nextVal = !onlyAvailable;
    setOnlyAvailable(nextVal);
    if (myUserId) {
      executeSearch(myUserId, searchQuery, selectedSubject, nextVal, selectedUniv);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSubject('Semua');
    setSelectedUniv('Semua');
    setOnlyAvailable(false);
    if (myUserId) {
      executeSearch(myUserId, '', 'Semua', false, 'Semua');
    }
  };

  const handleSendGreeting = async (partner: Profile) => {
    if (!myUserId) return;
    setActionLoadingId(partner.id);
    try {
      const res = await actionOnProfile(myUserId, partner.id, 'like');
      setGreetedUserIds(prev => new Set(prev).add(partner.id));

      if (res?.data?.is_matched) {
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
        Alert.alert('Ajakan Terkirim! 🤝', `Ajakan belajar berhasil dikirim ke ${partner.full_name || `@${partner.username}` || 'teman'}.`);
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

  const filteredUniversities = UNIVERSITIES.filter(u =>
    u.toLowerCase().includes(univSearchQuery.toLowerCase())
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedSubject !== 'Semua' ||
    (selectedUniv !== 'Semua' && selectedUniv !== 'Semua Univ') ||
    onlyAvailable;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerBrand}>StudyMatch</Text>
          <Text style={styles.headerSub}>Cari Teman Belajar Sendiri 🎓</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.nearbyHeaderBtn}
            onPress={() => router.push('/nearby')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nearbyHeaderGradient}
            >
              <Text style={styles.nearbyHeaderIcon}>📍</Text>
              <Text style={styles.nearbyHeaderText}>Kota</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.8}
          >
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari username (@budi) atau nama..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs / Chips */}
      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* Online Availability Toggle */}
          <TouchableOpacity
            style={[styles.filterChip, onlyAvailable && styles.filterChipActiveGreen]}
            onPress={toggleAvailabilityFilter}
            activeOpacity={0.8}
          >
            <Text style={styles.filterChipIcon}>{onlyAvailable ? '🟢' : '⚪'}</Text>
            <Text
              style={[
                styles.filterChipText,
                onlyAvailable && styles.filterChipTextActiveGreen,
              ]}
            >
              Tersedia Saja
            </Text>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          {/* Subject Filter Chips */}
          {ALL_SUBJECTS.map(subj => {
            const isSelected = selectedSubject === subj;
            return (
              <TouchableOpacity
                key={`subj-${subj}`}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => handleSelectSubject(subj)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                >
                  {subj === 'Semua' ? '📚 Semua Matkul' : subj}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* University Filter Horizontal Bar */}
      <View style={styles.univFilterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.univFilterScrollContent}
        >
          <View style={styles.univLabelChip}>
            <Text style={styles.univLabelText}>🏛️ Kampus:</Text>
          </View>

          {POPULAR_UNIV_CHIPS.map(u => {
            const isAll = u === 'Semua Univ';
            const isSelected = isAll
              ? selectedUniv === 'Semua'
              : selectedUniv === u || selectedUniv.includes(`(${u})`);
            return (
              <TouchableOpacity
                key={`univ-chip-${u}`}
                style={[styles.univChip, isSelected && styles.univChipActive]}
                onPress={() => handleSelectUniv(isAll ? 'Semua' : isSelected ? 'Semua' : u)}
                activeOpacity={0.8}
              >
                <Text style={[styles.univChipText, isSelected && styles.univChipTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            );
          })}

          {selectedUniv !== 'Semua' &&
            !POPULAR_UNIV_CHIPS.some(c => c === selectedUniv || selectedUniv.includes(`(${c})`)) && (
              <TouchableOpacity
                style={[styles.univChip, styles.univChipActive]}
                onPress={() => handleSelectUniv('Semua')}
                activeOpacity={0.8}
              >
                <Text style={[styles.univChipText, styles.univChipTextActive]}>
                  🏛️ {selectedUniv} ✕
                </Text>
              </TouchableOpacity>
            )}

          <TouchableOpacity
            style={[styles.univChip, styles.univChipMore]}
            onPress={() => setShowUnivModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.univChipMoreText}>Lainnya ▾</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Result Count & Reset Bar */}
      <View style={styles.resultBar}>
        <Text style={styles.resultCountText}>
          {loading ? 'Mencari...' : `${profiles.length} Teman Belajar Ditemukan`}
        </Text>
        {hasActiveFilters && (
          <TouchableOpacity onPress={handleResetFilters} activeOpacity={0.7}>
            <Text style={styles.resetLinkText}>Reset Filter 🔄</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profiles List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat teman belajar...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          data={profiles}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>Teman Tidak Ditemukan</Text>
              <Text style={styles.emptyDesc}>
                {searchQuery
                  ? `Tidak ada profil dengan kata kunci "${searchQuery}". Pastikan username atau nama sudah benar.`
                  : 'Belum ada teman belajar yang sesuai dengan filter yang dipilih.'}
              </Text>
              <Text style={styles.emptyTip}>
                💡 <Text style={styles.emptyTipBold}>Tips:</Text> Kamu bisa mencari teman secara langsung menggunakan <Text style={styles.emptyTipBold}>@username</Text> miliknya (contoh: @budi).
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.resetBtnPrimary} onPress={handleResetFilters}>
                  <LinearGradient
                    colors={[Colors.secondary, Colors.primary]}
                    style={styles.resetBtnGradient}
                  >
                    <Text style={styles.resetBtnText}>Tampilkan Semua Teman 🔄</Text>
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
                {/* Header Profile Info (Tap to view full profile) */}
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

                    {/* Username Pill */}
                    <View style={styles.usernamePill}>
                      <Text style={styles.usernameText}>
                        @{item.username || 'user'}
                      </Text>
                    </View>

                    {/* Badges: Univ & Gaya Belajar */}
                    <View style={styles.badgesRow}>
                      {item.university ? (
                        <View style={styles.univBadge}>
                          <Text style={styles.univBadgeText} numberOfLines={1}>
                            🏛️ {item.university}
                          </Text>
                        </View>
                      ) : null}
                      {item.location && (
                        <View style={styles.locationBadge}>
                          <Text style={styles.locationBadgeText}>📍 {item.location}</Text>
                        </View>
                      )}
                      {item.mbti && (
                        <View style={styles.mbtiBadge}>
                          <Text style={styles.mbtiBadgeText}>✨ {item.mbti}</Text>
                        </View>
                      )}
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

                {/* Subjects Tags */}
                {item.subjects && item.subjects.length > 0 && (
                  <View style={styles.subjectsContainer}>
                    {item.subjects.map(s => (
                      <View key={s} style={styles.subjectTag}>
                        <Text style={styles.subjectTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bio Snippet */}
                {item.bio ? (
                  <Text style={styles.bioText} numberOfLines={2}>
                    "{item.bio}"
                  </Text>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.cardActionsRow}>
                  {/* Detail Profil */}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.detailBtn]}
                    onPress={() => router.push(`/user/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailBtnText} numberOfLines={1}>👤 Profil</Text>
                  </TouchableOpacity>

                  {/* Sapa / Ajak Belajar */}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.greetBtn, isGreeted && styles.greetBtnDone]}
                    onPress={() => handleSendGreeting(item)}
                    disabled={isActing || isGreeted}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={
                        isGreeted
                          ? ['#10b981', '#059669']
                          : [Colors.secondary, Colors.primary]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionBtnGradient}
                    >
                      {isActing ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <Text
                          style={styles.actionBtnText}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {isGreeted ? 'Terkirim 🤝' : 'Ajak Belajar 🤝'}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Chat Langsung */}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.chatDirectBtn]}
                    onPress={() => handleDirectChat(item)}
                    disabled={isActing}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#93dcfc', '#60b8e8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionBtnGradient}
                    >
                      <Text
                        style={styles.actionBtnTextDark}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        Chat 💬
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* University Picker Modal */}
      <Modal
        visible={showUnivModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUnivModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Kampus / Universitas 🏛️</Text>
                <Text style={styles.modalSub}>Cari teman belajar dari kampus impianmu</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowUnivModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Search Input */}
            <View style={styles.modalSearchBox}>
              <Text style={styles.modalSearchIcon}>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Cari kampus (cth: UI, ITB, Binus, Telkom)..."
                placeholderTextColor={Colors.textMuted}
                value={univSearchQuery}
                onChangeText={setUnivSearchQuery}
                autoCapitalize="none"
              />
              {univSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setUnivSearchQuery('')}>
                  <Text style={styles.modalClearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* University List */}
            <FlatList
              data={filteredUniversities}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isSelected =
                  selectedUniv === item ||
                  (item.includes(`(${selectedUniv})`) && selectedUniv !== 'Semua');
                return (
                  <TouchableOpacity
                    style={[styles.univItemRow, isSelected && styles.univItemRowSelected]}
                    onPress={() => {
                      handleSelectUniv(item);
                      setShowUnivModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.univItemIcon}>🏛️</Text>
                    <Text
                      style={[styles.univItemText, isSelected && styles.univItemTextSelected]}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                    {isSelected && <Text style={styles.univItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: Colors.textMuted,
                      textAlign: 'center',
                      marginBottom: 12,
                    }}
                  >
                    Kampus "{univSearchQuery}" tidak ada di daftar populer.
                  </Text>
                  {univSearchQuery.trim().length > 0 && (
                    <TouchableOpacity
                      style={styles.customUnivBtn}
                      onPress={() => {
                        handleSelectUniv(univSearchQuery.trim());
                        setShowUnivModal(false);
                      }}
                    >
                      <Text style={styles.customUnivBtnText}>
                        Gunakan "{univSearchQuery.trim()}" sebagai filter
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />

            {/* Footer Reset / Semuanya */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => {
                  handleSelectUniv('Semua');
                  setShowUnivModal(false);
                }}
              >
                <Text style={styles.modalResetBtnText}>Tampilkan Semua Kampus 🔄</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerBrand: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyHeaderBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  nearbyHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 4,
  },
  nearbyHeaderIcon: {
    fontSize: 13,
  },
  nearbyHeaderText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.white,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.15)',
    ...Shadow.small,
  },
  notifIcon: {
    fontSize: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: Colors.white,
    fontFamily: Fonts.bold,
    fontSize: 9,
  },

  /* Search Bar */
  searchBarWrapper: {
    paddingHorizontal: Spacing.lg,
    marginTop: 4,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(205,79,117,0.2)',
    ...Shadow.small,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 4,
    fontWeight: 'bold',
  },

  /* Filters */
  filtersSection: {
    marginBottom: 6,
  },
  filterScrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.12)',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipActiveGreen: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  filterChipIcon: {
    fontSize: 10,
    marginRight: 5,
  },
  filterChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontFamily: Fonts.semiBold,
  },
  filterChipTextActiveGreen: {
    color: Colors.white,
    fontFamily: Fonts.semiBold,
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(205,79,117,0.2)',
    marginHorizontal: 2,
  },

  /* Results bar */
  resultBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 4,
    marginBottom: 4,
  },
  resultCountText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.textMuted,
  },
  resetLinkText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },

  /* FlatList */
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    gap: 12,
  },

  /* Card */
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.1)',
    ...Shadow.small,
  },
  cardHeaderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fce4f3',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  cardMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  fullName: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  ratingStar: {
    fontSize: 11,
    marginRight: 3,
  },
  ratingValue: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#d97706',
  },
  usernamePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(205,79,117,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: 2,
    marginBottom: 4,
  },
  usernameText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  locationBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  locationBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.textMuted,
  },
  gradeBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  gradeBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: '#0284c7',
  },
  styleBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  styleBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: '#b45309',
  },
  mbtiBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  mbtiBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: '#7c3aed',
  },

  /* Subjects & Bio */
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  subjectTag: {
    backgroundColor: 'rgba(147,220,252,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  subjectTagText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#0369a1',
  },
  bioText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },

  /* Actions */
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  detailBtn: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  detailBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11.5,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  greetBtn: {},
  greetBtnDone: {},
  chatDirectBtn: {},
  actionBtnGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.white,
    textAlign: 'center',
  },
  actionBtnTextDark: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    color: '#075985',
    textAlign: 'center',
  },

  /* Loading & Empty */
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyTip: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  emptyTipBold: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  resetBtnPrimary: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadow.small,
  },
  resetBtnGradient: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.white,
  },

  /* University Filter Section */
  univFilterSection: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(205,79,117,0.08)',
  },
  univFilterScrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  univLabelChip: {
    paddingVertical: 3,
    paddingRight: 4,
  },
  univLabelText: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  univChip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.2)',
  },
  univChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  univChipText: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    color: Colors.textPrimary,
  },
  univChipTextActive: {
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  univChipMore: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  univChipMoreText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11.5,
    color: '#1d4ed8',
  },

  /* University Badge on Cards */
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
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: '#1d4ed8',
  },

  /* University Picker Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  modalSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: 'bold',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  modalSearchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  modalClearSearchText: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  univItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  univItemRowSelected: {
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.md,
  },
  univItemIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  univItemText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: Colors.textPrimary,
  },
  univItemTextSelected: {
    fontFamily: Fonts.bold,
    color: '#15803d',
  },
  univItemCheck: {
    fontSize: 15,
    color: '#15803d',
    fontWeight: 'bold',
  },
  customUnivBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  customUnivBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    color: '#1d4ed8',
    textAlign: 'center',
  },
  modalFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  modalResetBtn: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: BorderRadius.lg,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalResetBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
});
