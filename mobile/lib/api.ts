import { supabase } from './supabase';
import {
  Profile,
  Match,
  Conversation,
  Message,
  StudySession,
  Review,
  Notification,
  StudyServer,
  ServerMember,
  ServerMessage,
} from '../types';
import { sendPushNotification } from './notificationService';

// ==================== AUTH ====================

export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  meta?: {
    username?: string;
    grade_level?: string;
    university?: string;
    study_style?: string;
    location?: string;
    subjects?: string[];
    bio?: string;
  }
) => {
  const cleanUsername = meta?.username ? meta.username.replace(/^@/, '').toLowerCase().trim() : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username: cleanUsername,
        grade_level: 'Perkuliahan',
        ...(meta || {}),
      },
    },
  });

  // Jika user langsung dibuat (email confirmation off / session ready), update baris profil langsung
  if (data?.user && !error && meta) {
    try {
      await supabase
        .from('profiles')
        .update({
          username: cleanUsername || null,
          grade_level: meta.grade_level || 'Perkuliahan',
          university: meta.university || null,
          study_style: meta.study_style || null,
          location: meta.location || null,
          subjects: meta.subjects || [],
          bio: meta.bio || null,
        })
        .eq('id', data.user.id);
    } catch (e) {
      // non-critical
    }
  }

  return { data, error };
};

export const signIn = async (identifier: string, password: string) => {
  const clean = identifier.trim();
  let targetEmail = clean;

  // Cek apakah format input adalah email
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);

  if (!isEmail) {
    // Input adalah username (bisa dengan atau tanpa '@')
    const cleanUsername = clean.replace(/^@/, '').toLowerCase().trim();

    if (!cleanUsername) {
      return {
        data: null,
        error: { message: 'Username tidak boleh kosong' } as any,
      };
    }

    try {
      // Lookup email via RPC get_email_by_username
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: cleanUsername,
      });

      if (rpcError || !resolvedEmail) {
        return {
          data: null,
          error: {
            message: `Username "@${cleanUsername}" tidak ditemukan. Pastikan username benar atau coba masuk dengan email.`
          } as any,
        };
      }

      targetEmail = resolvedEmail;
    } catch (err: any) {
      return {
        data: null,
        error: {
          message: 'Gagal mencari akun dengan username tersebut. Silakan masuk menggunakan email.'
        } as any,
      };
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail.toLowerCase(),
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// ==================== PROFILES ====================

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
};

export const updateProfile = async (userId: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select();

  if (error) {
    console.error('[updateProfile] error:', JSON.stringify(error));
    return { data: null, error };
  }

  // Baris profil belum ada (mis. akun dibuat sebelum trigger handle_new_user aktif) → buat baru
  if (!data || data.length === 0) {
    const { data: inserted, error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .maybeSingle();
    if (upsertError) console.error('[updateProfile] upsert error:', JSON.stringify(upsertError));
    return { data: inserted, error: upsertError };
  }

  return { data: data[0], error: null };
};

// Ubah string base64 → ArrayBuffer (tanpa dependency tambahan)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const clean = base64.replace(/^data:.*;base64,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < len ? B64.indexOf(clean[i + 2]) : 0;
    const d = i + 3 < len ? B64.indexOf(clean[i + 3]) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[p++] = (n >> 16) & 255;
    if (i + 2 < len) bytes[p++] = (n >> 8) & 255;
    if (i + 3 < len) bytes[p++] = n & 255;
  }
  return bytes.buffer.slice(0, p);
};

/**
 * Upload avatar ke Supabase Storage (bucket "avatars").
 * @param base64 data base64 dari ImagePicker (opsi `base64: true`)
 */
export const uploadAvatar = async (userId: string, base64: string) => {
  const fileName = `${userId}/avatar_${Date.now()}.jpg`;

  if (!base64) {
    return { url: null, error: { message: 'Data gambar kosong' } as any };
  }
  const body = base64ToArrayBuffer(base64);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, body, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) return { url: null, error };

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  return { url: publicUrl, error: null };
};

// ==================== DISCOVER ====================

