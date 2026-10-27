import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Fonts, BorderRadius, Shadow } from '../constants/theme';
import {
  MBTI_QUESTIONS,
  MBTI_TYPES,
  calculateMbtiResult,
  getMbtiInfo,
  MbtiCalculationResult,
  MbtiTypeInfo,
} from '../constants/mbti';
import { getCurrentUser, getProfile, updateProfile } from '../lib/api';

export default function MbtiTestScreen() {
  const insets = useSafeAreaInsets();
  const { current } = useLocalSearchParams<{ current?: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B'>>({});
  const [testCompleted, setTestCompleted] = useState<boolean>(false);
  const [result, setResult] = useState<MbtiCalculationResult | null>(null);

  // Manual Pick Modal
  const [showManualModal, setShowManualModal] = useState<boolean>(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      const prof = await getProfile(user.id);
      if (prof?.mbti && !result) {
        const info = getMbtiInfo(prof.mbti);
        if (info) {
          // Jika sudah punya MBTI, kita siapkan view result
          setResult({
            mbti: info.code,
            eScore: 2,
            iScore: 1,
            sScore: 1,
            nScore: 2,
            tScore: 1,
            fScore: 2,
            jScore: 2,
            pScore: 1,
            ePercent: 67,
            iPercent: 33,
            sPercent: 33,
            nPercent: 67,
            tPercent: 33,
            fPercent: 67,
            jPercent: 67,
            pPercent: 33,
            details: info,
          });
        }
      }
    }
    setLoading(false);
  };

  const handleSelectOption = (choice: 'A' | 'B') => {
    const qId = MBTI_QUESTIONS[currentQuestionIndex].id;
    const updatedAnswers = { ...answers, [qId]: choice };
    setAnswers(updatedAnswers);

    // Auto next question jika belum di akhir
    if (currentQuestionIndex < MBTI_QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
      }, 200);
    } else {
      // Selesai seluruh 12 soal
      finishTest(updatedAnswers);
    }
  };

  const finishTest = (finalAnswers: Record<number, 'A' | 'B'>) => {
    const calc = calculateMbtiResult(finalAnswers);
    setResult(calc);
    setTestCompleted(true);
  };

  const handleSaveToProfile = async (mbtiCode: string) => {
    if (!userId) {
      Alert.alert('Belum Masuk', 'Silakan masuk ke akun Anda untuk menyimpan MBTI.');
      return;
    }
    setSaving(true);
    const { error } = await updateProfile(userId, { mbti: mbtiCode });
    setSaving(false);
    if (!error) {
      Alert.alert(
        'Tersimpan! 🎉',
        `Kepribadian ${mbtiCode} (${MBTI_TYPES[mbtiCode]?.name || ''}) berhasil disimpan ke profil belajar Anda.`,
        [
          {
            text: 'Lihat Profil',
            onPress: () => router.replace('/(tabs)/profile'),
          },
          {
            text: 'Tetap di Sini',
            style: 'cancel',
          },
        ]
      );
    } else {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan MBTI.');
    }
  };

  const handleSelectManualMbti = (code: string) => {
    const info = MBTI_TYPES[code];
    if (info) {
      setResult({
        mbti: info.code,
        eScore: 2,
        iScore: 1,
        sScore: 1,
        nScore: 2,
        tScore: 1,
        fScore: 2,
        jScore: 2,
        pScore: 1,
        ePercent: info.code[0] === 'E' ? 75 : 25,
        iPercent: info.code[0] === 'I' ? 75 : 25,
        sPercent: info.code[1] === 'S' ? 75 : 25,
        nPercent: info.code[1] === 'N' ? 75 : 25,
        tPercent: info.code[2] === 'T' ? 75 : 25,
        fPercent: info.code[2] === 'F' ? 75 : 25,
        jPercent: info.code[3] === 'J' ? 75 : 25,
        pPercent: info.code[3] === 'P' ? 75 : 25,
        details: info,
      });
      setTestCompleted(true);
      setShowManualModal(false);
    }
  };

  const handleRetakeTest = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setTestCompleted(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentQ = MBTI_QUESTIONS[currentQuestionIndex];
  const progressPercent = Math.round(((currentQuestionIndex + 1) / MBTI_QUESTIONS.length) * 100);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background Gradient Pastel Halus */}
      <LinearGradient
        colors={['#fdf4ff', '#e0e7ff', '#f0fdf4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Tes Kepribadian MBTI</Text>
          <Text style={styles.headerSubtitle}>Gaya Belajar Matematika & Partner</Text>
        </View>
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => setShowManualModal(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.manualBtnText}>Pilih Manual 📋</Text>
        </TouchableOpacity>
      </View>

      {/* Tampilan Hasil Tes (Jika Sudah Selesai) */}
      {testCompleted && result ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.resultScroll, { paddingBottom: insets.bottom + 40 }]}
        >
          {/* Badge Kartu Utama MBTI */}
          <View style={[styles.resultCard, { borderColor: result.details.color }]}>
            <LinearGradient
              colors={[result.details.bgColor, '#ffffff']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.resultBadgeTop}>
              <Text style={styles.resultEmoji}>{result.details.emoji}</Text>
              <View style={[styles.archetypePill, { backgroundColor: result.details.color }]}>
                <Text style={styles.archetypePillText}>{result.details.archetype}</Text>
              </View>
            </View>

            <Text style={[styles.resultCode, { color: result.details.color }]}>
              {result.mbti}
            </Text>
            <Text style={styles.resultName}>{result.details.name}</Text>
            <Text style={styles.resultEnglish}>{result.details.englishTitle}</Text>

            <View style={styles.divider} />

            <Text style={styles.resultTagline}>"{result.details.tagline}"</Text>
            <Text style={styles.resultDescription}>{result.details.description}</Text>
          </View>

          {/* Persentase Dimensi 4 Spektrum */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Spektrum Kepribadian Anda 📊</Text>
            <Text style={styles.sectionSub}>Perbandingan kecenderungan alami cara berpikir Anda:</Text>

            {/* E vs I */}
            <View style={styles.spectrumRow}>
              <View style={styles.spectrumHeader}>
                <Text style={[styles.spectrumLabel, result.ePercent >= 50 && styles.spectrumBold]}>
                  Extraversion (E): {result.ePercent}%
                </Text>
                <Text style={[styles.spectrumLabel, result.iPercent > 50 && styles.spectrumBold]}>
                  Introversion (I): {result.iPercent}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFillE, { width: `${result.ePercent}%` }]} />
                <View style={[styles.barFillI, { width: `${result.iPercent}%` }]} />
              </View>
            </View>

            {/* S vs N */}
            <View style={styles.spectrumRow}>
              <View style={styles.spectrumHeader}>
                <Text style={[styles.spectrumLabel, result.sPercent >= 50 && styles.spectrumBold]}>
                  Sensing (S): {result.sPercent}%
                </Text>
                <Text style={[styles.spectrumLabel, result.nPercent > 50 && styles.spectrumBold]}>
                  Intuition (N): {result.nPercent}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFillS, { width: `${result.sPercent}%` }]} />
                <View style={[styles.barFillN, { width: `${result.nPercent}%` }]} />
              </View>
            </View>

            {/* T vs F */}
            <View style={styles.spectrumRow}>
              <View style={styles.spectrumHeader}>
                <Text style={[styles.spectrumLabel, result.tPercent >= 50 && styles.spectrumBold]}>
                  Thinking (T): {result.tPercent}%
                </Text>
                <Text style={[styles.spectrumLabel, result.fPercent > 50 && styles.spectrumBold]}>
                  Feeling (F): {result.fPercent}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFillT, { width: `${result.tPercent}%` }]} />
                <View style={[styles.barFillF, { width: `${result.fPercent}%` }]} />
              </View>
            </View>

            {/* J vs P */}
            <View style={styles.spectrumRow}>
              <View style={styles.spectrumHeader}>
                <Text style={[styles.spectrumLabel, result.jPercent >= 50 && styles.spectrumBold]}>
                  Judging (J): {result.jPercent}%
                </Text>
                <Text style={[styles.spectrumLabel, result.pPercent > 50 && styles.spectrumBold]}>
                  Perceiving (P): {result.pPercent}%
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFillJ, { width: `${result.jPercent}%` }]} />
                <View style={[styles.barFillP, { width: `${result.pPercent}%` }]} />
              </View>
            </View>
          </View>

          {/* Gaya Belajar Matematika Terbaik */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderFlex}>
              <Text style={styles.cardHeaderIcon}>📚</Text>
              <Text style={styles.sectionHeading}>Gaya Belajar Matematika Kamu</Text>
            </View>
            <Text style={styles.studyStyleText}>{result.details.studyStyle}</Text>

            <Text style={styles.subHeading}>Tips Sukses Belajar:</Text>
            {result.details.studyTips.map((tip, idx) => (
              <View key={idx} style={styles.tipRow}>
                <Text style={styles.tipBullet}>✓</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Partner Belajar Paling Cocok */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderFlex}>
              <Text style={styles.cardHeaderIcon}>🤝</Text>
              <Text style={styles.sectionHeading}>Partner Belajar Paling Cocok</Text>
            </View>
            <Text style={styles.compatibleIntro}>
              Tipe MBTI berikut memiliki kecocokan pola komunikasi dan cara melengkapi pemikiran Anda:
            </Text>
            <View style={styles.compatibleChipsRow}>
              {result.details.compatibleMbti.map((cCode) => {
                const cInfo = MBTI_TYPES[cCode];
                return (
                  <View key={cCode} style={styles.compatibleChip}>
                    <Text style={styles.compatibleChipCode}>{cCode} {cInfo?.emoji || '✨'}</Text>
                    <Text style={styles.compatibleChipName}>{cInfo?.name || ''}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Tombol Simpan & Ulangi */}
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity
              style={styles.saveProfileBtn}
              onPress={() => handleSaveToProfile(result.mbti)}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveProfileBtnText}>
                  Simpan {result.mbti} ke Profil Saya ✅
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setShowManualModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Pilih Tipe Lain 📋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleRetakeTest}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Ulangi Tes 🔄</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* Tampilan Soal Kuis (Langkah demi Langkah) */
        <View style={styles.quizWrapper}>
          {/* Progress Bar Atas */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfoRow}>
              <Text style={styles.progressStepText}>
                Pertanyaan {currentQuestionIndex + 1} dari {MBTI_QUESTIONS.length}
              </Text>
              <Text style={styles.progressDimText}>
                Dimensi: {currentQ.dimension === 'EI' ? 'Energi (E/I)' : currentQ.dimension === 'SN' ? 'Informasi (S/N)' : currentQ.dimension === 'TF' ? 'Keputusan (T/F)' : 'Keteraturan (J/P)'}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Kartu Pertanyaan */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.questionScroll}
          >
            <View style={styles.questionCard}>
              <Text style={styles.questionNumberBadge}>SOAL #{currentQ.id}</Text>
              <Text style={styles.questionTitle}>{currentQ.question}</Text>
            </View>

            {/* Opsi Pilihan A */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                answers[currentQ.id] === 'A' && styles.optionCardSelected,
              ]}
              onPress={() => handleSelectOption('A')}
              activeOpacity={0.8}
            >
              <View style={styles.optionHeaderRow}>
                <View
                  style={[
                    styles.radioCircle,
                    answers[currentQ.id] === 'A' && styles.radioCircleSelected,
                  ]}
                >
                  {answers[currentQ.id] === 'A' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.optionTraitTag}>{currentQ.optionA.trait}</Text>
              </View>
              <Text style={styles.optionBodyText}>{currentQ.optionA.text}</Text>
            </TouchableOpacity>

            {/* Opsi Pilihan B */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                answers[currentQ.id] === 'B' && styles.optionCardSelected,
              ]}
              onPress={() => handleSelectOption('B')}
              activeOpacity={0.8}
            >
              <View style={styles.optionHeaderRow}>
                <View
                  style={[
                    styles.radioCircle,
                    answers[currentQ.id] === 'B' && styles.radioCircleSelected,
                  ]}
                >
                  {answers[currentQ.id] === 'B' && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.optionTraitTag}>{currentQ.optionB.trait}</Text>
              </View>
              <Text style={styles.optionBodyText}>{currentQ.optionB.text}</Text>
            </TouchableOpacity>

            {/* Navigasi Sebelumnya / Lewati */}
            <View style={styles.quizNavRow}>
              {currentQuestionIndex > 0 ? (
                <TouchableOpacity
                  style={styles.prevBtn}
                  onPress={() => setCurrentQuestionIndex((prev) => prev - 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.prevBtnText}>‹ Sebelumnya</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <Text style={styles.instructionText}>
                Pilih jawaban yang paling spontan & menggambarkan diri Anda
              </Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ==================== MODAL PILIH MANUAL 16 MBTI ==================== */}
      <Modal visible={showManualModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Tipe MBTI Anda 📋</Text>
                <Text style={styles.modalSubtitle}>Pilih jika Anda sudah tahu hasil tes 16personalities:</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowManualModal(false)}
                style={styles.modalCloseCircle}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.mbtiGridContainer}>
                {Object.values(MBTI_TYPES).map((item) => (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.mbtiGridItem, { borderColor: item.color }]}
                    onPress={() => handleSelectManualMbti(item.code)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.mbtiGridTop}>
                      <Text style={styles.mbtiGridEmoji}>{item.emoji}</Text>
                      <View style={[styles.mbtiGridBadge, { backgroundColor: item.color }]}>
                        <Text style={styles.mbtiGridBadgeText}>{item.code}</Text>
                      </View>
                    </View>
                    <Text style={styles.mbtiGridName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.mbtiGridTagline} numberOfLines={2}>
                      {item.tagline}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==================== HEADER ====================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.small,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    color: '#0f172a',
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#64748b',
  },
  manualBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  manualBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.primary,
  },

  // ==================== QUIZ SCREEN ====================
  quizWrapper: {
    flex: 1,
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressStepText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.primary,
  },
  progressDimText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#64748b',
  },
  progressTrack: {
    height: 7,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  questionScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    ...Shadow.medium,
  },
  questionNumberBadge: {
    fontFamily: Fonts.extraBold,
    fontSize: 11,
    color: '#8b5cf6',
    marginBottom: 6,
    letterSpacing: 1,
  },
  questionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16.5,
    color: '#0f172a',
    lineHeight: 24,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    ...Shadow.small,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#fdf2f8',
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#ffffff',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  optionTraitTag: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#475569',
  },
  optionBodyText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 21,
    marginLeft: 32,
  },
  quizNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  prevBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  prevBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#64748b',
  },
  instructionText: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 12,
  },

  // ==================== RESULT SCREEN ====================
  resultScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  resultCard: {
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...Shadow.medium,
  },
  resultBadgeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultEmoji: {
    fontSize: 40,
  },
  archetypePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  archetypePillText: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  resultCode: {
    fontFamily: Fonts.extraBold,
    fontSize: 44,
    letterSpacing: 2,
    lineHeight: 50,
  },
  resultName: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    color: '#0f172a',
    marginTop: 2,
  },
  resultEnglish: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#64748b',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 12,
  },
  resultTagline: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#1e293b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  resultDescription: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },

  // ==================== SECTION CARDS ====================
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    ...Shadow.small,
  },
  cardHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionHeading: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#0f172a',
  },
  sectionSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  spectrumRow: {
    marginBottom: 10,
  },
  spectrumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  spectrumLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#475569',
  },
  spectrumBold: {
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barFillE: {
    backgroundColor: '#3b82f6',
    height: '100%',
  },
  barFillI: {
    backgroundColor: '#6366f1',
    height: '100%',
  },
  barFillS: {
    backgroundColor: '#10b981',
    height: '100%',
  },
  barFillN: {
    backgroundColor: '#8b5cf6',
    height: '100%',
  },
  barFillT: {
    backgroundColor: '#0284c7',
    height: '100%',
  },
  barFillF: {
    backgroundColor: '#ec4899',
    height: '100%',
  },
  barFillJ: {
    backgroundColor: '#f59e0b',
    height: '100%',
  },
  barFillP: {
    backgroundColor: '#14b8a6',
    height: '100%',
  },
  studyStyleText: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: '#1e293b',
    lineHeight: 21,
    marginBottom: 12,
  },
  subHeading: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tipBullet: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 13,
    marginRight: 8,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  compatibleIntro: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 10,
  },
  compatibleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compatibleChip: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compatibleChipCode: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0f172a',
  },
  compatibleChipName: {
    fontFamily: Fonts.regular,
    fontSize: 10.5,
    color: '#64748b',
  },

  // ==================== ACTIONS ====================
  actionButtonsCol: {
    marginTop: 6,
    gap: 10,
  },
  saveProfileBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.medium,
  },
  saveProfileBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.xl,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadow.small,
  },
  secondaryBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#334155',
  },

  // ==================== MODAL PILIH MANUAL ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    ...Shadow.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    color: '#0f172a',
  },
  modalSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: '#64748b',
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: 'bold',
  },
  mbtiGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 20,
  },
  mbtiGridItem: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
  },
  mbtiGridTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mbtiGridEmoji: {
    fontSize: 22,
  },
  mbtiGridBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  mbtiGridBadgeText: {
    fontFamily: Fonts.extraBold,
    fontSize: 11,
    color: '#ffffff',
  },
  mbtiGridName: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#0f172a',
  },
  mbtiGridTagline: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
