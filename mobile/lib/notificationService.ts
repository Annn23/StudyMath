import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  avatar?: string;
  data?: Record<string, any>;
  channelId?: 'messages' | 'calls' | 'default';
}

type NotificationListener = (notif: InAppNotification) => void;
const listeners = new Set<NotificationListener>();

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority?.MAX ?? 0,
    }),
  });
} catch (e) {
  console.warn('[Notifications] setNotificationHandler error:', e);
}

/**
 * Berlangganan event notifikasi banner in-app
 */
export function subscribeInAppNotifications(listener: NotificationListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Daftarkan izin notifikasi dan ambil Expo Push Token dari HP pengguna, lalu simpan ke database
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifikasi Umum',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#cd4f75',
      });
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Pesan & Obrolan',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Panggilan Masuk',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 800, 600, 800],
      });
    } catch {
      // Di Expo Go, channel sistem bawaan Android otomatis digunakan
    }
  }

  if (Platform.OS !== 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Notifications] Izin notifikasi tidak diberikan oleh pengguna');
      return null;
    }

    // Di Expo Go Android (SDK 53+), remote push notifications ditiadakan oleh tim Expo
    // Gunakan in-app banner & Realtime broadcast saat di Expo Go, dan token push pada standalone build / APK
    const isExpoGo =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      (Constants as any).appOwnership === 'expo';

    if (isExpoGo && Platform.OS === 'android') {
      console.log(
        '[Notifications] Berjalan di Expo Go (SDK 53+): Notifikasi remote ditangani lewat In-App Banner & Realtime. Gunakan EAS Build / APK untuk notifikasi background.'
      );
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const pushTokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = pushTokenData.data;
      if (token && userId) {
        await supabase
          .from('profiles')
          .update({ expo_push_token: token })
          .eq('id', userId);
        console.log('[Notifications] Push token berhasil didaftarkan:', token);
      }
    } catch (e) {
      console.log('[Notifications] Info token push:', e);
    }
  }

  return token;
}

/**
 * Tampilkan notifikasi:
 * 1. Di status bar / lockscreen HP (Native Notification)
 * 2. Getaran & suara
 * 3. Banner in-app (jika aplikasi sedang aktif dibuka)
 */
export async function showInAppNotification(notif: Omit<InAppNotification, 'id'>) {
  // Getaran lokal
  if (Platform.OS !== 'web') {
    if (notif.channelId === 'calls') {
      Vibration.vibrate([0, 800, 600, 800], true);
    } else {
      Vibration.vibrate(300);
    }
  }

  const fullNotif: InAppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...notif,
  };

  // 1. Tampilkan banner in-app untuk layar yang sedang terbuka
  listeners.forEach((fn) => {
    try {
      fn(fullNotif);
    } catch (e) {
      console.warn('[NotificationService] listener error:', e);
    }
  });

  // 2. Tampilkan notifikasi sistem HP (muncul di bar notifikasi atas HP & lockscreen)
  if (Platform.OS !== 'web') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          data: notif.data || {},
          sound: 'default',
        },
        trigger: null, // Segera tampilkan di panel notifikasi HP
      });
    } catch (err) {
      console.warn('[Notifications] scheduleNotificationAsync error:', err);
    }
  }
}

/**
 * Setup listener saat notifikasi di bar HP disentuh/diklik oleh pengguna
 */
export function setupNotificationResponseListener() {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      // Lazy require to avoid circular dependencies during module evaluation
      const { router } = require('expo-router');
      const data = response.notification.request.content.data;
      if (data?.conversation_id) {
        router.push(`/chat-detail/${data.conversation_id}`);
      } else if (data?.server_id) {
        router.push(`/server-chat/${data.server_id}`);
      } else if (data?.session_id) {
        router.push(`/session/${data.session_id}`);
      } else if (data?.matched_user_id) {
        router.push('/(tabs)/matches');
      } else {
        router.push('/notifications');
      }
    } catch (e) {
      console.warn('[NotificationResponse] router error:', e);
    }
  });

  return () => subscription.remove();
}

/**
 * Tes kirim notifikasi langsung ke bar notifikasi HP pengguna
 */
export async function triggerTestDeviceNotification(): Promise<boolean> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'StudyMath — Tes Notifikasi Ponsel 🔔',
          body: 'Notifikasi berhasil masuk ke HP Anda! Anda akan menerima pemberitahuan pesan chat, ajakan belajar & panggilan.',
          data: { test: true },
          sound: 'default',
        },
        trigger: null,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[triggerTestDeviceNotification] error:', err);
    return false;
  }
}

/**
 * Hentikan getaran dering panggilan
 */
export function stopCallVibration() {
  if (Platform.OS !== 'web') {
    Vibration.cancel();
  }
}

/**
 * Inisialisasi service notifikasi aman saat aplikasi start
 */
export async function initNotificationService(userId?: string): Promise<void> {
  try {
    await registerForPushNotificationsAsync(userId);
  } catch (err) {
    console.warn('[initNotificationService] err:', err);
  }
}

/**
 * Kirim Push Notification ke HP penerima melalui Expo Push API jika token tersedia
 */
export async function sendPushNotification(
  recipientUserId: string,
  {
    title,
    body,
    data = {},
    channelId = 'messages',
  }: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: 'messages' | 'calls' | 'default';
  }
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', recipientUserId)
      .single();

    const token = profile?.expo_push_token;
    if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          channelId,
          priority: channelId === 'calls' ? 'high' : 'normal',
        }),
      });
    }
  } catch (err) {
    console.warn('[sendPushNotification] error:', err);
  }
}
