import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Fonts, BorderRadius } from '../../constants/theme';
import {
  buildCallUrl, CallType, CallStatus, listenToCallRoom, updateCallStatus,
} from '../../lib/call';

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const { room, type, name, avatar, me, role, receiverId } = useLocalSearchParams<{
    room: string;
    type: CallType;
    name?: string;
    avatar?: string;
    me?: string;
    role?: 'caller' | 'receiver' | 'joiner';
    receiverId?: string;
  }>();

  const callType: CallType = type === 'voice' ? 'voice' : 'video';
  const isCaller = role === 'caller';

  // Pemanggil mulai dengan 'calling'. Penerima / yang gabung langsung 'accepted'
  const [callStatus, setCallStatus] = useState<CallStatus>(isCaller ? 'calling' : 'accepted');
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  const url = buildCallUrl(room, callType, me || 'Pengguna StudyMatch');
  const partnerName = name || 'Partner';
  const partnerAvatar = avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=cd4f75&color=fff&size=300`;

  // Animasi berdenyut avatar saat menunggu diangkat
  useEffect(() => {
    if (callStatus === 'accepted') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [callStatus]);

  // Dengarkan sinyal status panggilan di room (calling -> ringing -> accepted/rejected/ended)
  useEffect(() => {
    const unsub = listenToCallRoom(room, (status) => {
      setCallStatus(status);

      if (status === 'rejected') {
        setTimeout(() => router.back(), 1800);
      } else if (status === 'timeout' || status === 'ended') {
        setTimeout(() => router.back(), 1500);
      }
    });

    // Batas waktu pemanggil jika tidak ada respon sama sekali setelah 50 detik
    let callerTimeout: ReturnType<typeof setTimeout> | undefined;
    if (isCaller) {
      callerTimeout = setTimeout(() => {
        setCallStatus('timeout');
        updateCallStatus(room, 'timeout', receiverId);
        setTimeout(() => router.back(), 1500);
      }, 50000);
    }

    return () => {
      unsub();
      if (callerTimeout) clearTimeout(callerTimeout);
    };
  }, [room, isCaller, receiverId]);

  // Durasi panggilan dihitung saat panggilan sudah diterima (accepted) dan WebView sudah siap
  useEffect(() => {
    if (callStatus !== 'accepted' || webViewLoading) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [callStatus, webViewLoading]);

  const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const handleHangUp = () => {
    // Beritahu server & lawan bahwa panggilan dibatalkan / ditutup
    updateCallStatus(room, 'ended', receiverId);
    router.back();
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Memanggil…';
      case 'ringing':
        return 'Berdering…';
      case 'accepted':
        return webViewLoading
          ? (callType === 'video' ? '📹 Menghubungkan video…' : '📞 Menghubungkan suara…')
          : '';
      case 'rejected':
        return 'Panggilan ditolak ❌';
      case 'timeout':
        return 'Tidak ada jawaban ⏱️';
      case 'ended':
        return 'Panggilan berakhir';
      default:
        return 'Menghubungkan…';
    }
  };

  const isConnected = callStatus === 'accepted';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* WebView WebRTC Jitsi HANYA dimuat dan ditampilkan ketika panggilan SUDAH diangkat (accepted) */}
      {isConnected && (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          allowsFullscreenVideo
          originWhitelist={['*']}
          onLoadEnd={() => setWebViewLoading(false)}
          onError={() =>
            Alert.alert('Gagal', 'Tidak dapat terhubung ke server panggilan.', [
              { text: 'OK', onPress: handleHangUp },
            ])
          }
          onNavigationStateChange={(nav) => {
            if (nav.url.includes('close') || nav.url.endsWith('/static/close.html')) {
              handleHangUp();
            }
          }}
        />
      )}

      {/* Layar "Memanggil / Berdering" ala WhatsApp selama lawan belum mengangkat */}
      {(!isConnected || webViewLoading) && (
        <LinearGradient colors={['#1f1b2e', '#3b1d33', '#111']} style={StyleSheet.absoluteFill}>
          <View style={[styles.ringing, { paddingTop: insets.top + 60 }]}>
            <Text style={styles.encrypt}>🔒 Panggilan terenkripsi end-to-end</Text>

            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <Image source={{ uri: partnerAvatar }} style={styles.bigAvatar} contentFit="cover" />
            </Animated.View>

            <Text style={styles.partnerName}>{partnerName}</Text>
            <Text
              style={[
                styles.status,
                (callStatus === 'rejected' || callStatus === 'timeout') && styles.statusAlert,
              ]}
            >
              {getStatusText()}
            </Text>

            {/* Spinner hanya tampil saat memanggil atau menghubungkan */}
            {(callStatus === 'calling' || callStatus === 'ringing' || (isConnected && webViewLoading)) && (
              <ActivityIndicator color={Colors.secondary} style={{ marginTop: 24 }} size="small" />
            )}
          </View>
        </LinearGradient>
      )}

      {/* Bar Atas: nama partner + durasi saat tersambung */}
      {isConnected && !webViewLoading && (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="none">
          <Text style={styles.topName} numberOfLines={1}>
            {partnerName}
          </Text>
          <Text style={styles.topDuration}>
            {callType === 'video' ? '📹' : '📞'} {duration}
          </Text>
        </View>
      )}

      {/* Tombol Tutup Panggilan Merah (Hang Up ala WhatsApp) */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.endBtn} onPress={handleHangUp} activeOpacity={0.85}>
          <Text style={styles.endIcon}>📞</Text>
        </TouchableOpacity>
        <Text style={styles.endLabel}>
          {isConnected && !webViewLoading ? 'Akhiri' : 'Batalkan'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  webview: { flex: 1, backgroundColor: '#111' },
  ringing: { flex: 1, alignItems: 'center' },
  encrypt: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 40 },
  bigAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: 'rgba(255,169,249,0.6)',
  },
  partnerName: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 24,
  },
  status: {
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    marginTop: 10,
  },
  statusAlert: {
    color: '#f87171',
    fontWeight: '700',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topName: { color: '#fff', fontSize: 15, fontWeight: '700', maxWidth: '80%' },
  topDuration: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endBtn: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.full,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  endIcon: { fontSize: 30, transform: [{ rotate: '135deg' }] },
  endLabel: {
    color: '#fff',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
});
