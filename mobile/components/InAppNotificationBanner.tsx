import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Colors, Fonts, BorderRadius, Shadow } from '../constants/theme';
import { InAppNotification, subscribeInAppNotifications } from '../lib/notificationService';

export default function InAppNotificationBanner() {
  const insets = useSafeAreaInsets();
  const [currentNotif, setCurrentNotif] = useState<InAppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeInAppNotifications((notif) => {
      // Panggilan masuk ditangani oleh IncomingCallModal, banner ini untuk pesan & match
      if (notif.channelId === 'calls') return;

      if (hideTimer.current) clearTimeout(hideTimer.current);
      setCurrentNotif(notif);

      // Slide down
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();

      // Auto hide setelah 4.5 detik
      hideTimer.current = setTimeout(() => {
        dismiss();
      }, 4500);
    });

    return () => {
      unsub();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentNotif(null);
    });
  };

  const handlePress = () => {
    if (!currentNotif) return;
    const data = currentNotif.data;
    dismiss();

    if (data?.conversation_id) {
      router.push(`/chat-detail/${data.conversation_id}`);
    } else if (data?.session_id) {
      router.push('/(tabs)/schedule');
    } else if (data?.matched_user_id) {
      router.push('/(tabs)/matches');
    } else {
      router.push('/notifications');
    }
  };

  if (!currentNotif) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconWrap}>
          {currentNotif.avatar ? (
            <Image source={{ uri: currentNotif.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <Text style={styles.iconEmoji}>💬</Text>
          )}
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {currentNotif.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {currentNotif.body}
          </Text>
        </View>

        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 20, 36, 0.96)',
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(205, 79, 117, 0.4)',
    ...Shadow.medium,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(205, 79, 117, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatar: { width: 44, height: 44 },
  iconEmoji: { fontSize: 22 },
  textWrap: { flex: 1, marginRight: 8 },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  body: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
