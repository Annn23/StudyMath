import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing } from '../../constants/theme';
import { signUp } from '../../lib/api';
import { SUBJECTS, STUDY_STYLES } from '../../types';

type Step = 1 | 2 | 3;

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [university, setUniversity] = useState('');
  const [studyStyle, setStudyStyle] = useState('');
  const [location, setLocation] = useState('');

  // Step 3
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!fullName.trim()) e.fullName = 'Nama wajib diisi';
    const cleanU = username.toLowerCase().replace(/^@/, '').trim();
    if (!cleanU) {
      e.username = 'Username wajib diisi';
    } else if (!/^[a-z0-9_.]{3,20}$/.test(cleanU)) {
      e.username = '3–20 karakter: huruf kecil, angka, _ atau .';
    }
    if (!email.trim()) e.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email tidak valid';
    if (!password) e.password = 'Password wajib diisi';
    else if (password.length < 8) e.password = 'Password minimal 8 karakter';
    if (password !== confirmPassword) e.confirmPassword = 'Password tidak cocok';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: typeof errors = {};
    if (!university.trim()) e.university = 'Masukkan nama universitas / kampus kamu';
    if (!studyStyle) e.studyStyle = 'Pilih gaya belajarmu';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: typeof errors = {};
    if (selectedSubjects.length === 0) e.subjects = 'Pilih minimal 1 mata kuliah';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    try {
      const cleanU = username.toLowerCase().replace(/^@/, '').trim();
      const { data, error } = await signUp(
        email.trim().toLowerCase(),
        password,
        fullName.trim(),
        {
          username: cleanU,
          grade_level: 'Perkuliahan',
          university: university.trim(),
          study_style: studyStyle,
          location: location.trim() || undefined,
          subjects: selectedSubjects,
          bio: bio.trim() || undefined,
        }
      );
      if (error) {
        Alert.alert('Registrasi Gagal', error.message);
      } else {
        Alert.alert(
          'Berhasil! 🎉',
          'Akun berhasil dibuat! Silakan login untuk mulai mencari teman belajar.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch {
      Alert.alert('Error', 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const progressWidth = `${(step / 3) * 100}%`;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#fce4f3', '#e8f7ff', '#fffbe6']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Buat Akun</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Informasi Dasar' : step === 2 ? 'Profil Kampus & Belajar' : 'Mata Kuliah'}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBg}>
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: progressWidth as any }]}
              />
            </View>
            <Text style={styles.stepText}>Langkah {step} dari 3</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* ===== STEP 1 ===== */}
            {step === 1 && (
              <>
                <InputField
                  label="Nama Lengkap" icon="👤" placeholder="Nama kamu"
                  value={fullName} onChangeText={setFullName} error={errors.fullName}
                />
                <InputField
                  label="Username" icon="@" placeholder="misal: budi_math"
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s+/g, ''))}
                  error={errors.username} autoCapitalize="none"
                />
                <InputField
                  label="Email" icon="✉️" placeholder="email@example.com"
                  value={email} onChangeText={setEmail} error={errors.email}
                  keyboardType="email-address" autoCapitalize="none"
                />
                <InputField
                  label="Password" icon="🔒" placeholder="Min. 8 karakter"
                  value={password} onChangeText={setPassword} error={errors.password}
                  secureTextEntry
                />
                <InputField
                  label="Konfirmasi Password" icon="🔒" placeholder="Ulangi password"
                  value={confirmPassword} onChangeText={setConfirmPassword}
                  error={errors.confirmPassword} secureTextEntry
                />
              </>
            )}

            {/* ===== STEP 2 ===== */}
            {step === 2 && (
              <>
                <InputField
                  label="Universitas / Kampus *" icon="🏛️" placeholder="misal: Universitas Indonesia, ITB, UGM..."
                  value={university} onChangeText={setUniversity} error={errors.university}
                />

                <Text style={styles.quickUnivHint}>Pilihan Cepat Kampus Populer:</Text>
                <View style={[styles.chipRow, { marginBottom: Spacing.sm }]}>
                  {['UI', 'ITB', 'UGM', 'ITS', 'UNAIR', 'UNDIP', 'UB', 'UNPAD', 'Telkom', 'Binus'].map(short => (
                    <TouchableOpacity
                      key={short}
                      style={[styles.chip, university === short && styles.chipActive]}
                      onPress={() => setUniversity(university === short ? '' : short)}
                    >
                      <Text style={[styles.chipText, university === short && styles.chipTextActive]}>
                        🏛️ {short}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: Spacing.xs }]}>Gaya Belajar</Text>
                {STUDY_STYLES.map(s => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.styleCard, studyStyle === s.value && styles.styleCardActive]}
                    onPress={() => setStudyStyle(s.value)}
                  >
                    <Text style={styles.styleIcon}>{s.icon}</Text>
                    <View style={styles.styleInfo}>
                      <Text style={[styles.styleName, studyStyle === s.value && styles.styleNameActive]}>
                        {s.label}
                      </Text>
                      <Text style={styles.styleDesc}>{s.desc}</Text>
                    </View>
                    {studyStyle === s.value && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
                {errors.studyStyle && <Text style={styles.errorText}>{errors.studyStyle}</Text>}

                <InputField
                  label="Kota / Lokasi (opsional)" icon="📍" placeholder="Jakarta, Bandung, dll"
                  value={location} onChangeText={setLocation}
                />
              </>
            )}

            {/* ===== STEP 3 ===== */}
            {step === 3 && (
              <>
                <Text style={styles.sectionLabel}>
                  Mata Kuliah ({selectedSubjects.length} dipilih)
                </Text>
                <Text style={styles.sectionHint}>Pilih mata kuliah yang kamu kuasai atau ingin pelajari</Text>
                <View style={styles.subjectGrid}>
                  {SUBJECTS.map(subject => (
                    <TouchableOpacity
                      key={subject}
                      style={[
                        styles.subjectChip,
                        selectedSubjects.includes(subject) && styles.subjectChipActive,
                      ]}
                      onPress={() => toggleSubject(subject)}
                    >
                      <Text style={[
                        styles.subjectText,
                        selectedSubjects.includes(subject) && styles.subjectTextActive,
                      ]}>
                        {subject}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.subjects && <Text style={styles.errorText}>{errors.subjects}</Text>}

                <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>Bio (opsional)</Text>
                <TextInput
                  style={styles.bioInput}
                  placeholder="Ceritakan sedikit tentang dirimu dan cara belajarmu..."
                  placeholderTextColor={Colors.textMuted}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                />
                <Text style={styles.charCount}>{bio.length}/200</Text>
              </>
            )}

            {/* Buttons */}
            <View style={styles.btnRow}>
              {step > 1 && (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep(s => (s - 1) as Step)}
                >
                  <Text style={styles.backBtnText}>← Kembali</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.nextBtn, step > 1 && styles.nextBtnSmall]}
                onPress={step < 3 ? nextStep : handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.secondary, Colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.nextBtnText}>
                      {step < 3 ? 'Lanjut →' : '🎉 Daftar Sekarang'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.loginLink}>
            <Text style={styles.loginText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLinkText}>Masuk</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Reusable Input Field Component
function InputField({
  label, icon, placeholder, value, onChangeText, error,
  keyboardType, autoCapitalize, secureTextEntry,
}: {
  label: string; icon: string; placeholder: string; value: string;
  onChangeText: (t: string) => void; error?: string;
  keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean;
}) {
  const [show, setShow] = useState(!secureTextEntry);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <Text style={styles.inputIcon}>{icon}</Text>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'sentences'}
          secureTextEntry={secureTextEntry && !show}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow(s => !s)}>
            <Text style={styles.inputIcon}>{show ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontFamily: Fonts.extraBold, fontSize: 32, color: Colors.primary, marginBottom: 4 },
  subtitle: { fontFamily: Fonts.medium, fontSize: 15, color: Colors.textSecondary, marginBottom: 16 },
  progressBg: { width: '100%', height: 6, backgroundColor: 'rgba(205,79,117,0.15)', borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  stepText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted },
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f4ff',
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.2)',
    paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textPrimary },
  errorText: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.error, marginTop: 4, marginLeft: 4 },
  sectionLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  sectionHint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, marginBottom: 12, marginTop: -6 },
  quickUnivHint: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textMuted, marginBottom: 6, marginTop: -2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f8f4ff',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  styleCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.2)', backgroundColor: '#f8f4ff', marginBottom: 8,
  },
  styleCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(205,79,117,0.08)' },
  styleIcon: { fontSize: 24, marginRight: 12 },
  styleInfo: { flex: 1 },
  styleName: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.textPrimary },
  styleNameActive: { color: Colors.primary },
  styleDesc: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  checkmark: { fontSize: 20, color: Colors.primary, fontFamily: Fonts.bold },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  subjectChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.2)', backgroundColor: '#f8f4ff',
  },
  subjectChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  subjectText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  subjectTextActive: { color: '#1a5f7a' },
  bioInput: {
    backgroundColor: '#f8f4ff', borderRadius: BorderRadius.md, borderWidth: 1.5,
    borderColor: 'rgba(205,79,117,0.2)', padding: 14, fontFamily: Fonts.regular,
    fontSize: 14, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top',
  },
  charCount: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  backBtn: {
    flex: 1, paddingVertical: 16, borderRadius: BorderRadius.full, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#f8f4ff',
  },
  backBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.textSecondary },
  nextBtn: { flex: 2, borderRadius: BorderRadius.full, overflow: 'hidden', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  nextBtnSmall: { flex: 2 },
  btnGradient: { paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.white },
  loginLink: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  loginText: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary },
  loginLinkText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.primary },
});
