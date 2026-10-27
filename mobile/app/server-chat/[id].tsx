import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  Alert,
  Keyboard,
  ScrollView,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import {
  getCurrentUser,
  getProfile,
  getStudyServerDetail,
  getServerMembers,
  getServerMessages,
  sendServerMessage,
  addServerMembers,
  removeServerMember,
  searchUsersForGroup,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { StudyServer, ServerMember, ServerMessage, Profile } from '../../types';
import { formatMessageTime, formatDayHeader, isDifferentDay } from '../../lib/date';
import {
  pickImageFromGallery,
  takePhotoWithCamera,
  uploadChatImage,
  buildImageMessage,
  parseImageMessage,
  PickedMedia,
} from '../../lib/chatMedia';

// Palet warna nama anggota seperti WhatsApp Group
const SENDER_COLORS = [
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#4f46e5', // Indigo
];

const getColorForSender = (senderId: string) => {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SENDER_COLORS.length;
  return SENDER_COLORS[index];
};

export default function ServerChatScreen() {
  const insets = useSafeAreaInsets();
  const { id: serverId } = useLocalSearchParams<{ id: string }>();

  const [server, setServer] = useState<StudyServer | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  // Media & Photo States
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<PickedMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Modal Info Server & Anggota
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  // Modal Tambah Anggota
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [searchCandidates, setSearchCandidates] = useState<Profile[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const scrollToBottom = useCallback((animated = false) => {
    if (!flatListRef.current) return;
    try {
      flatListRef.current.scrollToEnd({ animated });
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollToBottom(true), 80);
      }
    );
    return () => showSub.remove();
  }, [scrollToBottom]);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [serverId])
  );

  // Setup Supabase Realtime channel untuk pesan grup server
  useEffect(() => {
    if (!serverId) return;

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const chName = `server_chat_${serverId}_${Date.now()}`;
    activeChannel = supabase
      .channel(chName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_messages',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ServerMessage;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;

            // Cari profil pengirim dari members cache
            const memberObj = members.find((m) => m.user_id === newMsg.sender_id);
            const enrichedMsg: ServerMessage = {
              ...newMsg,
              sender: memberObj?.profile || (newMsg.sender_id === userId ? currentProfile || undefined : undefined),
            };

            // Ganti optimistic temp jika ada
            if (newMsg.sender_id === userId) {
              const tempIdx = prev.findIndex(
                (m) =>
                  (m.id.startsWith('temp_srv_') && m.content === newMsg.content) ||
                  (m.id.startsWith('temp_srv_img_') && (newMsg.image_url || newMsg.content.startsWith('[[IMAGE:')))
              );
              if (tempIdx !== -1) {
                const updated = [...prev];
                updated[tempIdx] = enrichedMsg;
                return updated;
              }
            }

            return [...prev, enrichedMsg];
          });
          setTimeout(() => scrollToBottom(true), 80);
        }
      )
      .subscribe();

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [serverId, members, scrollToBottom]);

  const loadInitialData = async () => {
    if (!serverId) return;
    setLoading(true);

    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      const prof = await getProfile(user.id);
      setCurrentProfile(prof);
    }

    const [srvData, membersData, messagesData] = await Promise.all([
      getStudyServerDetail(serverId, user?.id),
      getServerMembers(serverId),
      getServerMessages(serverId),
    ]);

    setServer(srvData);
    setMembers(membersData);
    setMessages(messagesData);
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 150);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !userId || !serverId || sending) return;

    // Animasi tombol kirim
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.8, duration: 60, useNativeDriver: true }),
      Animated.timing(sendScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    setText('');
    setSending(true);

    const senderName = currentProfile?.full_name || 'Anggota';
    const { data: sentMsg, error } = await sendServerMessage(
      serverId,
      userId,
      trimmed,
      senderName
    );

    setSending(false);

    if (error) {
      Alert.alert('Gagal Mengirim', error.message || 'Coba lagi nanti.');
      setText(trimmed);
      return;
    }

    if (sentMsg) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === sentMsg.id)) return prev;
        return [...prev, { ...sentMsg, sender: currentProfile || undefined }];
      });
      setTimeout(() => scrollToBottom(true), 60);
    }
  };

  const handlePickGallery = async () => {
    setAttachSheetOpen(false);
    const media = await pickImageFromGallery();
    if (media) {
      setSelectedMedia(media);
      setMediaCaption('');
    }
  };

  const handleCaptureCamera = async () => {
    setAttachSheetOpen(false);
    const media = await takePhotoWithCamera();
    if (media) {
      setSelectedMedia(media);
      setMediaCaption('');
    }
  };

  const handleSendMedia = async () => {
    if (!selectedMedia || !userId || !serverId || uploadingMedia) return;
    const media = selectedMedia;
    const caption = mediaCaption.trim();
    setSelectedMedia(null);
    setMediaCaption('');
    setUploadingMedia(true);

    const tempId = `temp_srv_img_${Date.now()}`;
    const optimisticContent = buildImageMessage(media.uri, caption);
    const tempMsg: ServerMessage = {
      id: tempId,
      server_id: serverId,
      sender_id: userId,
      content: optimisticContent,
      image_url: media.uri,
      created_at: new Date().toISOString(),
      sender: currentProfile || undefined,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(true), 60);

    const { url, error: uploadErr } = await uploadChatImage(userId, media.base64, 'server');
    setUploadingMedia(false);

    if (uploadErr || !url) {
      Alert.alert('Gagal Mengunggah', 'Tidak dapat mengunggah gambar ke server. Coba lagi.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    const finalContent = buildImageMessage(url, caption);
    const senderName = currentProfile?.full_name || 'Anggota';
    const { data: sentMsg, error: sendErr } = await sendServerMessage(
      serverId,
      userId,
      finalContent,
      senderName,
      url
    );

    if (sendErr) {
      Alert.alert('Gagal Mengirim', 'Terjadi kesalahan saat mengirim gambar ke grup.');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    if (sentMsg) {
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.find((m) => m.id === sentMsg.id)) return withoutTemp;
        return [...withoutTemp, { ...sentMsg, sender: currentProfile || undefined }];
      });
      setTimeout(() => scrollToBottom(true), 60);
    }
  };

  // Buka modal tambah anggota & load kandidat
  const openAddMemberModal = async () => {
    setAddMemberModalVisible(true);
    setSearchMemberQuery('');
    setSelectedToAdd([]);
    if (!userId) return;
    setCandidateLoading(true);
    const users = await searchUsersForGroup('', userId);
    // Filter yang sudah jadi anggota
    const existingIds = new Set(members.map((m) => m.user_id));
    setSearchCandidates(users.filter((u) => !existingIds.has(u.id)));
    setCandidateLoading(false);
  };

  const handleSearchCandidates = async (query: string) => {
    setSearchMemberQuery(query);
    if (!userId) return;
    setCandidateLoading(true);
    const users = await searchUsersForGroup(query, userId);
    const existingIds = new Set(members.map((m) => m.user_id));
    setSearchCandidates(users.filter((u) => !existingIds.has(u.id)));
    setCandidateLoading(false);
  };

  const toggleCandidate = (candidateId: string) => {
    if (selectedToAdd.includes(candidateId)) {
      setSelectedToAdd((prev) => prev.filter((id) => id !== candidateId));
    } else {
      setSelectedToAdd((prev) => [...prev, candidateId]);
    }
  };

  const submitAddMembers = async () => {
    if (selectedToAdd.length === 0 || !serverId) return;
    setAddingMembers(true);
    const { success, error } = await addServerMembers(serverId, selectedToAdd);
    setAddingMembers(false);

    if (!success) {
      Alert.alert('Gagal', error?.message || 'Tidak dapat menambahkan anggota.');
      return;
    }

    // Refresh daftar anggota
    const updatedMembers = await getServerMembers(serverId);
    setMembers(updatedMembers);
    setAddMemberModalVisible(false);
    Alert.alert('Berhasil! 🎉', `${selectedToAdd.length} anggota baru berhasil ditambahkan.`);
  };

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!serverId) return;
    Alert.alert(
      'Keluarkan Anggota',
      `Apakah Anda yakin ingin mengeluarkan ${memberName} dari server ini?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluarkan',
          style: 'destructive',
          onPress: async () => {
            const { success, error } = await removeServerMember(serverId, memberUserId);
            if (!success) {
              Alert.alert('Gagal', error?.message || 'Tidak dapat mengeluarkan anggota.');
              return;
            }
            setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
          },
        },
      ]
    );
  };

  const handleLeaveServer = async () => {
    if (!serverId || !userId) return;
    Alert.alert('Keluar dari Server', 'Apakah Anda yakin ingin keluar dari server grup ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await removeServerMember(serverId, userId);
          router.replace('/(tabs)/chat');
        },
      },
    ]);
  };

  const renderMessageItem = ({ item, index }: { item: ServerMessage; index: number }) => {
    const isMe = item.sender_id === userId;
    const isTemp = item.id.startsWith('temp_srv_img_');
    const img = parseImageMessage(item.content, item.image_url);
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDayHeader = !prevMsg || isDifferentDay(prevMsg.created_at, item.created_at);

    // Ambil info sender
    const sender = item.sender || members.find((m) => m.user_id === item.sender_id)?.profile;
    const senderName = sender?.full_name || 'Anggota';
    const senderColor = getColorForSender(item.sender_id);
    const avatarUri =
      sender?.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        senderName
      )}&background=93dcfc&color=1a5f7a&size=100`;

    return (
      <View>
        {showDayHeader && (
          <View style={styles.dayHeader}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayText}>{formatDayHeader(item.created_at)}</Text>
            </View>
          </View>
        )}

        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {/* Avatar pengirim (hanya untuk orang lain) */}
          {!isMe && (
            <Image source={{ uri: avatarUri }} style={styles.msgAvatar} contentFit="cover" />
          )}

          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {/* Nama pengirim dengan warna khas WhatsApp (hanya jika orang lain) */}
            {!isMe && (
              <Text style={[styles.senderName, { color: senderColor }]} numberOfLines={1}>
                {senderName}
              </Text>
            )}

            {/* Isi pesan / Foto */}
            {img ? (
              <View style={styles.imgBubbleContent}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullscreenImage(img.url)}
                  style={styles.imgTouchable}
                >
                  <Image source={{ uri: img.url }} style={styles.imgPhoto} contentFit="cover" />
                  {isTemp && (
                    <View style={styles.imgLoadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.imgLoadingText}>Mengirim foto...</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!!img.caption && (
                  <Text style={[styles.imgCaption, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                    {img.caption}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                {item.content}
              </Text>
            )}

            {(item.content.includes('Focus Mode') || item.content.includes('Pomodoro')) && (
              <TouchableOpacity
                style={styles.joinCallMsgBtn}
                onPress={() =>
                  router.push(
                    `/server-focus/${serverId}?type=video&name=${encodeURIComponent(server?.name || '')}`
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.joinCallMsgBtnText}>Gabung Sesi Pomodoro 🍅📹</Text>
              </TouchableOpacity>
            )}

            {/* Jam & Tanda centang */}
            <View style={styles.msgFooter}>
              <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                {formatMessageTime(item.created_at)}
              </Text>
              {isMe && <Text style={styles.checkMark}>✓</Text>}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const serverAvatarUri =
    server?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      server?.name || 'Group'
    )}&background=cd4f75&color=fff&size=200`;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#fce4f3', '#e8f7ff', '#fffbe6']}
          style={StyleSheet.absoluteFill}
        />
        <StatusBar style="dark" />

        {/* Header Grup Server */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerInfoWrap}
            onPress={() => setInfoModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.headerAvatarContainer}>
              <Image source={{ uri: serverAvatarUri }} style={styles.headerAvatar} />
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>👥</Text>
              </View>
            </View>

            <View style={styles.headerTexts}>
              <Text style={styles.serverNameText} numberOfLines={1}>
                {server?.name || 'Server Belajar'}
              </Text>
              <Text style={styles.serverMemberSubtitle} numberOfLines={1}>
                {members.length} Anggota • Ketuk info grup
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tombol Aksi: Telepon, Video Call, Focus Mode Pomodoro, Info */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                router.push(
                  `/server-focus/${serverId}?type=voice&name=${encodeURIComponent(server?.name || '')}`
                )
              }
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnIcon}>📞</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                router.push(
                  `/server-focus/${serverId}?type=video&name=${encodeURIComponent(server?.name || '')}`
                )
              }
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnIcon}>📹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.pomodoroActionBtn]}
              onPress={() =>
                router.push(
                  `/server-focus/${serverId}?type=video&name=${encodeURIComponent(server?.name || '')}`
                )
              }
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnIcon}>🍅</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setInfoModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnIcon}>👥</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Quick-Action Pomodoro Study Session */}
        <TouchableOpacity
          style={styles.pomodoroBanner}
          onPress={() =>
            router.push(
              `/server-focus/${serverId}?type=video&name=${encodeURIComponent(server?.name || '')}`
            )
          }
          activeOpacity={0.85}
        >
          <View style={styles.pomodoroBannerLeft}>
            <Text style={styles.pomodoroBannerIcon}>🍅</Text>
            <View>
              <Text style={styles.pomodoroBannerTitle}>Focus Mode (Pomodoro 25m) ⏱️</Text>
              <Text style={styles.pomodoroBannerSub}>
                Belajar bersama + Panggilan Video & Suara
              </Text>
            </View>
          </View>
          <View style={styles.pomodoroBannerJoinBadge}>
            <Text style={styles.pomodoroBannerJoinText}>Masuk ▶</Text>
          </View>
        </TouchableOpacity>

        {/* Konten Percakapan */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat percakapan server...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom(false)}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>Belum ada pesan di grup ini</Text>
                <Text style={styles.emptySub}>
                  Mulai percakapan dengan menyapa anggota grup lainnya!
                </Text>
              </View>
            }
          />
        )}

        {/* Input Bar WhatsApp-Style */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setAttachSheetOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.attachBtnIcon}>📎</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handleCaptureCamera}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.attachBtnIcon}>📷</Text>
          </TouchableOpacity>

          <View style={styles.inputPill}>
            <TextInput
              style={styles.textInput}
              placeholder="Ketik pesan ke grup..."
              placeholderTextColor="#94a3b8"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
          </View>

          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                text.trim().length === 0 && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={text.trim().length === 0 || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.sendIcon}>➤</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ==================== MODAL INFO SERVER & ANGGOTA ==================== */}
        <Modal
          visible={infoModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setInfoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              {/* Header Modal */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Info Server Belajar</Text>
                <TouchableOpacity
                  onPress={() => setInfoModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profil Server */}
                <View style={styles.modalServerProfile}>
                  <Image source={{ uri: serverAvatarUri }} style={styles.modalAvatar} />
                  <Text style={styles.modalServerName}>{server?.name}</Text>
                  <View style={styles.subjectPill}>
                    <Text style={styles.subjectPillText}>📚 {server?.subject || 'Umum'}</Text>
                  </View>
                  {server?.description ? (
                    <Text style={styles.modalServerDesc}>{server.description}</Text>
                  ) : null}
                </View>

                {/* Bagian Anggota */}
                <View style={styles.membersSectionHeader}>
                  <Text style={styles.membersSectionTitle}>
                    Anggota Server ({members.length})
                  </Text>
                  <TouchableOpacity
                    style={styles.addMemberBtn}
                    onPress={openAddMemberModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addMemberBtnText}>+ Tambah</Text>
                  </TouchableOpacity>
                </View>

                {/* List Anggota */}
                <View style={styles.membersList}>
                  {members.map((m) => {
                    const isOwner = server?.owner_id === m.user_id;
                    const isSelf = m.user_id === userId;
                    const canRemove = server?.owner_id === userId && !isOwner;
                    const memberName = m.profile?.full_name || 'Pengguna';
                    const memberUser = m.profile?.username || 'user';
                    const mAvatar =
                      m.profile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        memberName
                      )}&background=93dcfc&color=1a5f7a&size=100`;

                    return (
                      <View key={m.id} style={styles.memberRow}>
                        <Image source={{ uri: mAvatar }} style={styles.memberRowAvatar} />
                        <View style={styles.memberRowInfo}>
                          <View style={styles.memberRowNameWrap}>
                            <Text style={styles.memberRowName} numberOfLines={1}>
                              {memberName} {isSelf && '(Anda)'}
                            </Text>
                            {isOwner && (
                              <View style={styles.ownerBadge}>
                                <Text style={styles.ownerBadgeText}>👑 Pemilik</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.memberRowUser}>@{memberUser}</Text>
                        </View>

                        {canRemove && (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(m.user_id, memberName)}
                            style={styles.removeBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.removeBtnText}>Keluarkan</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Tombol Keluar dari Server */}
                <TouchableOpacity
                  style={styles.leaveServerBtn}
                  onPress={handleLeaveServer}
                  activeOpacity={0.8}
                >
                  <Text style={styles.leaveServerText}>🚪 Keluar dari Server Ini</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ==================== MODAL TAMBAH ANGGOTA ==================== */}
        <Modal
          visible={addMemberModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setAddMemberModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tambah Anggota Baru</Text>
                <TouchableOpacity
                  onPress={() => setAddMemberModalVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Kolom Pencarian */}
              <View style={styles.modalSearchBar}>
                <Text style={styles.modalSearchIcon}>🔍</Text>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Cari teman via nama / @username..."
                  placeholderTextColor="#94a3b8"
                  value={searchMemberQuery}
                  onChangeText={handleSearchCandidates}
                />
              </View>

              {/* Hasil Calon Anggota */}
              {candidateLoading ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={{ marginVertical: 20 }}
                />
              ) : searchCandidates.length === 0 ? (
                <Text style={styles.noCandidatesText}>
                  Tidak ada mahasiswa baru yang dapat ditambahkan.
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {searchCandidates.map((c) => {
                    const isSelected = selectedToAdd.includes(c.id);
                    const cAvatar =
                      c.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        c.full_name || 'User'
                      )}&background=93dcfc&color=1a5f7a&size=100`;

                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.candidateRow,
                          isSelected && styles.candidateRowSelected,
                        ]}
                        onPress={() => toggleCandidate(c.id)}
                        activeOpacity={0.75}
                      >
                        <Image source={{ uri: cAvatar }} style={styles.candidateAvatar} />
                        <View style={styles.candidateInfo}>
                          <Text style={styles.candidateName} numberOfLines={1}>
                            {c.full_name || 'Pengguna'}
                          </Text>
                          <Text style={styles.candidateUser}>@{c.username || 'user'}</Text>
                        </View>
                        <View
                          style={[
                            styles.candidateCheck,
                            isSelected && styles.candidateCheckActive,
                          ]}
                        >
                          {isSelected && <Text style={styles.candidateCheckText}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Tombol Simpan Tambah Anggota */}
              <TouchableOpacity
                style={[
                  styles.confirmAddBtn,
                  selectedToAdd.length === 0 && { opacity: 0.5 },
                ]}
                onPress={submitAddMembers}
                disabled={selectedToAdd.length === 0 || addingMembers}
                activeOpacity={0.85}
              >
                {addingMembers ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmAddBtnText}>
                    Tambahkan {selectedToAdd.length} Anggota 👥
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ==================== ACTION SHEET: PILIH FOTO / DOKUMEN ==================== */}
        <Modal
          visible={attachSheetOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachSheetOpen(false)}
        >
          <Pressable style={styles.sheetOverlay} onPress={() => setAttachSheetOpen(false)}>
            <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Text style={styles.sheetTitle}>Kirim Foto & Gambar ke Grup 📎</Text>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={handleCaptureCamera}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: '#fce7f3' }]}>
                  <Text style={styles.sheetIconText}>📸</Text>
                </View>
                <View style={styles.sheetTextWrap}>
                  <Text style={styles.sheetOptionLabel}>Ambil Foto dengan Kamera</Text>
                  <Text style={styles.sheetOptionSub}>Buka kamera untuk foto langsung</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={handlePickGallery}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetIconWrap, { backgroundColor: '#eff6ff' }]}>
                  <Text style={styles.sheetIconText}>🖼️</Text>
                </View>
                <View style={styles.sheetTextWrap}>
                  <Text style={styles.sheetOptionLabel}>Pilih dari Galeri Foto</Text>
                  <Text style={styles.sheetOptionSub}>Upload gambar materi/tugas dari HP</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setAttachSheetOpen(false)}
              >
                <Text style={styles.sheetCancelText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* ==================== MODAL: PREVIEW FOTO DENGAN CAPTION ==================== */}
        <Modal
          visible={!!selectedMedia}
          transparent={false}
          animationType="slide"
          onRequestClose={() => {
            if (!uploadingMedia) setSelectedMedia(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.previewScreenContainer}
          >
            {/* Header Preview */}
            <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity
                onPress={() => {
                  if (!uploadingMedia) setSelectedMedia(null);
                }}
                style={styles.previewCloseBtn}
                disabled={uploadingMedia}
              >
                <Text style={styles.previewCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.previewHeaderTitle}>
                Kirim Foto ke {server?.name || 'Grup'}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Image Display */}
            <View style={styles.previewImageArea}>
              {selectedMedia && (
                <Image
                  source={{ uri: selectedMedia.uri }}
                  style={styles.previewImage}
                  contentFit="contain"
                />
              )}
            </View>

            {/* Caption & Send Bar */}
            <View style={[styles.previewBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TextInput
                style={styles.previewCaptionInput}
                placeholder="Tambah keterangan foto (opsional)..."
                placeholderTextColor="#9ca3af"
                value={mediaCaption}
                onChangeText={setMediaCaption}
                multiline
                maxLength={500}
                editable={!uploadingMedia}
              />

              <TouchableOpacity
                style={[styles.previewSendBtn, uploadingMedia && styles.sendButtonDisabled]}
                onPress={handleSendMedia}
                disabled={uploadingMedia}
                activeOpacity={0.8}
              >
                {uploadingMedia ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.sendIcon}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================== MODAL: FULLSCREEN IMAGE VIEWER ==================== */}
        <Modal
          visible={!!fullscreenImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullscreenImage(null)}
        >
          <View style={styles.fullscreenModalRoot}>
            <TouchableOpacity
              style={[styles.fullscreenCloseBtn, { top: insets.top + 12 }]}
              onPress={() => setFullscreenImage(null)}
            >
              <Text style={styles.fullscreenCloseText}>✕</Text>
            </TouchableOpacity>

            {fullscreenImage && (
              <Image
                source={{ uri: fullscreenImage }}
                style={styles.fullscreenImage}
                contentFit="contain"
              />
            )}
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(205,79,117,0.1)',
    ...Shadow.small,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  backArrow: {
    fontSize: 32,
    lineHeight: 34,
    color: Colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  headerInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(205,79,117,0.25)',
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupBadgeText: {
    fontSize: 9,
  },
  headerTexts: { flex: 1 },
  serverNameText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  serverMemberSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(205,79,117,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pomodoroActionBtn: {
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
  },
  actionBtnIcon: { fontSize: 16 },
  pomodoroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    marginHorizontal: Spacing.md,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    ...Shadow.small,
  },
  pomodoroBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pomodoroBannerIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  pomodoroBannerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    color: '#ea580c',
  },
  pomodoroBannerSub: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  pomodoroBannerJoinBadge: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  pomodoroBannerJoinText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: '#ffffff',
  },
  joinCallMsgBtn: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    marginTop: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  joinCallMsgBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    color: '#ea580c',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 20,
  },
  dayHeader: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dayBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#64748b',
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    ...Shadow.small,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  senderName: {
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    marginBottom: 2,
  },
  msgText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  msgTextMe: {
    color: '#ffffff',
  },
  msgTextOther: {
    color: Colors.textPrimary,
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 3,
  },
  msgTime: {
    fontFamily: Fonts.regular,
    fontSize: 10,
  },
  msgTimeMe: {
    color: 'rgba(255,255,255,0.75)',
  },
  msgTimeOther: {
    color: '#94a3b8',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  inputPill: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
    marginRight: 8,
  },
  textInput: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    maxHeight: 90,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.small,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendIcon: {
    color: '#ffffff',
    fontSize: 18,
    marginLeft: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  modalServerProfile: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 10,
  },
  modalServerName: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subjectPill: {
    backgroundColor: 'rgba(205,79,117,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: 8,
  },
  subjectPillText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  modalServerDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  membersSectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  addMemberBtn: {
    backgroundColor: 'rgba(205,79,117,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  addMemberBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  membersList: {
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  memberRowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  memberRowInfo: {
    flex: 1,
  },
  memberRowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberRowName: {
    fontFamily: Fonts.semiBold,
    fontSize: 13.5,
    color: Colors.textPrimary,
  },
  ownerBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9.5,
    color: '#d97706',
  },
  memberRowUser: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  removeBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#dc2626',
  },
  leaveServerBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    backgroundColor: '#fff1f2',
    marginTop: 8,
  },
  leaveServerText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#e11d48',
  },
  // Modal Search Calon Anggota
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  modalSearchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  noCandidatesText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 20,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  candidateRowSelected: {
    backgroundColor: 'rgba(205,79,117,0.08)',
  },
  candidateAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  candidateUser: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  candidateCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateCheckActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  candidateCheckText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  confirmAddBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    ...Shadow.small,
  },
  confirmAddBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#ffffff',
  },

  // Media & Attachment Styles
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  attachBtnIcon: {
    fontSize: 20,
  },
  imgBubbleContent: {
    marginBottom: 4,
  },
  imgTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  imgPhoto: {
    width: 240,
    height: 240,
    borderRadius: 14,
  },
  imgLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  imgLoadingText: {
    color: '#ffffff',
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    marginTop: 6,
  },
  imgCaption: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 2,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 19,
  },

  // Attachment Sheet Modal
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sheetTitle: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sheetIconText: {
    fontSize: 22,
  },
  sheetTextWrap: {
    flex: 1,
  },
  sheetOptionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  sheetOptionSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: BorderRadius.full,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Preview & Caption Modal
  previewScreenContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
  },
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewHeaderTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  previewImageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    backgroundColor: '#0f172a',
    gap: 10,
  },
  previewCaptionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#ffffff',
    maxHeight: 100,
  },
  previewSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Fullscreen Viewer Modal
  fullscreenModalRoot: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
