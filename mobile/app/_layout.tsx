import React, { useEffect, useRef } from 'react';
import { Slot, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import IncomingCallModal from '../components/IncomingCallModal';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import {
  initNotificationService,
  setupNotificationResponseListener,
  showInAppNotification,
} from '../lib/notificationService';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const setupUserRealtimeNotifs = (userId: string) => {
    if (notifChannelRef.current) {
      supabase.removeChannel(notifChannelRef.current);
      notifChannelRef.current = null;
    }
    notifChannelRef.current = supabase
      .channel(`user_global_notifs_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as any;
          if (notif?.title) {
            showInAppNotification({
              title: notif.title,
              body: notif.body || '',
              data: notif.data || {},
              channelId: notif.type === 'message' ? 'messages' : 'default',
            });
          }
        }
      )
      .subscribe();
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    // Setup listener saat notifikasi di bar sistem HP diklik
    const cleanupListener = setupNotificationResponseListener();

    // Check session on start safely
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session) {
          initNotificationService(data.session.user.id);
          setupUserRealtimeNotifs(data.session.user.id);
          router.replace('/(tabs)/home');
        } else {
          router.replace('/welcome');
        }
      })
      .catch((err) => {
        console.warn('[RootLayout] Session check error:', err);
        router.replace('/welcome');
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Hanya redirect saat login/logout — bukan saat USER_UPDATED (ubah password) / TOKEN_REFRESHED
      if (event === 'SIGNED_IN' && session) {
        initNotificationService(session.user.id);
        setupUserRealtimeNotifs(session.user.id);
        router.replace('/(tabs)/home');
      } else if (event === 'SIGNED_OUT') {
        if (notifChannelRef.current) {
          supabase.removeChannel(notifChannelRef.current);
          notifChannelRef.current = null;
        }
        router.replace('/welcome');
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupListener();
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
      <InAppNotificationBanner />
      <IncomingCallModal />
    </>
  );
}
