import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getCurrentUser, createStudyServer, searchUsersForGroup } from '../lib/api';
import { Profile } from '../types';

const POPULAR_SUBJECTS = [
  'Umum',
  'Kalkulus',
  'Aljabar Linear',
  'Statistika',
  'Fisika Dasar',
  'Struktur Data',
  'Algoritma',
  'Persamaan Diferensial',
  'Logika Matematika',
];

export default function CreateServerScreen() {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Umum');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) {
        setCurrentUserId(user.id);
        loadInitialUsers(user.id);
      }
    });
  }, []);

  const loadInitialUsers = async (userId: string) => {
    setSearching(true);
    const users = await searchUsersForGroup('', userId);
    setSearchResults(users);
    setSearching(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!currentUserId) return;
    setSearching(true);
    const users = await searchUsersForGroup(text, currentUserId);
    setSearchResults(users);
    setSearching(false);
  };

  const toggleSelectMember = (profile: Profile) => {
    if (selectedMembers.find(m => m.id === profile.id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== profile.id));
    } else {
      setSelectedMembers(prev => [...prev, profile]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Nama Grup Diperlukan', 'Harap masukkan nama untuk server / grup belajar.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Belum Login', 'Silakan login terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    const { data: server, error } = await createStudyServer({
      name: name.trim(),
      description: description.trim(),
      subject,
      ownerId: currentUserId,
      memberIds: selectedMembers.map(m => m.id),
    });
    setSubmitting(false);

    if (error || !server) {
      Alert.alert(
        'Gagal Membuat Server',
        error?.message || 'Pastikan script SQL grup sudah dijalankan di Supabase Anda.'
      );
      return;
    }

    Alert.alert('Berhasil! 🎉', `Server "${server.name}" berhasil dibuat.`, [
      {
        text: 'Buka Chat Grup 💬',
        onPress: () => router.replace(`/server-chat/${server.id}`),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Buat Server Belajar 👥</Text>
          <Text style={styles.headerSub}>Bentuk grup obrolan & belajar bersama</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card: Info Server */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Informasi Server / Grup</Text>

          {/* Nama Server */}
          <Text style={styles.fieldLabel}>Nama Server *</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Study Group Kalkulus 2"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          {/* Deskripsi */}
          <Text style={styles.fieldLabel}>Deskripsi / Topik Diskusi</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tuliskan tujuan grup atau materi yang dipelajari..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          {/* Mata Kuliah / Topik */}
          <Text style={styles.fieldLabel}>Mata Kuliah / Subjek</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {POPULAR_SUBJECTS.map(subj => {
              const isSelected = subject === subj;
              return (
                <TouchableOpacity
                  key={subj}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSubject(subj)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {subj === 'Umum' ? '🌐 ' + subj : '📚 ' + subj}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Card: Anggota Terpilih */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>
              Undang Teman ({selectedMembers.length} Terpilih)
            </Text>
            {selectedMembers.length > 0 && (
              <TouchableOpacity onPress={() => setSelectedMembers([])} activeOpacity={0.7}>
                <Text style={styles.clearLink}>Hapus Semua</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Badges Anggota Terpilih */}
          {selectedMembers.length > 0 && (
            <View style={styles.selectedBadgesWrap}>
              {selectedMembers.map(m => (
                <View key={m.id} style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText} numberOfLines={1}>
                    {m.full_name || m.username || 'User'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleSelectMember(m)}
                    style={styles.badgeRemove}
                  >
                    <Text style={styles.badgeRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Kolom Cari Anggota */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari teman via nama atau @username..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Daftar Teman untuk Dipilih */}
          {searching ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.emptySearchText}>
              Tidak ada pengguna ditemukan dengan kata kunci tersebut.
            </Text>
          ) : (
            <View style={styles.memberList}>
              {searchResults.slice(0, 10).map(item => {
                const isSelected = !!selectedMembers.find(m => m.id === item.id);
                const avatarUri =
                  item.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    item.full_name || 'User'
                  )}&background=93dcfc&color=1a5f7a&size=100`;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                    onPress={() => toggleSelectMember(item)}
                    activeOpacity={0.75}
                  >
                    <Image source={{ uri: avatarUri }} style={styles.memberAvatar} />
                    <View style={styles.memberItemInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {item.full_name || 'Pengguna'}
                      </Text>
                      <Text style={styles.memberUser} numberOfLines={1}>
                        @{item.username || 'user'}{item.university ? ` • 🏛️ ${item.university}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                      {isSelected && <Text style={styles.checkCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Tombol Buat Server */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Buat Server Sekarang 🚀</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.15)',
    ...Shadow.small,
  },
  backText: {
    fontSize: 28,
    lineHeight: 32,
    color: Colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.12)',
    ...Shadow.small,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  clearLink: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  fieldLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  textArea: {
    height: 75,
    textAlignVertical: 'top',
  },
  chipScroll: {
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: 'rgba(205,79,117,0.12)',
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  selectedBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(205,79,117,0.1)',
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.2)',
  },
  memberBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.primary,
    maxWidth: 120,
  },
  badgeRemove: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRemoveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  emptySearchText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 12,
  },
  memberList: {
    marginTop: 4,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  memberItemSelected: {
    backgroundColor: 'rgba(205,79,117,0.06)',
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  memberItemInfo: {
    flex: 1,
  },
  memberName: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  memberUser: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkCheckmark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Shadow.medium,
  },
  submitButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#ffffff',
  },
});