export const getDiscoverProfiles = async (
  userId: string,
  filters?: { subjects?: string[]; grade_level?: string; university?: string }
): Promise<Profile[]> => {
  // Get already actioned profiles
  const { data: actionedIds } = await supabase
    .from('matches')
    .select('target_user_id')
    .eq('user_id', userId);

  const excludeIds = [userId, ...(actionedIds?.map(m => m.target_user_id) || [])];

  let query = supabase
    .from('profiles')
    .select('*')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .eq('is_available', true)
    .eq('is_blocked', false)
    .limit(20);

  if (filters?.grade_level) {
    if (filters.grade_level === 'Perkuliahan') {
      query = query.in('grade_level', ['Perkuliahan', 'Kuliah']);
    } else {
      query = query.eq('grade_level', filters.grade_level);
    }
  }
  if (filters?.subjects && filters.subjects.length > 0) {
    query = query.overlaps('subjects', filters.subjects);
  }
  if (filters?.university && filters.university.trim() && filters.university !== 'Semua') {
    const trimmed = filters.university.trim();
    const shortMatch = trimmed.match(/\(([^)]+)\)/);
    if (shortMatch) {
      query = query.or(`university.ilike.%${shortMatch[1]}%,university.ilike.%${trimmed.replace(/\s*\([^)]+\)/, '').trim()}%`);
    } else {
      query = query.ilike('university', `%${trimmed}%`);
    }
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
};

/**
 * Cari teman belajar di sekitar (berdasarkan lokasi/kota), nama, atau username.
 */
export const searchNearbyProfiles = async ({
  currentUserId,
  searchQuery,
  location,
  subject,
  gradeLevel,
  university,
  isAvailable,
}: {
  currentUserId: string;
  searchQuery?: string;
  location?: string;
  subject?: string;
  gradeLevel?: string;
  university?: string;
  isAvailable?: boolean;
}): Promise<Profile[]> => {
  let q = supabase
    .from('profiles')
    .select('*')
    .neq('id', currentUserId)
    .eq('is_blocked', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (searchQuery && searchQuery.trim()) {
    const term = searchQuery.trim().replace(/^@/, '');
    q = q.or(`full_name.ilike.%${term}%,username.ilike.%${term}%,location.ilike.%${term}%,university.ilike.%${term}%`);
  }

  if (university && university.trim() && university !== 'Semua' && university !== 'Semua Univ') {
    const trimmed = university.trim();
    const shortMatch = trimmed.match(/\(([^)]+)\)/);
    if (shortMatch) {
      const shortCode = shortMatch[1];
      const fullName = trimmed.replace(/\s*\([^)]+\)/, '').trim();
      q = q.or(`university.ilike.%${shortCode}%,university.ilike.%${fullName}%`);
    } else {
      q = q.ilike('university', `%${trimmed}%`);
    }
  }

  if (location && location.trim() && location !== 'Semua') {
    q = q.ilike('location', `%${location.trim()}%`);
  }

  if (gradeLevel && gradeLevel !== 'Semua') {
    if (gradeLevel === 'Perkuliahan') {
      q = q.in('grade_level', ['Perkuliahan', 'Kuliah']);
    } else {
      q = q.eq('grade_level', gradeLevel);
    }
  }

  if (subject && subject !== 'Semua') {
    q = q.overlaps('subjects', [subject]);
  }

  if (isAvailable === true) {
    q = q.eq('is_available', true);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[searchNearbyProfiles]', error);
    return [];
  }
  return data || [];
};

export const searchProfiles = searchNearbyProfiles;

// ==================== MATCHES ====================

export const actionOnProfile = async (
  userId: string,
  targetUserId: string,
  action: 'like' | 'pass' | 'super_like'
) => {
  const isMatchAction = action === 'like' || action === 'super_like';

  // 1. Simpan baris aksi
  const { data, error } = await supabase
    .from('matches')
    .upsert(
      {
        user_id: userId,
        target_user_id: targetUserId,
        action,
        is_matched: isMatchAction,
      },
      { onConflict: 'user_id,target_user_id' }
    )
    .select()
    .single();

  if (isMatchAction && !error) {
    // 2. Hubungkan dua arah (reverse match) agar target user juga otomatis memiliki teman belajar
    try {
      await supabase
        .from('matches')
        .upsert(
          {
            user_id: targetUserId,
            target_user_id: userId,
            action: 'like',
            is_matched: true,
          },
          { onConflict: 'user_id,target_user_id' }
        );
    } catch (e) {
      console.warn('[actionOnProfile] reverse match error:', e);
    }

    // 3. Pastikan ruang obrolan (conversation) langsung siap
    try {
      await getOrCreateConversation(userId, targetUserId);
    } catch (e) {
      console.warn('[actionOnProfile] getOrCreateConversation error:', e);
    }
  }

  return { data: { ...(data || {}), is_matched: isMatchAction }, error };
};

