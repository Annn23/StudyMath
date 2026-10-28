import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, Fonts, BorderRadius } from '../../constants/theme';
import {
  CallType,
  CallStatus,
  listenToCallRoom,
  updateCallStatus,
} from '../../lib/call';
import { getWebRtcHtml } from '../../lib/webrtcHtml';

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

  // State status panggilan
  const [callStatus, setCallStatus] = useState<CallStatus>(isCaller ? 'calling' : 'accepted');
  const [enteredRoom, setEnteredRoom] = useState<boolean>(!isCaller);
  const [permissionsReady, setPermissionsReady] = useState<boolean>(true);
  const [micGranted, setMicGranted] = useState<boolean>(true);
  const pulse = useRef(new Animated.Value(1)).current;
  const webViewRef = useRef<WebView>(null);

  const partnerName = name || 'Partner';
  const partnerAvatar =
    avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      partnerName
    )}&background=cd4f75&color=fff&size=300`;

  // HTML WebRTC engine berbasis PeerJS mandiri
  const webrtcHtml = getWebRtcHtml({
    room,
    type: callType,
    role: role || (isCaller ? 'caller' : 'receiver'),
    myName: me || 'Pengguna StudyMatch',
    partnerName,
    partnerAvatar,
  });

  // Minta izin mikrofon & kamera secara eksplisit di Android saat layar dibuka
  useEffect(() => {
    let mounted = true;
    const requestHardwarePermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const perms: any[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (callType === 'video') {
            perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          }

          const results = await PermissionsAndroid.requestMultiple(perms);
          const audioOk =
            results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;

          if (mounted) {
            setMicGranted(audioOk);
            if (!audioOk) {
              Alert.alert(
                'Izin Mikrofon Dibutuhkan 🎤',
                'Aplikasi memerlukan izin mikrofon agar suaramu dapat didengar saat berbicara di telepon.',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (err) {
          console.warn('[CallScreen] Permission request error:', err);
        }
      }
    };

    requestHardwarePermissions();
    return () => {
      mounted = false;
    };
  }, [callType]);

  // Animasi berdenyut avatar saat menunggu diangkat
  useEffect(() => {
    if (callStatus === 'accepted' || enteredRoom) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [callStatus, enteredRoom]);

  // Dengarkan sinyal status panggilan di room
  useEffect(() => {
    const unsub = listenToCallRoom(room, (status) => {
      setCallStatus(status);

      if (status === 'accepted') {
        setEnteredRoom(true);
        // Buka audio lock saat panggilan diterima
        (webViewRef.current as any)?.injectJavaScript(
          'if (typeof unlockAudio === "function") { unlockAudio(); } true;'
        );
      } else if (status === 'rejected') {
        setTimeout(() => router.back(), 1800);
      } else if (status === 'timeout' || status === 'ended') {
        setTimeout(() => router.back(), 1500);
      }
    });

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

  const handleHangUp = () => {
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
        return 'Menghubungkan…';
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

  const showRingingView = !enteredRoom && callStatus !== 'accepted';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* WebView WebRTC Room (hanya dimuat setelah izin mikrofon diperiksa) */}
      <View style={styles.webviewWrap}>
        {permissionsReady ? (
          <WebView
            ref={webViewRef as any}
            source={{
              html: webrtcHtml,
              baseUrl: 'https://studymatch.app',
            }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            allowsFullscreenVideo
            originWhitelist={['*']}
            onLoadEnd={() => {
              (webViewRef.current as any)?.injectJavaScript(
                'if (typeof unlockAudio === "function") { unlockAudio(); } true;'
              );
            }}
            onMessage={(event: any) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'HANGUP') {
                  handleHangUp();
                } else if (data.type === 'CONNECTED') {
                  setCallStatus('accepted');
                  setEnteredRoom(true);
                  (webViewRef.current as any)?.injectJavaScript(
                    'if (typeof unlockAudio === "function") { unlockAudio(); } true;'
                  );
                } else if (data.type === 'ERROR') {
                  Alert.alert('Perhatian', data.message || 'Kendala pada sambungan audio.');
                }
              } catch {
                // ignore
              }
            }}
          />
        ) : (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Menyiapkan mikrofon & audio...</Text>
          </View>
        )}
      </View>

      {/* Layar "Memanggil / Berdering" saat pemanggil sedang menunggu */}
      {showRingingView && (
        <LinearGradient
          colors={['#1f1b2e', '#3b1d33', '#111']}
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[
              styles.ringing,
              { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
            ]}
          >
            <Text style={styles.encrypt}>🔒 Panggilan terenkripsi suara jernih</Text>

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

            {/* Spinner saat memanggil */}
            {(callStatus === 'calling' || callStatus === 'ringing') && (
              <ActivityIndicator color={Colors.secondary} style={{ marginTop: 24 }} size="small" />
            )}

            <View style={{ flex: 1 }} />

            {/* Tombol Masuk ke Ruangan Langsung */}
            {isCaller && (
              <TouchableOpacity
                style={styles.directJoinBtn}
                onPress={() => {
                  setEnteredRoom(true);
                  setCallStatus('accepted');
                  webViewRef.current?.injectJavaScript(
                    'if (typeof unlockAudio === "function") { unlockAudio(); } true;'
                  );
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.directJoinText}>
                  {callType === 'video' ? '📹 Buka Kamera & Masuk Room' : '📞 Buka Ruang Suara'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Tombol Tutup Panggilan Merah */}
            <TouchableOpacity style={styles.endBtn} onPress={handleHangUp} activeOpacity={0.85}>
              <Text style={styles.endIcon}>📞</Text>
            </TouchableOpacity>
            <Text style={styles.endLabel}>Batalkan</Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0714' },
  webviewWrap: { flex: 1, width: '100%', height: '100%' },
  webview: { flex: 1, backgroundColor: '#0d0714' },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0714',
  },
  loadingText: {
    marginTop: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
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
  directJoinBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    marginBottom: 28,
  },
  directJoinText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
