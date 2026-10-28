import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../constants/theme';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { router } from 'expo-router';
import { formatRelativeTime } from '../lib/date';

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  match: { icon: '🤝', color: Colors.primary },
  message: { icon: '💬', color: Colors.accent },
  session_invite: { icon: '📅', color: Colors.yellow },
  session_confirmed: { icon: '✅', color: '#10b981' },
  review: { icon: '⭐', color: '#f59e0b' },
  system: { icon: '📢', color: Colors.textSecondary },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    loadNotifs().then(() => {
      getCurrentUser().then(user => {
        if (!user) return;
        ch = supabase
          .channel(`notifs_page_${user.id}_${Date.now()}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          }, payload => {
            const newNotif = payload.new as Notification;
            if (newNotif) {
              setNotifs(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)]);
            }
          })
          .subscribe();
      });
    });

    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  const loadNotifs = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    setUserId(user.id);
    const data = await getNotifications(user.id);
    setNotifs(data);
    setLoading(false);
  };

  const handleRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    // Navigate based on type
    if (notif.type === 'match' && notif.data?.matched_user_id) {
      router.push(`/user/${notif.data.matched_user_id}`);
    } else if (notif.type === 'message' && notif.data?.conversation_id) {
      router.push(`/chat-detail/${notif.data.conversation_id}`);
    } else if (
      (notif.type === 'session_invite' || notif.type === 'session_confirmed') &&
      notif.data?.session_id
    ) {
      router.push(`/session/${notif.data.session_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        onPress={() => handleRead(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.iconBg, { backgroundColor: config.color + '22' }]}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          {item.body && <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>}
          <Text style={styles.notifTime}>
            {formatRelativeTime(item.created_at)}
          </Text>
        </View>
        {!item.is_read && (
          <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifikasi {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Tandai semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>Belum ada notifikasi</Text>
          <Text style={styles.emptySubtitle}>Notifikasi pertemanan, pesan, dan jadwal akan muncul di sini.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingTop: 8, paddingBottom: 16,
  },
  backBtn: { padding: 4, marginRight: 8 },
  backIcon: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.primary },
  headerTitle: { flex: 1, fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.primary },
  markAllText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 8, ...Shadow.small,
  },
  notifCardUnread: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  iconBg: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  icon: { fontSize: 22 },
  notifContent: { flex: 1 },
  notifTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 2 },
  notifBody: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 4, lineHeight: 17 },
  notifTime: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textMuted },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontFamily: Fonts.regular, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
