import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getCurrentUser, getProfile, updateProfile, signOut } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { triggerTestDeviceNotification, registerForPushNotificationsAsync } from '../lib/notificationService';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/welcome'); return; }
      setEmail(user.email || '');
      setProfile(await getProfile(user.id));
      setLoading(false);
    })();
  }, []);

  const toggleAvailable = async (value: boolean) => {
    if (!profile) return;
    setProfile({ ...profile, is_available: value });
    const { error } = await updateProfile(profile.id, { is_available: value });
    if (error) {
      setProfile({ ...profile, is_available: !value });
      Alert.alert('Gagal', error.message);
    }
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 8) return Alert.alert('Password terlalu pendek', 'Minimal 8 karakter.');
    if (newPwd !== confirmPwd) return Alert.alert('Tidak cocok', 'Konfirmasi password tidak sama.');
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) return Alert.alert('Gagal mengubah password', error.message);
    setNewPwd(''); setConfirmPwd(''); setShowPwd(false);
    Alert.alert('Berhasil 🔒', 'Password berhasil diubah.');
  };

  const handleResetEmail = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    Alert.alert(error ? 'Gagal' : 'Email terkirim 📧', error ? error.message : `Link reset password dikirim ke ${email}.`);
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      const success = await triggerTestDeviceNotification();
      if (success) {
        Alert.alert(
          'Notifikasi Terkirim! 📲',
          'Notifikasi berhasil dikirim langsung ke bilah status atas (status bar) dan layar kunci HP Anda lengkap dengan suara dan getaran.\n\nSilakan tarik layar HP Anda dari atas ke bawah untuk memeriksanya!'
        );
      } else {
        Alert.alert(
          'Izin Belum Aktif ⚠️',
          'Izin notifikasi belum diizinkan pada perangkat ini. Apakah Anda ingin mengaktifkan izin notifikasi sekarang?',
          [
            { text: 'Nanti Saja', style: 'cancel' },
            {
              text: 'Izinkan Sekarang',
              onPress: async () => {
                const token = await registerForPushNotificationsAsync(profile?.id);
                if (token) {
                  Alert.alert('Berhasil 🎉', 'Izin notifikasi HP telah diaktifkan!');
                } else {
                  Alert.alert('Petunjuk', 'Buka Pengaturan HP > Aplikasi > StudyMath > Izinkan Notifikasi.');
                }
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Info', 'Pastikan izin notifikasi diizinkan pada perangkat.');
    } finally {
      setTestingNotif(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: async () => { await signOut(); router.replace('/welcome'); } },
    ]);
  };

  const Row = ({ icon, label, sub, onPress, right, danger }: {
    icon: string; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}><Text style={styles.rowIconText}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: Colors.error }]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Akun */}
          <Text style={styles.section}>AKUN</Text>
          <View style={styles.card}>
            <Row icon="📧" label="Email" sub={email} />
            <View style={styles.divider} />
            <Row icon="✏️" label="Edit Profil" sub="Nama, bio, mapel, gaya belajar & MBTI" onPress={() => router.push('/edit-profile')} />
            <View style={styles.divider} />
            <Row icon="🔒" label="Ubah Password" onPress={() => setShowPwd(v => !v)}
              right={<Text style={styles.chevron}>{showPwd ? '˅' : '›'}</Text>} />
            {showPwd && (
              <View style={styles.pwdBox}>
                <TextInput style={styles.input} placeholder="Password baru (min. 8 karakter)" placeholderTextColor={Colors.textMuted}
                  secureTextEntry value={newPwd} onChangeText={setNewPwd} autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="Ulangi password baru" placeholderTextColor={Colors.textMuted}
                  secureTextEntry value={confirmPwd} onChangeText={setConfirmPwd} autoCapitalize="none" />
                <TouchableOpacity style={styles.pwdBtn} onPress={handleChangePassword} disabled={savingPwd}>
                  <LinearGradient colors={[Colors.secondary, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pwdBtnGradient}>
                    {savingPwd ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.pwdBtnText}>Simpan Password</Text>}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResetEmail}>
                  <Text style={styles.link}>Lupa password? Kirim link reset ke email</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Preferensi */}
          <Text style={styles.section}>PREFERENSI</Text>
          <View style={styles.card}>
            <Row icon="🟢" label="Tersedia untuk belajar"
              sub={profile?.is_available ? 'Profilmu muncul di Temukan' : 'Profilmu disembunyikan dari Temukan'}
              right={<Switch value={!!profile?.is_available} onValueChange={toggleAvailable}
                trackColor={{ false: '#d1d5db', true: Colors.secondary }} thumbColor={profile?.is_available ? Colors.primary : '#f4f3f4'} />} />
          </View>

          {/* Notifikasi Ponsel */}
          <Text style={styles.section}>NOTIFIKASI PERANGKAT</Text>
          <View style={styles.card}>
            <Row
              icon="🔔"
              label="Tes Notifikasi ke HP"
              sub={testingNotif ? 'Sedang mengirim...' : 'Bunyikan dan tampilkan notifikasi di bilah atas HP'}
              onPress={handleTestNotification}
              right={testingNotif ? <ActivityIndicator size="small" color={Colors.primary} /> : undefined}
            />
            <View style={styles.divider} />
            <Row
              icon="📬"
              label="Pusat Notifikasi"
              sub="Lihat semua riwayat pesan, ajakan & panggilan"
              onPress={() => router.push('/notifications')}
            />
          </View>

          {/* Tentang */}
          <Text style={styles.section}>TENTANG</Text>
          <View style={styles.card}>
            <Row icon="📱" label="Versi Aplikasi" right={<Text style={styles.value}>{Constants.expoConfig?.version || '1.0.0'}</Text>} />
            <View style={styles.divider} />
            <Row icon="💌" label="Hubungi Kami" sub="Kirim masukan atau laporkan bug"
              onPress={() => Linking.openURL('mailto:support@studymatch.app?subject=Masukan%20StudyMath')} />
          </View>

          <View style={[styles.card, { marginTop: Spacing.lg }]}>
            <Row icon="🚪" label="Keluar dari Akun" danger onPress={handleSignOut} />
          </View>

          <Text style={styles.footer}>StudyMath • Belajar bareng jadi lebih seru 🎓</Text>
        </ScrollView>
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
  section: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginTop: Spacing.md, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md, ...Shadow.small },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,169,249,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowIconDanger: { backgroundColor: 'rgba(239,68,68,0.12)' },
  rowIconText: { fontSize: 17 },
  rowLabel: { fontFamily: Fonts.semiBold, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 24, color: Colors.textMuted, marginLeft: 8 },
  value: { fontSize: 14, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: 'rgba(205,79,117,0.1)', marginLeft: 48 },
  pwdBox: { paddingBottom: Spacing.md, gap: 10 },
  input: {
    backgroundColor: '#fdf9ff', borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary,
  },
  pwdBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  pwdBtnGradient: { paddingVertical: 12, alignItems: 'center' },
  pwdBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  link: { fontSize: 13, color: Colors.primary, textAlign: 'center', marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: Spacing.xl },
});
