import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getConversations, getStudyServers, getCurrentUser } from '../../lib/api';
import { Conversation, StudyServer } from '../../types';
import { router, useFocusEffect } from 'expo-router';
import { formatChatTime } from '../../lib/date';
import { previewText } from '../../lib/call';

type TabFilter = 'all' | 'personal' | 'groups';

type CombinedChatItem =
  | { type: 'personal'; data: Conversation; sortTime: number }
  | { type: 'server'; data: StudyServer; sortTime: number };

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [servers, setServers] = useState<StudyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<TabFilter>('all');

  useFocusEffect(
    useCallback(() => {
      loadAllChats();
    }, [])
  );

  const loadAllChats = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [convData, serverData] = await Promise.all([
      getConversations(user.id),
      getStudyServers(user.id),
    ]);

    setConversations(convData);
    setServers(serverData);
    setLoading(false);
  };

  // Gabungkan dan urutkan berdasarkan pesan terakhir
  const getDisplayItems = (): CombinedChatItem[] => {
    const personalItems: CombinedChatItem[] = conversations.map((conv) => ({
      type: 'personal',
      data: conv,
      sortTime: conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0,
    }));

    const serverItems: CombinedChatItem[] = servers.map((srv) => ({
      type: 'server',
      data: srv,
      sortTime: srv.last_message_at ? new Date(srv.last_message_at).getTime() : 0,
    }));

    if (filterTab === 'personal') return personalItems;
    if (filterTab === 'groups') return serverItems;

    // 'all': Gabungkan dan urutkan yang paling baru
    return [...personalItems, ...serverItems].sort((a, b) => b.sortTime - a.sortTime);
  };

  const displayItems = getDisplayItems();

  const renderItem = ({ item }: { item: CombinedChatItem }) => {
    if (item.type === 'personal') {
      const conv = item.data;
      const other = conv.other_user;
      const avatarUri =
        other?.avatar_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          other?.full_name || 'User'
        )}&background=93dcfc&color=1a5f7a&size=200`;
      const timeAgo = formatChatTime(conv.last_message_at);

      return (
        <TouchableOpacity
          style={styles.convCard}
          activeOpacity={0.85}
          onPress={() => router.push(`/chat-detail/${conv.id}`)}
        >
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            {other?.is_available && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.convInfo}>
            <View style={styles.convTop}>
              <Text style={styles.convName} numberOfLines={1} ellipsizeMode="tail">
                {other?.full_name || 'Pengguna'}
              </Text>
              {timeAgo ? (
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText} numberOfLines={1}>
                    {timeAgo}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.convLastMsg} numberOfLines={1} ellipsizeMode="tail">
              {previewText(conv.last_message) || '💬 Mulai percakapan'}
            </Text>

            <View style={styles.convBottom}>
              {other?.username ? (
                <Text style={styles.convUsername} numberOfLines={1}>
                  @{other.username}
                </Text>
              ) : null}
              {other?.subjects && other.subjects.length > 0 && (
                <Text style={styles.convSubjects} numberOfLines={1}>
                  📚 {other.subjects.slice(0, 2).join(', ')}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Render Server / Grup Card
    const srv = item.data;
    const avatarUri =
      srv.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        srv.name
      )}&background=cd4f75&color=fff&size=200`;
    const timeAgo = formatChatTime(srv.last_message_at);

    return (
      <TouchableOpacity
        style={[styles.convCard, styles.serverCard]}
        activeOpacity={0.85}
        onPress={() => router.push(`/server-chat/${srv.id}`)}
      >
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          <View style={styles.serverGroupBadge}>
            <Text style={styles.serverGroupBadgeIcon}>👥</Text>
          </View>
        </View>

        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <View style={styles.serverTitleRow}>
              <Text style={styles.convName} numberOfLines={1} ellipsizeMode="tail">
                {srv.name}
              </Text>
              <View style={styles.serverTag}>
                <Text style={styles.serverTagText}>Grup</Text>
              </View>
            </View>

            {timeAgo ? (
              <View style={[styles.timeBadge, styles.serverTimeBadge]}>
                <Text style={[styles.timeBadgeText, styles.serverTimeBadgeText]} numberOfLines={1}>
                  {timeAgo}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.convLastMsg} numberOfLines={1} ellipsizeMode="tail">
            {srv.last_message_sender ? (
              <Text style={styles.serverSenderName}>{srv.last_message_sender}: </Text>
            ) : null}
            {srv.last_message || 'Belum ada pesan di grup ini'}
          </Text>

          <View style={styles.convBottom}>
            <Text style={styles.serverMemberCount}>
              👥 {srv.members_count || 1} Anggota
            </Text>
            {srv.subject ? (
              <Text style={styles.convSubjects} numberOfLines={1}>
                📚 {srv.subject}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />
      <StatusBar style="dark" />

      {/* Header Utama */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Chat & Server 💬</Text>
          <Text style={styles.headerSub}>Obrolan pribadi & server belajar matematika</Text>
        </View>

        {/* Tombol Buat Server Baru */}
        <TouchableOpacity
          style={styles.newServerBtn}
          onPress={() => router.push('/create-server')}
          activeOpacity={0.8}
        >
          <Text style={styles.newServerBtnIcon}>👥</Text>
          <Text style={styles.newServerBtnText}>+ Server</Text>
        </TouchableOpacity>
      </View>

      {/* WhatsApp-Style Filter Pills */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          <TouchableOpacity
            style={[styles.filterPill, filterTab === 'all' && styles.filterPillActive]}
            onPress={() => setFilterTab('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterPillText, filterTab === 'all' && styles.filterPillTextActive]}>
              Semua ({conversations.length + servers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterTab === 'personal' && styles.filterPillActive]}
            onPress={() => setFilterTab('personal')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterTab === 'personal' && styles.filterPillTextActive,
              ]}
            >
              💬 Pribadi ({conversations.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filterTab === 'groups' && styles.filterPillActive]}
            onPress={() => setFilterTab('groups')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                filterTab === 'groups' && styles.filterPillTextActive,
              ]}
            >
              👥 Server / Grup ({servers.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Daftar Percakapan */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat obrolan...</Text>
        </View>
      ) : displayItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>
            {filterTab === 'groups' ? '👥' : '💬'}
          </Text>
          <Text style={styles.emptyTitle}>
            {filterTab === 'groups'
              ? 'Belum ada Server / Grup'
              : filterTab === 'personal'
              ? 'Belum ada chat pribadi'
              : 'Belum ada obrolan'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filterTab === 'groups'
              ? 'Buat server baru dan undang teman belajar untuk berdiskusi bersama!'
              : 'Temukan partner belajarmu via username atau matkul, lalu mulai chat!'}
          </Text>

          {filterTab === 'groups' && (
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/create-server')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyActionBtnText}>+ Buat Server Sekarang 🚀</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) =>
            item.type === 'personal' ? `p_${item.data.id}` : `s_${item.data.id}`
          }
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    fontFamily: Fonts.extraBold,
    fontSize: 24,
    color: Colors.primary,
  },
  headerSub: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  newServerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    marginLeft: 8,
    ...Shadow.small,
  },
  newServerBtnIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  newServerBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  filterBarContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 8,
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.12)',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontFamily: Fonts.bold,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: 8,
    paddingBottom: 100,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: BorderRadius.xl,
    padding: 13,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(205,79,117,0.1)',
    ...Shadow.small,
  },
  serverCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(205,79,117,0.2)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  serverGroupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 9,
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  serverGroupBadgeIcon: {
    fontSize: 9,
  },
  convInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  convTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  serverTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  serverTag: {
    backgroundColor: 'rgba(205,79,117,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  serverTagText: {
    fontFamily: Fonts.bold,
    fontSize: 9.5,
    color: Colors.primary,
  },
  convName: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  timeBadge: {
    backgroundColor: 'rgba(205, 79, 117, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(205, 79, 117, 0.14)',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10.5,
    color: Colors.primary,
  },
  serverTimeBadge: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  serverTimeBadgeText: {
    color: '#2563eb',
  },
  convLastMsg: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  serverSenderName: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  convBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  convUsername: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.primary,
    backgroundColor: 'rgba(205, 79, 117, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  serverMemberCount: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  convSubjects: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 14 },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.xl,
    ...Shadow.small,
  },
  emptyActionBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#ffffff',
  },
});