export const getMatches = async (userId: string): Promise<Match[]> => {
  try {
    // 1. Matches yang dibuat oleh user (user_id = userId)
    const { data: myMatches, error: err1 } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .neq('action', 'pass');

    // 2. Matches di mana user diajak belajar oleh orang lain (target_user_id = userId)
    const { data: incomingMatches, error: err2 } = await supabase
      .from('matches')
      .select('*')
      .eq('target_user_id', userId)
      .neq('action', 'pass');

    if (err1) console.warn('[getMatches] err1:', err1);
    if (err2) console.warn('[getMatches] err2:', err2);

    const partnerIdMap = new Map<string, { match: any; partnerId: string }>();

    (myMatches || []).forEach(m => {
      if (m.target_user_id) {
        partnerIdMap.set(m.target_user_id, { match: m, partnerId: m.target_user_id });
      }
    });

    (incomingMatches || []).forEach(m => {
      if (m.user_id && !partnerIdMap.has(m.user_id)) {
        partnerIdMap.set(m.user_id, {
          match: { ...m, target_user_id: m.user_id },
          partnerId: m.user_id,
        });
      }
    });

    // 3. Sertakan juga partner dari percakapan aktif jika ada
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

    (convs || []).forEach(c => {
      const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;
      if (otherId && !partnerIdMap.has(otherId)) {
        partnerIdMap.set(otherId, {
          match: {
            id: c.id,
            user_id: userId,
            target_user_id: otherId,
            action: 'like',
            is_matched: true,
            created_at: new Date().toISOString(),
          },
          partnerId: otherId,
        });
      }
    });

    // 4. Enrich dengan profil lengkap masing-masing partner
    const entries = Array.from(partnerIdMap.values());
    const enrichedMatches = await Promise.all(
      entries.map(async ({ match, partnerId }) => {
        const prof = await getProfile(partnerId);
        return {
          ...match,
          is_matched: true,
          profile: prof || undefined,
        } as Match;
      })
    );

    return enrichedMatches.filter(m => !!m.profile);
  } catch (e) {
    console.error('[getMatches] error:', e);
    return [];
  }
};

// ==================== CONVERSATIONS ====================

export const getConversations = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (error) return [];

  // Enrich with other user profile
  const enriched = await Promise.all(
    (data || []).map(async (conv) => {
      const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;
      const profile = await getProfile(otherUserId);
      return { ...conv, other_user: profile };
    })
  );
  return enriched;
};

/**
 * Cari conversation antara dua user. Kalau belum ada, buat baru.
 * Dipakai saat tombol 💬 di halaman Match ditekan.
 */
export const getOrCreateConversation = async (
  userId: string,
  otherUserId: string
): Promise<string | null> => {
  // Coba cari conversation yang sudah ada
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${otherUserId}),` +
      `and(participant_1.eq.${otherUserId},participant_2.eq.${userId})`
    )
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Belum ada — buat baru
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: userId, participant_2: otherUserId })
    .select('id')
    .single();

  if (error) {
    console.error('[getOrCreateConversation]', JSON.stringify(error));
    // Coba cek sekali lagi barangkali dibuatkan oleh trigger di saat bersamaan
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${userId},participant_2.eq.${otherUserId}),` +
        `and(participant_1.eq.${otherUserId},participant_2.eq.${userId})`
      )
      .maybeSingle();
    if (retry?.id) return retry.id;
    return null;
  }
  return created?.id ?? null;
};

