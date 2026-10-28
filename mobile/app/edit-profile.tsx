import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getCurrentUser, getProfile, updateProfile } from '../lib/api';
import { Profile, SUBJECTS, STUDY_STYLES, UNIVERSITIES } from '../types';
import { MBTI_TYPES } from '../constants/mbti';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [university, setUniversity] = useState('');
  const [studyStyle, setStudyStyle] = useState<Profile['study_style']>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showUnivModal, setShowUnivModal] = useState(false);
  const [univSearch, setUnivSearch] = useState('');

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/welcome'); return; }
      setUserId(user.id);
      const p = await getProfile(user.id);
      if (p) {
        setFullName(p.full_name || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
        setLocation(p.location || '');
        setUniversity(p.university || '');
        setStudyStyle(p.study_style);
        setMbti(p.mbti || null);
        setSubjects(p.subjects || []);
      }
      setLoading(false);
    })();
  }, []);

  const toggleSubject = (s: string) =>
    setSubjects(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Nama wajib diisi';
    if (username && !/^[a-z0-9_.]{3,20}$/.test(username)) {
      e.username = '3–20 karakter: huruf kecil, angka, _ atau .';
    }
    if (subjects.length === 0) e.subjects = 'Pilih minimal 1 mata kuliah';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!userId || !validate()) return;
    setSaving(true);
    const { error } = await updateProfile(userId, {
      full_name: fullName.trim(),
      username: username.trim() || null,
      bio: bio.trim() || null,
      location: location.trim() || null,
      university: university.trim() || null,
      grade_level: 'Perkuliahan',
      study_style: studyStyle,
      mbti: mbti || null,
      subjects,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      if ((error as any).code === '23505') {
        setErrors({ username: 'Username sudah dipakai orang lain' });
      } else {
        const e = error as any;
        Alert.alert('Gagal menyimpan', `${e.message || 'Unknown error'}${e.code ? `\nKode: ${e.code}` : ''}${e.details ? `\n${e.details}` : ''}${e.hint ? `\nHint: ${e.hint}` : ''}`);
      }
      return;
    }
    Alert.alert('Tersimpan ✅', 'Profil berhasil diperbarui.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profil</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || loading} style={styles.saveTopBtn}>
          {saving ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.saveTopText}>Simpan</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.label}>Nama Lengkap *</Text>
              <TextInput style={[styles.input, errors.fullName && styles.inputError]} value={fullName} onChangeText={setFullName}
                placeholder="Nama kamu" placeholderTextColor={Colors.textMuted} maxLength={50} />
              {errors.fullName && <Text style={styles.error}>{errors.fullName}</Text>}

              <Text style={styles.label}>Username</Text>
              <View style={[styles.input, styles.inputRow, errors.username && styles.inputError]}>
                <Text style={styles.at}>@</Text>
                <TextInput style={styles.inputInner} value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                  placeholder="username" placeholderTextColor={Colors.textMuted} autoCapitalize="none" maxLength={20} />
              </View>
              {errors.username && <Text style={styles.error}>{errors.username}</Text>}

              <Text style={styles.label}>Lokasi</Text>
              <TextInput style={styles.input} value={location} onChangeText={setLocation}
                placeholder="cth: Bandung" placeholderTextColor={Colors.textMuted} maxLength={50} />

              <Text style={styles.label}>Tentang Aku</Text>
              <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio}
                placeholder="Ceritakan sedikit tentang dirimu & target belajarmu" placeholderTextColor={Colors.textMuted}
                multiline maxLength={200} />
              <Text style={styles.counter}>{bio.length}/200</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Gaya Belajar</Text>
              {STUDY_STYLES.map(s => {
                const active = studyStyle === s.value;
                return (
                  <TouchableOpacity key={s.value} style={[styles.styleRow, active && styles.styleRowActive]} onPress={() => setStudyStyle(s.value)}>
                    <Text style={styles.styleIcon}>{s.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.styleLabel, active && styles.textActive]}>{s.label}</Text>
                      <Text style={[styles.styleDesc, active && styles.textActiveSoft]}>{s.desc}</Text>
                    </View>
                    {active && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Universitas / Kampus */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Universitas / Kampus</Text>
                {university ? (
                  <TouchableOpacity onPress={() => setUniversity('')} activeOpacity={0.7}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 12, color: '#ef4444' }}>
                      Hapus ✕
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Selector Button */}
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }]}
                onPress={() => setShowUnivModal(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🏛️</Text>
                  <Text
                    style={{
                      fontFamily: university ? Fonts.bold : Fonts.regular,
                      fontSize: 14,
                      color: university ? Colors.primary : Colors.textMuted,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {university || 'Pilih atau cari universitas kamu...'}
                  </Text>
                </View>
                <Text style={{ color: Colors.primary, fontFamily: Fonts.bold, fontSize: 13 }}>
                  Pilih ▾
                </Text>
              </TouchableOpacity>

              <Text style={{ fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.textMuted, marginTop: 10, marginBottom: 8 }}>
                Pilihan Cepat Kampus Populer:
              </Text>
              <View style={styles.wrapRow}>
                {['UI', 'ITB', 'UGM', 'ITS', 'UNAIR', 'UNDIP', 'UB', 'UNPAD', 'Telkom', 'Binus'].map(short => {
                  const full = UNIVERSITIES.find(u => u.includes(`(${short})`)) || (short === 'Telkom' ? 'Universitas Telkom' : short === 'Binus' ? 'Binus University' : short);
                  const active = university === full || university === short;
                  return (
                    <TouchableOpacity
                      key={short}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setUniversity(active ? '' : full)}
                    >
                      <Text style={[styles.chipText, active && styles.textActive]}>
                        🏛️ {short}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* MBTI Personality */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Kepribadian MBTI</Text>
                <TouchableOpacity onPress={() => router.push('/mbti-test')} activeOpacity={0.7}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 12, color: Colors.primary }}>
                    Ikuti Tes MBTI 🔮
                  </Text>
                </TouchableOpacity>
              </View>

              {mbti && MBTI_TYPES[mbti] ? (
                <View style={{
                  backgroundColor: MBTI_TYPES[mbti].bgColor,
                  borderWidth: 1.5,
                  borderColor: MBTI_TYPES[mbti].color,
                  borderRadius: BorderRadius.lg,
                  padding: 12,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 24, marginRight: 8 }}>{MBTI_TYPES[mbti].emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 14, color: Colors.textPrimary }}>
                        {mbti} — {MBTI_TYPES[mbti].name}
                      </Text>
                      <Text style={{ fontFamily: Fonts.regular, fontSize: 11, color: Colors.textSecondary }} numberOfLines={1}>
                        {MBTI_TYPES[mbti].tagline}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setMbti(null)} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={{ fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.textMuted, marginBottom: 8 }}>
                Pilih langsung jika sudah tahu, atau ikuti tes cepat:
              </Text>

              <View style={styles.wrapRow}>
                {Object.keys(MBTI_TYPES).map(code => {
                  const active = mbti === code;
                  const item = MBTI_TYPES[code];
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[styles.chip, active && { backgroundColor: item.color, borderColor: item.color }]}
                      onPress={() => setMbti(active ? null : code)}
                    >
                      <Text style={[styles.chipText, active && { color: '#ffffff', fontFamily: Fonts.bold }]}>
                        {item.emoji} {code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Mata Kuliah * <Text style={styles.labelHint}>({subjects.length} dipilih)</Text></Text>
              <View style={styles.wrapRow}>
                {SUBJECTS.map(s => {
                  const active = subjects.includes(s);
                  return (
                    <TouchableOpacity key={s} style={[styles.chip, active && styles.chipBlue]} onPress={() => toggleSubject(s)}>
                      <Text style={[styles.chipText, active && styles.textBlue]}>{active ? '✓ ' : ''}{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.subjects && <Text style={styles.error}>{errors.subjects}</Text>}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
              <LinearGradient colors={[Colors.secondary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}>
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>💾 Simpan Perubahan</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* University Modal */}
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
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Universitas 🏛️</Text>
                <Text style={styles.modalSub}>Pilih kampus kamu dari daftar atau ketik sendiri</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUnivModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Cari kampus (cth: UI, ITB, Binus)..."
                placeholderTextColor={Colors.textMuted}
                value={univSearch}
                onChangeText={setUnivSearch}
                autoCapitalize="none"
              />
              {univSearch.length > 0 && (
                <TouchableOpacity onPress={() => setUnivSearch('')}>
                  <Text style={{ fontSize: 14, color: Colors.textMuted, paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={UNIVERSITIES.filter(u => u.toLowerCase().includes(univSearch.toLowerCase()))}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isSelected = university === item;
                return (
                  <TouchableOpacity
                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                    onPress={() => {
                      setUniversity(item);
                      setShowUnivModal(false);
                    }}
                  >
                    <Text style={{ fontSize: 16, marginRight: 10 }}>🏛️</Text>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]} numberOfLines={1}>
                      {item}
                    </Text>
                    {isSelected && <Text style={{ color: '#15803d', fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
                    Kampus "{univSearch}" tidak ada dalam daftar umum.
                  </Text>
                  {univSearch.trim().length > 0 && (
                    <TouchableOpacity
                      style={styles.customUnivBtn}
                      onPress={() => {
                        setUniversity(univSearch.trim());
                        setShowUnivModal(false);
                      }}
                    >
                      <Text style={styles.customUnivBtnText}>
                        Gunakan "{univSearch.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  backBtn: { padding: 8, marginRight: 4 },
  backIcon: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.primary },
  headerTitle: { flex: 1, fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.primary },
  saveTopBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: 'rgba(255,255,255,0.85)', ...Shadow.small },
  saveTopText: { fontFamily: Fonts.bold, fontSize: 14, fontWeight: '700', color: Colors.primary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  card: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: BorderRadius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.small },
  label: { fontFamily: Fonts.bold, fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 10, marginBottom: 8 },
  labelHint: { fontFamily: Fonts.regular, fontWeight: '400', color: Colors.textMuted, fontSize: 12 },
  input: {
    backgroundColor: '#fdf9ff', borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 },
  inputInner: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary },
  at: { fontSize: 15, color: Colors.textMuted, marginRight: 2 },
  inputError: { borderColor: Colors.error },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4 },
  error: { fontSize: 12, color: Colors.error, marginTop: 4 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipBlue: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  textActive: { color: Colors.white },
  textActiveSoft: { color: 'rgba(255,255,255,0.85)' },
  textBlue: { color: '#1a5f7a', fontWeight: '600' },
  styleRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: BorderRadius.lg, marginBottom: 8,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border,
  },
  styleRowActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  styleIcon: { fontSize: 24, marginRight: 12 },
  styleLabel: { fontFamily: Fonts.bold, fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  styleDesc: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  check: { fontSize: 18, color: Colors.white, fontWeight: '800' },
  submitBtn: { marginTop: Spacing.sm, borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadow.medium },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: Colors.white },

  /* Modal Styles */
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
  modalSearchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemRowSelected: {
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.md,
  },
  modalItemText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: Colors.textPrimary,
  },
  modalItemTextSelected: {
    fontFamily: Fonts.bold,
    color: '#15803d',
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
});
