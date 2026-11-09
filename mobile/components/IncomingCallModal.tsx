import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Fonts } from '../constants/theme';
import { CallSession, listenToIncomingCalls, updateCallStatus } from '../lib/call';
import { showInAppNotification, stopCallVibration } from '../lib/notificationService';
import { supabase } from '../lib/supabase';

export default function IncomingCallModal() {
  const insets = useSafeAreaInsets();
  const [call, setCall] = useState<CallSession | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cleanups: (() => void)[] = [];

    const setupListeners = async (userId: string) => {
      // 1. Dengarkan panggilan masuk via channel calls / active_calls
      const unsubCalls = listenToIncomingCalls(
        userId,
        (incoming) => {
          setCall(incoming);

          // Getaran dering panggilan
          showInAppNotification({
            title: incoming.type === 'video' ? '📹 Panggilan Video Masuk' : '📞 Panggilan Suara Masuk',
            body: `${incoming.callerName} sedang memanggilmu. Ketuk untuk membuka!`,
            data: { room: incoming.room, conversation_id: incoming.conversationId },
            channelId: 'calls',
          });

          // Beritahu pemanggil bahwa HP lawan sudah "Berdering" (ringing)
          updateCallStatus(incoming.room, 'ringing', incoming.receiverId);

          // Auto-timeout jika 45 detik tidak diangkat
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            stopCallVibration();
            updateCallStatus(incoming.room, 'timeout', incoming.receiverId);
            setCall(null);
          }, 45000);
        },
        (dismissRoom) => {
          stopCallVibration();
          setCall((prev) => (prev?.room === dismissRoom ? null : prev));
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      );
      cleanups.push(unsubCalls);

      // 2. Dengarkan tabel notifikasi secara global untuk pesan, ulasan, atau panggilan
      const existingNotif = supabase.getChannels().find(
        (c) => c.topic === `global_notifs:${userId}` || c.topic === `realtime:global_notifs:${userId}`
      );
      if (existingNotif) {
        supabase.removeChannel(existingNotif);
      }

      const notifChannel = supabase
        .channel(`global_notifs:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (!row) return;

            const isCall =
              row.title?.includes('memanggilmu') ||
              row.data?.is_call ||
              row.data?.call_type;

            // Tampilkan banner notifikasi in-app
            showInAppNotification({
              title: row.title || 'Pemberitahuan',
              body: row.body || '',
              avatar: row.data?.sender_avatar,
              data: row.data || {},
              channelId: isCall ? 'calls' : 'messages',
            });

            // Jika notifikasi adalah panggilan masuk dan belum ada modal aktif
            if (isCall && (row.data?.room || row.data?.server_id)) {
              const isGroup = !!row.data?.is_group_meet || !!row.data?.server_id;
              setCall({
                id: row.id,
                conversationId: row.data.conversation_id || row.data.server_id,
                callerId: row.data.sender_id,
                callerName: row.data.sender_name || 'Teman Belajar',
                callerAvatar: row.data.sender_avatar,
                receiverId: userId,
                room: row.data.room || `StudyServer_${(row.data.server_id || 'room').replace(/-/g, '').slice(0, 16)}`,
                type: row.data.call_type === 'voice' ? 'voice' : 'video',
                status: 'calling',
                is_group_meet: isGroup,
                server_id: row.data.server_id,
                server_name: row.data.server_name,
              });
            }
          }
        )
        .subscribe();

      cleanups.push(() => supabase.removeChannel(notifChannel));
    };

    let activeUserId: string | null = null;

    const handleUserChange = (userId: string | null) => {
      if (userId === activeUserId) return;
      cleanups.forEach((fn) => fn());
      cleanups = [];
      activeUserId = userId;
      if (userId) {
        setupListeners(userId);
      }
    };

    // Inisialisasi session yang sudah aktif sekarang tanpa menunggu event auth berikutnya
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        handleUserChange(session.user.id);
      }
    });

    // onAuthStateChange untuk mendeteksi perubahan login/logout selanjutnya
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserChange(session?.user?.id || null);
    });

    return () => {
      authSub.subscription.unsubscribe();
      cleanups.forEach((fn) => fn());
      cleanups = [];
      activeUserId = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Animasi pulsing avatar saat berdering
  useEffect(() => {
    if (!call) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [call]);

  if (!call) return null;

  const avatarUri =
    call.callerAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(call.callerName)}&background=cd4f75&color=fff&size=300`;

  const handleReject = () => {
    stopCallVibration();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updateCallStatus(call.room, 'rejected', call.receiverId);
    setCall(null);
  };

  const handleAccept = () => {
    stopCallVibration();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updateCallStatus(call.room, 'accepted', call.receiverId);
    const targetCall = call;
    setCall(null);

    // Buka layar video/suara sesuai tipe panggilan (Group Meet vs Private Call)
    const isGroupCall =
      !!targetCall.is_group_meet ||
      !!targetCall.server_id ||
      (typeof targetCall.room === 'string' && targetCall.room.startsWith('StudyServer_'));
    const targetServerId =
      targetCall.server_id || (isGroupCall ? targetCall.conversationId : undefined);

    if (isGroupCall && targetServerId) {
      router.push({
        pathname: `/server-focus/${targetServerId}`,
        params: {
          type: targetCall.type,
          name: targetCall.server_name || targetCall.callerName,
        },
      });
    } else {
      router.push({
        pathname: '/call/[room]',
        params: {
          room: targetCall.room,
          type: targetCall.type,
          name: targetCall.callerName,
          avatar: targetCall.callerAvatar || '',
          role: 'receiver',
        },
      });
    }
  };

  return (
    <Modal visible={!!call} transparent animationType="slide" onRequestClose={handleReject}>
      <View style={styles.container}>
        <LinearGradient colors={['#1a102f', '#2d1222', '#0d0d14']} style={StyleSheet.absoluteFill} />

        <View style={[styles.content, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 40 }]}>
          {/* Header Status */}
          <Text style={styles.badge}>
            {call.is_group_meet
              ? call.type === 'voice'
                ? '📞 Undangan Suara Server'
                : '📹 Undangan Google Meet Server'
              : call.type === 'video'
              ? '📹 Panggilan Video Masuk'
              : '📞 Panggilan Suara Masuk'}
          </Text>

          {/* Caller Avatar */}
          <View style={styles.avatarSection}>
            <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            </Animated.View>
            <Text style={styles.callerName}>{call.callerName}</Text>
            <Text style={styles.subtext}>
              {call.server_name
                ? `Mengajakmu belajar di server "${call.server_name}"`
                : 'Menghubungi Anda…'}
            </Text>
          </View>

          {/* Tombol Aksi: Tolak & Angkat */}
          <View style={styles.actionsRow}>
            {/* Tolak */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn]}
                onPress={handleReject}
                activeOpacity={0.8}
              >
                <Text style={styles.btnIcon}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Tolak</Text>
            </View>

            {/* Angkat */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={[styles.btn, styles.acceptBtn]}
                onPress={handleAccept}
                activeOpacity={0.8}
              >
                <Text style={styles.btnIcon}>{call.type === 'video' ? '📹' : '📞'}</Text>
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Angkat</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  badge: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#f472b6',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  avatarSection: { alignItems: 'center' },
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#333',
  },
  avatar: { width: '100%', height: '100%' },
  callerName: {
    fontFamily: Fonts.extraBold,
    fontSize: 26,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtext: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
  },
  actionCol: { alignItems: 'center', gap: 10 },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  rejectBtn: { backgroundColor: '#ef4444' },
  acceptBtn: { backgroundColor: '#10b981' },
  btnIcon: { fontSize: 32, color: '#fff' },
  btnLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
});