export const getMessages = async (conversationId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  imageUrl?: string
) => {
  const insertPayload: any = {
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  };
  if (imageUrl) {
    insertPayload.image_url = imageUrl;
  }

  let { data, error } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select()
    .single();

  // Jika kolom image_url belum ada di Supabase database user, fallback tanpa image_url
  if (error && imageUrl && error.message?.includes('image_url')) {
    const fallbackPayload = { conversation_id: conversationId, sender_id: senderId, content };
    const retry = await supabase.from('messages').insert(fallbackPayload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (!error) {
    const isImage = content.startsWith('[[IMAGE:') || !!imageUrl;
    const isCall = content.startsWith('[[CALL:');
    let preview = content;
    if (isImage) {
      const match = content.match(/^\[\[IMAGE:([^\|\]]+)(?:\|(.*))?\]\]$/);
      preview = match && match[2] ? `📷 ${match[2]}` : '📷 Foto';
    }

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({ last_message: preview, last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Kirim push notification langsung ke HP penerima
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .eq('id', conversationId)
        .single();

      if (conv) {
        const recipientId = conv.participant_1 === senderId ? conv.participant_2 : conv.participant_1;
        const { data: meProf } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', senderId)
          .single();

        const senderName = meProf?.full_name || 'Teman Belajar';

        sendPushNotification(recipientId, {
          title: isCall
            ? (content.includes(':video:') ? `📹 ${senderName} memanggilmu` : `📞 ${senderName} memanggilmu`)
            : isImage
            ? `${senderName} 📷`
            : `${senderName} 💬`,
          body: isCall
            ? 'Panggilan masuk — ketuk untuk bergabung'
            : isImage
            ? preview
            : (content.length > 80 ? content.slice(0, 80) + '…' : content),
          data: { conversation_id: conversationId, sender_id: senderId },
          channelId: isCall ? 'calls' : 'messages',
        });
      }
    } catch {
      // non-critical
    }
  }

  return { data, error };
};

export const markMessagesRead = async (conversationId: string, userId: string) => {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('is_read', false);
  if (error) {
    console.error('[markMessagesRead] error:', JSON.stringify(error));
  }
};

// ==================== STUDY SESSIONS ====================

export const getSessionById = async (sessionId: string): Promise<StudySession | null> => {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*, organizer:organizer_id(*), partner:partner_id(*)')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) return null;

  const session = data as StudySession;

  // Coba ambil peserta dari session_participants
  try {
    const { data: partData } = await supabase
      .from('session_participants')
      .select('*, profile:user_id(*)')
      .eq('session_id', sessionId);

    if (partData && partData.length > 0) {
      session.participants = partData
        .map((p: any) => p.profile)
        .filter(Boolean) as Profile[];
    }
  } catch (err) {
    // Abaikan jika tabel belum ada
  }

  // Jika participants belum terisi, coba ambil berdasarkan partner_ids atau partner_id
  if (!session.participants || session.participants.length === 0) {
    const pids =
      session.partner_ids && session.partner_ids.length > 0
        ? session.partner_ids
        : session.partner_id
        ? [session.partner_id]
        : [];

    if (pids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .in('id', pids);
      if (profs && profs.length > 0) {
        session.participants = profs as Profile[];
      }
    }
  }

  return session;
};

export const getStudySessions = async (userId: string): Promise<StudySession[]> => {
  let participantSessionIds: string[] = [];
  try {
    const { data: partData } = await supabase
      .from('session_participants')
      .select('session_id')
      .eq('user_id', userId);
    if (partData && partData.length > 0) {
      participantSessionIds = partData.map((p: any) => p.session_id);
    }
  } catch {
    // Abaikan jika tabel belum ada
  }

  let query = supabase
    .from('study_sessions')
    .select('*, organizer:organizer_id(*), partner:partner_id(*)');

  if (participantSessionIds.length > 0) {
    query = query.or(
      `organizer_id.eq.${userId},partner_id.eq.${userId},id.in.(${participantSessionIds.join(',')})`
    );
  } else {
    query = query.or(`organizer_id.eq.${userId},partner_id.eq.${userId}`);
  }

  const { data, error } = await query.order('scheduled_at', { ascending: true });
  if (error) return [];
  return (data || []) as StudySession[];
};

export const createStudySession = async (
  session: Partial<StudySession>,
  partnerIds: string[] = []
) => {
  const pids =
    partnerIds.length > 0
      ? partnerIds
      : session.partner_id
      ? [session.partner_id]
      : [];
  const primaryPartnerId = pids[0] || session.partner_id;

  const insertPayload: any = {
    ...session,
    partner_id: primaryPartnerId,
    partner_ids: pids,
  };

  let { data, error } = await supabase
    .from('study_sessions')
    .insert(insertPayload)
    .select()
    .single();

  // Jika kolom partner_ids belum ada di database, coba lagi tanpa partner_ids
  if (
    error &&
    (error.message?.includes('partner_ids') ||
      error.code === '42703' ||
      error.message?.includes('column'))
  ) {
    delete insertPayload.partner_ids;
    const retry = await supabase
      .from('study_sessions')
      .insert(insertPayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return { data, error };

  const createdSession = data as StudySession;

  // Simpan ke session_participants jika tabel sudah tersedia
  try {
    const participantsToInsert = [
      {
        session_id: createdSession.id,
        user_id: session.organizer_id,
        role: 'organizer',
        status: 'confirmed',
      },
      ...pids.map((pid) => ({
        session_id: createdSession.id,
        user_id: pid,
        role: 'participant',
        status: 'pending',
      })),
    ];
    await supabase.from('session_participants').insert(participantsToInsert);
  } catch {
    // Fallback halus jika tabel session_participants belum dibuat
  }

  // Kirim notifikasi 'session_invite' ke setiap partner yang dipilih
  try {
    const orgName = session.organizer?.full_name || 'Teman Belajar';
    for (const pid of pids) {
      await supabase.from('notifications').insert({
        user_id: pid,
        type: 'session_invite',
        title: 'Undangan Sesi Belajar Baru 📅',
        body: `${orgName} mengajakmu belajar bersama: ${session.title}`,
        data: {
          session_id: createdSession.id,
          organizer_id: session.organizer_id,
          title: session.title,
        },
      });
    }
  } catch {
    // Abaikan kegagalan notifikasi non-fatal
  }

  return { data: createdSession, error: null };
};

export const updateSessionStatus = async (
  sessionId: string,
  status: StudySession['status']
) => {
  const { data, error } = await supabase
    .from('study_sessions')
    .update({ status })
    .eq('id', sessionId)
    .select()
    .single();
  return { data, error };
};

export const notifySessionResponse = async (
  sessionId: string,
  organizerId: string,
  responderName: string,
  accepted: boolean,
  sessionTitle: string
) => {
  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: accepted ? 'session_confirmed' : 'system',
      title: accepted ? 'Undangan Sesi Diterima! 🎉' : 'Undangan Sesi Ditolak',
      body: accepted
        ? `${responderName} telah menerima undangan sesi: "${sessionTitle}"`
        : `${responderName} berhalangan hadir pada sesi: "${sessionTitle}"`,
      data: {
        session_id: sessionId,
        title: sessionTitle,
      },
    });
  } catch (err) {
    console.warn('notifySessionResponse error:', err);
  }
};

// ==================== REVIEWS ====================

export const getUserReviews = async (userId: string): Promise<Review[]> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:reviewer_id(*)')
    .eq('reviewed_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
};

export const createReview = async (review: Partial<Review>) => {
  const { data, error } = await supabase
    .from('reviews')
    .insert(review)
    .select()
    .single();
  return { data, error };
};

export const getSessionReview = async (
  sessionId: string,
  reviewerId: string
): Promise<Review | null> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('session_id', sessionId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();
  if (error) return null;
  return data;
};

// ==================== NOTIFICATIONS ====================

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data || [];
};

