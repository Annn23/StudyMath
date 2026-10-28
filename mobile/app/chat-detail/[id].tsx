import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Modal, Pressable, Alert,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  buildRoomName, buildCallMessage, parseCallMessage, CallType, initiateCallSession, updateCallStatus,
} from '../../lib/call';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Colors, Fonts, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { getMessages, sendMessage, getCurrentUser, markMessagesRead } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Message, Profile } from '../../types';
import { formatMessageTime, formatDayHeader, isDifferentDay, formatChatTime } from '../../lib/date';
import {
  pickImageFromGallery,
  takePhotoWithCamera,
  uploadChatImage,
  buildImageMessage,
  parseImageMessage,
  PickedMedia,
} from '../../lib/chatMedia';

const avatarOf = (p: Profile | null) =>
  p?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p?.full_name || 'User')}&background=cd4f75&color=fff`;

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: convId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [myName, setMyName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Media & Photo States
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<PickedMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const otherUserRef = useRef<Profile | null>(null);
  const myNameRef = useRef('');
  const flatListRef = useRef<FlatList>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        setKeyboardVisible(true);
        setTimeout(() => scrollToBottom(true), 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  // Muat data saat layar fokus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [convId])
  );

  // Realtime subscription terpisah di useEffect dengan nama channel unik
  useEffect(() => {
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    getCurrentUser().then(user => {
      if (!user || !convId) return;
      setUserId(user.id);

      const chName = `chat_detail_${convId}_${Date.now()}`;
      activeChannel = supabase
        .channel(chName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convId}`,
          },
          async payload => {
            const newMsg = payload.new as Message;
            setMessages(prev => {
              // Sudah ada (ID sama) — skip
              if (prev.find(m => m.id === newMsg.id)) return prev;
              // Pesan dari diri sendiri: ganti temp_xxx yang cocok isinya
              if (newMsg.sender_id === user.id) {
                const tempIdx = prev.findIndex(
                  m =>
                    (m.id.startsWith('temp_') && m.content === newMsg.content) ||
                    (m.id.startsWith('temp_img_') && (newMsg.image_url || newMsg.content.startsWith('[[IMAGE:')))
                );
                if (tempIdx !== -1) {
                  const updated = [...prev];
                  updated[tempIdx] = newMsg;
                  return updated;
                }
              }
              return [...prev, newMsg];
            });
            setTimeout(() => scrollToBottom(true), 80);

            // Tandai terbaca jika pesan dari orang lain
            if (newMsg.sender_id !== user.id) {
              await markMessagesRead(convId, user.id);
              // Panggilan masuk → tampilkan prompt angkat / tolak
              const call = parseCallMessage(newMsg.content);
              if (call) {
                const who = otherUserRef.current?.full_name || 'Partner';
                Alert.alert(
                  call.type === 'video' ? '📹 Panggilan video masuk' : '📞 Panggilan suara masuk',
                  `${who} sedang memanggilmu…`,
                  [
                    {
                      text: 'Tolak',
                      style: 'destructive',
                      onPress: () => updateCallStatus(call.room, 'rejected', otherUserRef.current?.id),
                    },
                    {
                      text: 'Angkat',
                      onPress: () => {
                        updateCallStatus(call.room, 'accepted', otherUserRef.current?.id);
                        openCall(call.type, call.room, 'receiver');
                      },
                    },
                  ]
                );
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convId}`,
          },
          payload => {
            const updatedMsg = payload.new as Message;
            if (!updatedMsg) return;
            // Update status centang dibaca secara realtime
            setMessages(prev =>
              prev.map(m => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
            );
          }
        )
        .subscribe();

      channelRef.current = activeChannel;
    });

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [convId, scrollToBottom]);

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    setUserId(user.id);

    // Load conversation info untuk dapat profil lawan
    const { data: convData } = await supabase
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', convId)
      .single();

    if (convData) {
      const otherId = convData.participant_1 === user.id ? convData.participant_2 : convData.participant_1;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', otherId).single();
      setOtherUser(prof);
      otherUserRef.current = prof;
    }
    const { data: meProf } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    const nm = meProf?.full_name || 'Pengguna';
    setMyName(nm);
    myNameRef.current = nm;

    const msgs = await getMessages(convId);
    setMessages(msgs);
    setLoading(false);
    await markMessagesRead(convId, user.id);

    // Selalu scroll ke pesan paling bawah (terbaru) saat chat dibuka
    setTimeout(() => scrollToBottom(false), 50);
    setTimeout(() => scrollToBottom(false), 150);
    setTimeout(() => scrollToBottom(false), 350);
  };

  const animateSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const openCall = (type: CallType, room: string, role: 'caller' | 'receiver' | 'joiner' = 'receiver') => {
    const p = otherUserRef.current;
    router.push({
      pathname: '/call/[room]',
      params: {
        room,
        type,
        name: p?.full_name || 'Partner',
        avatar: p?.avatar_url || '',
        me: myNameRef.current || 'Pengguna',
        role,
        receiverId: p?.id,
      },
    });
  };

  const startCall = async (type: CallType) => {
    if (!userId || !convId || !otherUser) return;
    const room = buildRoomName(convId);

    // Kirim sinyal panggilan realtime langsung ke HP lawan
    await initiateCallSession({
      conversationId: convId,
      callerId: userId,
      callerName: myNameRef.current || 'Teman Belajar',
      callerAvatar: '',
      receiverId: otherUser.id,
      room,
      type,
      status: 'calling',
    });

    // Kirim juga sebagai pesan agar tercatat di kartu obrolan
    await sendMessage(convId, userId, buildCallMessage(type, room));

    // Buka layar pemanggil dengan status "Memanggil..." dan menunggu lawan mengangkat
    router.push({
      pathname: '/call/[room]',
      params: {
        room,
        type,
        name: otherUser.full_name || 'Partner',
        avatar: otherUser.avatar_url || '',
        me: myNameRef.current || 'Pengguna',
        role: 'caller',
        receiverId: otherUser.id,
      },
    });
  };

  const handleSend = async () => {
    if (!text.trim() || !userId || sending) return;
    animateSend();
    const content = text.trim();
    setText('');
    setSending(true);

    // Optimistic insert
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      conversation_id: convId,
      sender_id: userId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const { error } = await sendMessage(convId, userId, content);
    setSending(false);

    if (error) {
      // Gagal kirim — hapus optimistic dan kembalikan teks
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setText(content);
    }
    // Sukses: Realtime subscription yang akan mengganti temp_xxx dengan data asli
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
    if (!selectedMedia || !userId || uploadingMedia) return;
    const media = selectedMedia;
    const caption = mediaCaption.trim();
    setSelectedMedia(null);
    setMediaCaption('');
    setUploadingMedia(true);

    const tempId = `temp_img_${Date.now()}`;
    const optimisticContent = buildImageMessage(media.uri, caption);
    const tempMsg: Message = {
      id: tempId,
      conversation_id: convId,
      sender_id: userId,
      content: optimisticContent,
      image_url: media.uri,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(true), 60);

    const { url, error: uploadErr } = await uploadChatImage(userId, media.base64, 'chat');
    setUploadingMedia(false);

    if (uploadErr || !url) {
      Alert.alert('Gagal Mengunggah', 'Tidak dapat mengunggah gambar ke server. Silakan coba lagi.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return;
    }

    const finalContent = buildImageMessage(url, caption);
    const { error: sendErr } = await sendMessage(convId, userId, finalContent, url);
    if (sendErr) {
      Alert.alert('Gagal Mengirim', 'Terjadi kesalahan saat mengirim pesan gambar.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === userId;
    const prevMsg = messages[index - 1];
    const showDay = !prevMsg || isDifferentDay(prevMsg.created_at, item.created_at);
    const showAvatar = !isMe && (!messages[index + 1] || messages[index + 1].sender_id !== item.sender_id);
    const isTemp = item.id.startsWith('temp_');
    const call = parseCallMessage(item.content);
    const img = parseImageMessage(item.content, item.image_url);

    return (
      <View>
        {showDay && (
          <View style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{formatDayHeader(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {/* Avatar lawan di kiri */}
          {!isMe && (
            <View style={styles.avatarSlot}>
              {showAvatar
                ? <Image source={{ uri: avatarOf(otherUser) }} style={styles.msgAvatar} contentFit="cover" />
                : <View style={styles.avatarPlaceholder} />
              }
            </View>
          )}

          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, img && styles.bubbleImageMode]}>
            {/* Nama pengirim lawan (hanya tampil di grup/pertama) */}
            {!isMe && showAvatar && otherUser?.full_name && (
              <Text style={styles.senderName}>{otherUser.full_name.split(' ')[0]}</Text>
            )}
            {call ? (
              <View style={styles.callCard}>
                <View style={[styles.callIconWrap, isMe && styles.callIconWrapMe]}>
                  <Text style={styles.callIcon}>{call.type === 'video' ? '📹' : '📞'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.callTitle, isMe && styles.bubbleTextMe]}>
                    {call.type === 'video' ? 'Panggilan video' : 'Panggilan suara'}
                  </Text>
                  <Text style={[styles.callSub, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                    {isMe ? 'Panggilan keluar' : 'Panggilan masuk'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.callJoinBtn, isMe && styles.callJoinBtnMe]}
                  onPress={() => openCall(call.type, call.room, isMe ? 'caller' : 'receiver')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.callJoinText, isMe && { color: Colors.primary }]}>Gabung</Text>
                </TouchableOpacity>
              </View>
            ) : img ? (
              <View style={styles.imgBubbleContent}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullscreenImage(img.url)}
                  style={styles.imgTouchable}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={styles.imgPhoto}
                    contentFit="cover"
                    transition={200}
                  />
                  {isTemp && (
                    <View style={styles.imgLoadingOverlay}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.imgLoadingText}>Mengunggah...</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {img.caption ? (
                  <Text style={[styles.bubbleText, styles.imgCaption, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>
                    {img.caption}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextOther]}>
                {item.content}
              </Text>
            )}
            <View style={styles.msgFooter}>
              <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                {formatMessageTime(item.created_at)}
              </Text>
              {isMe && (
                <Text style={[styles.readStatus, item.is_read && styles.readStatusRead]}>
                  {isTemp ? '🕐' : item.is_read ? '✓✓' : '✓'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      {/* Background gradient */}
      <LinearGradient colors={['#fce4f3', '#e8f7ff', '#fffbe6']} style={StyleSheet.absoluteFill} />

      {/* Header — mirip WA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        {otherUser ? (
          <TouchableOpacity
            style={styles.headerProfile}
            activeOpacity={0.7}
            onPress={() => otherUser.id && router.push(`/user/${otherUser.id}`)}
          >
            <View style={styles.headerAvatarWrap}>
              <Image source={{ uri: avatarOf(otherUser) }} style={styles.headerAvatar} contentFit="cover" />
              {otherUser.is_available && <View style={styles.headerOnline} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">
                {otherUser.full_name || 'Pengguna'}
              </Text>
              <Text
                style={[
                  styles.headerStatus,
                  { color: otherUser.is_available ? Colors.success : Colors.textMuted },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {otherUser.is_available
                  ? '● Online'
                  : otherUser.updated_at
                  ? `Aktif ${formatChatTime(otherUser.updated_at)}`
                  : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => startCall('video')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Panggilan video"
          >
            <Text style={styles.headerActionBtnText}>📹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => startCall('voice')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Panggilan suara"
          >
            <Text style={styles.headerActionBtnText}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Menu lainnya"
          >
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu ⋮ ala WhatsApp */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuBox, { top: insets.top + 56 }]}>
            {[
              { icon: '👤', label: 'Lihat profil', go: () => otherUser?.id && router.push(`/user/${otherUser.id}`) },
              { icon: '📅', label: 'Buat jadwal belajar', go: () => router.push(`/new-session?partner=${otherUser?.id}`) },
              { icon: '⭐', label: 'Beri ulasan & rating', go: () => otherUser?.id && router.push(`/review?partnerId=${otherUser.id}&partnerName=${encodeURIComponent(otherUser.full_name || '')}`) },
            ].map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={styles.menuItem}
                onPress={() => { setMenuOpen(false); opt.go(); }}
              >
                <Text style={styles.menuIcon}>{opt.icon}</Text>
                <Text style={styles.menuLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={messages.length > 0 ? messages.length : 30}
            maxToRenderPerBatch={30}
            windowSize={21}
            onContentSizeChange={() => scrollToBottom(false)}
            onLayout={() => scrollToBottom(false)}
            ListEmptyComponent={
              <View style={styles.emptyMsg}>
                <Text style={styles.emptyMsgEmoji}>👋</Text>
                <Text style={styles.emptyMsgText}>Mulai percakapan!</Text>
                <Text style={styles.emptyMsgSub}>
                  Sapa {otherUser?.full_name?.split(' ')[0] || 'partner belajarmu'} dan rencanakan sesi belajar bersama.
                </Text>
              </View>
            }
          />

          {/* Input area — mirip WA */}
          <View style={[styles.inputArea, { paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 12) }]}>
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

            <TextInput
              style={styles.input}
              placeholder={`Pesan ke ${otherUser?.full_name?.split(' ')[0] || 'partner'}...`}
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={text.trim() && !sending ? [Colors.secondary, Colors.primary] : ['#e0e0e0', '#bdbdbd']}
                  style={styles.sendBtnGradient}
                >
                  {sending
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.sendBtnIcon}>➤</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ==================== ACTION SHEET: PILIH FOTO / DOKUMEN ==================== */}
      <Modal
        visible={attachSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachSheetOpen(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setAttachSheetOpen(false)}>
          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.sheetTitle}>Kirim Foto & Berkas 📎</Text>

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
                <Text style={styles.sheetOptionSub}>Upload foto atau gambar dari perangkat</Text>
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
            <Text style={styles.previewHeaderTitle}>Kirim Foto ke {otherUser?.full_name?.split(' ')[0] || 'Partner'}</Text>
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
              style={[styles.previewSendBtn, uploadingMedia && styles.sendBtnDisabled]}
              onPress={handleSendMedia}
              disabled={uploadingMedia}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                style={styles.sendBtnGradient}
              >
                {uploadingMedia ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.sendBtnIcon}>➤</Text>
                )}
              </LinearGradient>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
    paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(205,79,117,0.08)',
    ...Shadow.small,
  },
  backBtn: { padding: 6, marginRight: 4 },
  backIcon: { fontSize: 24, color: Colors.primary, fontWeight: '600' },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.secondary },
  headerOnline: {
    position: 'absolute', bottom: 1, right: 1, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: Colors.white,
  },
  headerName: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.textPrimary },
  headerStatus: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(205,79,117,0.08)', marginLeft: 4,
  },
  headerActionBtnText: { fontSize: 18 },
  menuDots: { fontSize: 22, fontWeight: '800', color: Colors.primary, lineHeight: 24 },

  // Menu ⋮
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  menuBox: {
    position: 'absolute', right: 12, backgroundColor: '#fff', borderRadius: BorderRadius.md,
    paddingVertical: 6, minWidth: 210, ...Shadow.medium,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  menuIcon: { fontSize: 16 },
  menuLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },

  // Kartu panggilan di bubble
  callCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 220, paddingVertical: 2 },
  callIconWrap: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(205,79,117,0.12)',
  },
  callIconWrapMe: { backgroundColor: 'rgba(255,255,255,0.25)' },
  callIcon: { fontSize: 18 },
  callTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  callSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  callJoinBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.primary,
  },
  callJoinBtnMe: { backgroundColor: '#fff' },
  callJoinText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Messages
  msgList: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, paddingBottom: 8 },
  dayHeader: {
    alignItems: 'center', marginVertical: 12,
  },
  dayHeaderText: {
    fontFamily: Fonts.medium, fontSize: 11, color: Colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: BorderRadius.full, overflow: 'hidden',
  },
  msgRow: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end', paddingRight: 4 },
  msgRowOther: { justifyContent: 'flex-start', paddingLeft: 4 },
  avatarSlot: { width: 34, marginRight: 6, alignItems: 'center', justifyContent: 'flex-end' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: Colors.secondary },
  avatarPlaceholder: { width: 30 },
  bubble: {
    maxWidth: '72%', paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 18, marginBottom: 2,
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 5,
    ...Shadow.small,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomLeftRadius: 5,
    borderWidth: 1, borderColor: 'rgba(205,79,117,0.1)',
    ...Shadow.small,
  },
  senderName: {
    fontFamily: Fonts.semiBold, fontSize: 11,
    color: Colors.primary, marginBottom: 2,
  },
  bubbleText: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: Colors.white },
  bubbleTextOther: { color: Colors.textPrimary },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  msgTime: { fontFamily: Fonts.regular, fontSize: 10 },
  msgTimeMe: { color: 'rgba(255,255,255,0.65)' },
  msgTimeOther: { color: Colors.textMuted },
  readStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginLeft: 2,
  },
  readStatusRead: {
    color: '#93dcfc',
    fontWeight: 'bold',
    fontSize: 12,
  },

  // Input
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.md, paddingTop: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1, borderTopColor: 'rgba(205,79,117,0.08)',
    gap: 8,
  },
  input: {
    flex: 1, minHeight: 46, maxHeight: 130,
    backgroundColor: '#f8f4ff',
    borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(205,79,117,0.18)',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12,
    fontFamily: Fonts.regular, fontSize: 15, color: Colors.textPrimary,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendBtnIcon: { fontSize: 18, color: Colors.white, fontWeight: '700' },

  // Empty
  emptyMsg: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyMsgEmoji: { fontSize: 48, marginBottom: 12 },
  emptyMsgText: { fontFamily: Fonts.bold, fontSize: 18, color: Colors.textSecondary, marginBottom: 8 },
  emptyMsgSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Attach buttons in inputArea
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  attachBtnIcon: {
    fontSize: 19,
  },

  // Bubble Image Mode
  bubbleImageMode: {
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 7,
    maxWidth: '78%',
  },
  imgBubbleContent: {
    borderRadius: 14,
    overflow: 'hidden',
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
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
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
    overflow: 'hidden',
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
