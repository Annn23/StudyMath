import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getCurrentUser, getMatches, createStudySession } from '../lib/api';
import { Profile, SUBJECTS } from '../types';

const DURATIONS = [30, 45, 60, 90, 120];
// Slot waktu 06:00 – 22:00 per 30 menit
const TIME_SLOTS = Array.from({ length: 33 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  const m = i % 2 === 0 ? 0 : 30;
  return { h, m, label: `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}` };
});

const avatarOf = (p: Profile) =>
  p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'User')}&background=cd4f75&color=fff`;

export default function NewSessionScreen() {
  const insets = useSafeAreaInsets();
  const { partner: partnerParam } = useLocalSearchParams<{ partner?: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [partners, setPartners] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [partnerId, setPartnerId] = useState<string | null>(partnerParam || null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [duration, setDuration] = useState(60);
  const [meetingLink, setMeetingLink] = useState('');

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)), []);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/welcome'); return; }
      setUserId(user.id);
      const matches = await getMatches(user.id);
      const list = matches.map(m => m.profile).filter(Boolean) as Profile[];
      setPartners(list);
      if (!partnerParam && list.length === 1) setPartnerId(list[0].id);
      setLoading(false);
    })();
  }, []);

  const selectedPartner = partners.find(p => p.id === partnerId);
  // Mapel yang ditawarkan: gabungan mapel partner (jika ada) lalu semua mapel
  const subjectOptions = useMemo(() => {
    const fromPartner = selectedPartner?.subjects || [];
    return [...fromPartner, ...SUBJECTS.filter(s => !fromPartner.includes(s))];
  }, [selectedPartner]);

  const isSlotPast = (slot: { h: number; m: number }) => {
    if (!isSameDay(date, new Date())) return false;
    const d = new Date(date); d.setHours(slot.h, slot.m, 0, 0);
    return d.getTime() <= Date.now();
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (!partnerId) return Alert.alert('Partner belum dipilih', 'Pilih partner belajarmu dulu.');
    if (!title.trim()) return Alert.alert('Judul kosong', 'Isi judul sesi belajar.');
    if (!time) return Alert.alert('Jam belum dipilih', 'Pilih jam mulai sesi.');

    const scheduled = new Date(date);
    scheduled.setHours(time.h, time.m, 0, 0);
    if (scheduled.getTime() <= Date.now()) return Alert.alert('Waktu tidak valid', 'Pilih waktu di masa depan.');

    setSaving(true);
    const { error } = await createStudySession({
      title: title.trim(),
      description: description.trim() || null,
      organizer_id: userId,
      partner_id: partnerId,
      subject,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: duration,
      meeting_link: meetingLink.trim() || null,
      status: 'pending',
    });
    setSaving(false);

    if (error) {
      Alert.alert('Gagal membuat sesi', error.message);
      return;
    }
    Alert.alert('Berhasil 🎉', `Undangan sesi terkirim ke ${selectedPartner?.full_name || 'partner'}.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buat Sesi Belajar</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Partner */}
            <Text style={styles.label}>Partner Belajar *</Text>
            {partners.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Kamu belum memiliki teman belajar. Cari partner dulu di tab Temukan atau Teman 💫</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                {partners.map(p => {
                  const active = p.id === partnerId;
                  return (
                    <TouchableOpacity key={p.id} style={[styles.partnerCard, active && styles.partnerCardActive]} onPress={() => setPartnerId(p.id)}>
                      <Image source={{ uri: avatarOf(p) }} style={styles.partnerAvatar} contentFit="cover" />
                      <Text style={[styles.partnerName, active && styles.textActive]} numberOfLines={1}>
                        {p.full_name?.split(' ')[0] || 'User'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Judul */}
            <Text style={styles.label}>Judul Sesi *</Text>
            <TextInput
              style={styles.input} value={title} onChangeText={setTitle} maxLength={80}
              placeholder="cth: Latihan soal Integral" placeholderTextColor={Colors.textMuted}
            />

            {/* Mapel */}
            <Text style={styles.label}>Mata Pelajaran</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {subjectOptions.map(s => {
                const active = s === subject;
                return (
                  <TouchableOpacity key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setSubject(active ? null : s)}>
                    <Text style={[styles.chipText, active && styles.textActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Tanggal */}
            <Text style={styles.label}>Tanggal *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {days.map(d => {
                const active = isSameDay(d, date);
                return (
                  <TouchableOpacity key={d.toISOString()} style={[styles.dayCard, active && styles.dayCardActive]} onPress={() => { setDate(d); setTime(null); }}>
                    <Text style={[styles.dayName, active && styles.textActive]}>{format(d, 'EEE', { locale: id })}</Text>
                    <Text style={[styles.dayNum, active && styles.textActive]}>{format(d, 'd')}</Text>
                    <Text style={[styles.dayMonth, active && styles.textActive]}>{format(d, 'MMM', { locale: id })}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Jam */}
            <Text style={styles.label}>Jam Mulai *</Text>
            <View style={styles.wrapRow}>
              {TIME_SLOTS.map(slot => {
                const past = isSlotPast(slot);
                const active = time?.h === slot.h && time?.m === slot.m;
                return (
                  <TouchableOpacity
                    key={slot.label} disabled={past}
                    style={[styles.timeChip, active && styles.chipActive, past && styles.chipDisabled]}
                    onPress={() => setTime(slot)}
                  >
                    <Text style={[styles.chipText, active && styles.textActive, past && styles.textDisabled]}>{slot.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Durasi */}
            <Text style={styles.label}>Durasi</Text>
            <View style={styles.wrapRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity key={d} style={[styles.chip, duration === d && styles.chipActive]} onPress={() => setDuration(d)}>
                  <Text style={[styles.chipText, duration === d && styles.textActive]}>{d} menit</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Link & Catatan */}
            <Text style={styles.label}>Link Meeting (opsional)</Text>
            <TextInput
              style={styles.input} value={meetingLink} onChangeText={setMeetingLink}
              placeholder="https://meet.google.com/..." placeholderTextColor={Colors.textMuted}
              autoCapitalize="none" keyboardType="url"
            />

            <Text style={styles.label}>Catatan (opsional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
              placeholder="Materi yang mau dibahas, tempat ketemu, dll." placeholderTextColor={Colors.textMuted}
              multiline maxLength={300}
            />

            {/* Ringkasan */}
            {time && (
              <View style={styles.summary}>
                <Text style={styles.summaryText}>
                  📅 {format(date, 'EEEE, d MMMM yyyy', { locale: id })} • 🕐 {String(time.h).padStart(2, '0')}:{time.m === 0 ? '00' : '30'} • {duration} menit
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving || partners.length === 0}>
              <LinearGradient
                colors={partners.length === 0 ? ['#ccc', '#bbb'] : [Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitGradient}
              >
                {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>📨 Kirim Undangan Sesi</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  backBtn: { padding: 8, marginRight: 4 },
  backIcon: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.primary },
  headerTitle: { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.primary },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  label: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: BorderRadius.md, borderWidth: 1.5,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  hRow: { gap: 8, paddingRight: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: Colors.border,
  },
  timeChip: {
    width: '18%', paddingVertical: 8, borderRadius: BorderRadius.md, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textSecondary },
  textActive: { color: Colors.white },
  textDisabled: { textDecorationLine: 'line-through' },
  partnerCard: {
    width: 84, alignItems: 'center', padding: 10, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 2, borderColor: 'transparent', ...Shadow.small,
  },
  partnerCardActive: { backgroundColor: Colors.primary, borderColor: Colors.secondary },
  partnerAvatar: { width: 52, height: 52, borderRadius: 26, marginBottom: 6, borderWidth: 2, borderColor: Colors.white },
  partnerName: { fontFamily: Fonts.semiBold, fontSize: 12, color: Colors.textPrimary },
  dayCard: {
    width: 62, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: Colors.border,
  },
  dayCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayName: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
  dayNum: { fontFamily: Fonts.extraBold, fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginVertical: 2 },
  dayMonth: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  emptyBox: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: BorderRadius.lg, padding: Spacing.md },
  emptyText: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  summary: {
    marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(147,220,252,0.35)', borderWidth: 1, borderColor: Colors.accent,
  },
  summaryText: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#1a5f7a', textAlign: 'center' },
  submitBtn: { marginTop: Spacing.lg, borderRadius: BorderRadius.full, overflow: 'hidden', ...Shadow.medium },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitText: { fontFamily: Fonts.bold, fontSize: 16, fontWeight: '700', color: Colors.white },
});