export const markNotificationRead = async (notificationId: string) => {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
};

export const markAllNotificationsRead = async (userId: string) => {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count || 0;
};

export const createNotification = async ({
  userId,
  type,
  title,
  body,
  data = {},
}: {
  userId: string;
  type: Notification['type'];
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}) => {
  const { data: row, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body: body || null,
      data,
      is_read: false,
    })
    .select()
    .single();

  // Kirim push notification ke HP penerima jika token tersedia
  sendPushNotification(userId, {
    title,
    body: body || '',
    data: data as Record<string, any>,
    channelId: type === 'message' ? 'messages' : 'default',
  }).catch(() => {});

  return { data: row, error };
};

// ==================== STUDY SERVERS & GROUPS ====================

/**
 * Mengambil daftar server / grup yang diikuti atau dimiliki oleh user
 */
export const getStudyServers = async (userId: string): Promise<StudyServer[]> => {
  try {
    // Cari ID server di mana user terdaftar sebagai member
    const { data: memberRows, error: memberErr } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', userId);

    if (memberErr) {
      console.warn('[getStudyServers] server_members query:', memberErr.message);
      return [];
    }

    const serverIds = (memberRows || []).map(r => r.server_id);

    // Ambil detail server (yang dimiliki user atau di mana user adalah anggota)
    let query = supabase.from('study_servers').select('*');
    if (serverIds.length > 0) {
      query = query.or(`owner_id.eq.${userId},id.in.(${serverIds.join(',')})`);
    } else {
      query = query.eq('owner_id', userId);
    }

    const { data: servers, error: serverErr } = await query.order('last_message_at', { ascending: false });
    if (serverErr) {
      console.warn('[getStudyServers] study_servers query:', serverErr.message);
      return [];
    }

    // Hitung jumlah anggota untuk setiap server
    const enriched = await Promise.all(
      (servers || []).map(async (srv) => {
        const { count } = await supabase
          .from('server_members')
          .select('*', { count: 'exact', head: true })
          .eq('server_id', srv.id);

        return {
          ...srv,
          members_count: count || 1,
          is_owner: srv.owner_id === userId,
        };
      })
    );

    return enriched;
  } catch (err) {
    console.warn('[getStudyServers] error:', err);
    return [];
  }
};

/**
 * Ambil detail satu server berdasarkan ID
 */
export const getStudyServerDetail = async (serverId: string, userId?: string): Promise<StudyServer | null> => {
  try {
    const { data, error } = await supabase
      .from('study_servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (error || !data) return null;

    const { count } = await supabase
      .from('server_members')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverId);

    return {
      ...data,
      members_count: count || 1,
      is_owner: userId ? data.owner_id === userId : false,
    };
  } catch (err) {
    console.warn('[getStudyServerDetail] error:', err);
    return null;
  }
};

/**
 * Ambil daftar anggota suatu server lengkap dengan profile masing-masing
 */
export const getServerMembers = async (serverId: string): Promise<ServerMember[]> => {
  try {
    const { data, error } = await supabase
      .from('server_members')
      .select('*, profile:user_id(*)')
      .eq('server_id', serverId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.warn('[getServerMembers] error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[getServerMembers] catch error:', err);
    return [];
  }
};

/**
 * Buat Server / Grup Belajar Baru
 */
export const createStudyServer = async ({
  name,
  description,
  subject = 'Umum',
  ownerId,
  memberIds = [],
}: {
  name: string;
  description?: string;
  subject?: string;
  ownerId: string;
  memberIds?: string[];
}): Promise<{ data: StudyServer | null; error: any }> => {
  try {
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=cd4f75&color=fff&size=200`;

    // 1. Masukkan ke study_servers
    const { data: server, error: createErr } = await supabase
      .from('study_servers')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        subject: subject || 'Umum',
        avatar_url: defaultAvatar,
        owner_id: ownerId,
        last_message: `Grup ${name.trim()} berhasil dibuat! Silakan mulai diskusi 📚`,
        last_message_at: new Date().toISOString(),
        last_message_sender: 'Sistem',
      })
      .select()
      .single();

    if (createErr || !server) {
      console.error('[createStudyServer] createErr:', JSON.stringify(createErr));
      return { data: null, error: createErr };
    }

    // 2. Daftarkan owner sebagai anggota dengan role 'owner'
    const memberEntries = [
      { server_id: server.id, user_id: ownerId, role: 'owner' as const },
      ...memberIds
        .filter(mId => mId !== ownerId)
        .map(mId => ({ server_id: server.id, user_id: mId, role: 'member' as const })),
    ];

    try {
      const { error: memberErr } = await supabase.from('server_members').insert(memberEntries);
      if (memberErr) {
        console.warn('[createStudyServer] memberErr:', JSON.stringify(memberErr));
      }
    } catch (mErr) {
      console.warn('[createStudyServer] catch memberErr:', mErr);
    }

    // 3. Masukkan pesan selamat datang pertama
    try {
      await supabase.from('server_messages').insert({
        server_id: server.id,
        sender_id: ownerId,
        content: `🎉 Selamat datang di grup ${name.trim()}! Ayo belajar dan berdiskusi matematika bersama!`,
      });
    } catch (msgErr) {
      console.warn('[createStudyServer] catch msgErr:', msgErr);
    }

    return {
      data: {
        ...server,
        members_count: memberEntries.length,
        is_owner: true,
      },
      error: null,
    };
  } catch (err) {
    console.error('[createStudyServer] catch error:', err);
    return { data: null, error: err };
  }
};

/**
 * Tambah anggota baru ke dalam server
 */
export const addServerMembers = async (
  serverId: string,
  userIds: string[]
): Promise<{ success: boolean; error: any }> => {
  try {
    if (!userIds || userIds.length === 0) return { success: true, error: null };

    // Cek yang sudah jadi member agar tidak duplicate
    const { data: existing } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', serverId);

    const existingSet = new Set((existing || []).map(e => e.user_id));
    const newMembers = userIds
      .filter(id => !existingSet.has(id))
      .map(id => ({ server_id: serverId, user_id: id, role: 'member' as const }));

    if (newMembers.length === 0) return { success: true, error: null };

    const { error } = await supabase.from('server_members').insert(newMembers);
    if (error) return { success: false, error };

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
};

/**
 * Hapus anggota dari server atau keluar dari server
 */
export const removeServerMember = async (
  serverId: string,
  userId: string
): Promise<{ success: boolean; error: any }> => {
  try {
    const { error } = await supabase
      .from('server_members')
      .delete()
      .eq('server_id', serverId)
      .eq('user_id', userId);

    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
};

/**
 * Ambil pesan chat dalam server
 */
export const getServerMessages = async (serverId: string): Promise<ServerMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('server_messages')
      .select('*, sender:sender_id(*)')
      .eq('server_id', serverId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[getServerMessages] error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[getServerMessages] catch error:', err);
    return [];
  }
};

/**
 * Kirim pesan ke server chat
 */
export const sendServerMessage = async (
  serverId: string,
  senderId: string,
  content: string,
  senderName?: string,
  imageUrl?: string
): Promise<{ data: ServerMessage | null; error: any }> => {
  try {
    const insertPayload: any = {
      server_id: serverId,
      sender_id: senderId,
      content: content.trim(),
    };
    if (imageUrl) {
      insertPayload.image_url = imageUrl;
    }

    let { data, error } = await supabase
      .from('server_messages')
      .insert(insertPayload)
      .select('*, sender:sender_id(*)')
      .single();

    if (error && imageUrl && error.message?.includes('image_url')) {
      const retry = await supabase
        .from('server_messages')
        .insert({
          server_id: serverId,
          sender_id: senderId,
          content: content.trim(),
        })
        .select('*, sender:sender_id(*)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) return { data: null, error };

    let preview = content.trim();
    if (preview.startsWith('[[IMAGE:') || imageUrl) {
      const match = preview.match(/^\[\[IMAGE:([^\|\]]+)(?:\|(.*))?\]\]$/);
      preview = match && match[2] ? `📷 ${match[2]}` : '📷 Foto';
    }

    // Update last message di tabel study_servers
    await supabase
      .from('study_servers')
      .update({
        last_message: preview,
        last_message_at: new Date().toISOString(),
        last_message_sender: senderName || 'Anggota',
      })
      .eq('id', serverId);

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
};

/**
 * Cari pengguna untuk diundang ke grup server berdasarkan nama atau username
 */
export const searchUsersForGroup = async (
  query: string,
  currentUserId: string
): Promise<Profile[]> => {
  try {
    const clean = query.trim().replace(/^@/, '');
    if (!clean) {
      // Tampilkan teman-teman belajar terhubung atau mahasiswa lain
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .eq('is_blocked', false)
        .limit(15);
      return data || [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId)
      .or(`full_name.ilike.%${clean}%,username.ilike.%${clean}%`)
      .limit(15);

    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
};

