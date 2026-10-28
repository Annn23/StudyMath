import { supabase } from './supabase';
import { sendPushNotification } from './notificationService';

/**
 * Helper panggilan video / suara berbasis Jitsi Meet (WebRTC, gratis, tanpa API key)
 * dengan Signaling Realtime ala WhatsApp (calling -> ringing -> accepted/rejected/ended).
 */

export const VIDEO_CALL_SERVER = 'https://meet.jit.si';

export type CallType = 'video' | 'voice';
export type CallStatus = 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'timeout';

export interface CallSession {
  id?: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  room: string;
  type: CallType;
  status: CallStatus;
}

const CALL_REGEX = /^\[\[CALL:(video|voice):([A-Za-z0-9_-]+)\]\]$/;

export const buildRoomName = (conversationId: string) =>
  `StudyMatch_${conversationId.replace(/-/g, '').slice(0, 20)}_${Date.now().toString(36)}`;

export const buildCallMessage = (type: CallType, room: string) => `[[CALL:${type}:${room}]]`;

export const parseCallMessage = (content: string | null | undefined): { type: CallType; room: string } | null => {
  if (!content) return null;
  const m = content.trim().match(CALL_REGEX);
  return m ? { type: m[1] as CallType, room: m[2] } : null;
};

/** Teks ramah untuk preview di daftar chat / notifikasi. */
export const previewText = (content: string | null | undefined) => {
  const call = parseCallMessage(content);
  if (call) return call.type === 'video' ? '📹 Panggilan video' : '📞 Panggilan suara';
  if (content && content.startsWith('[[IMAGE:')) {
    const match = content.match(/^\[\[IMAGE:([^\|\]]+)(?:\|(.*))?\]\]$/);
    if (match) {
      return match[2] ? `📷 Foto: ${match[2]}` : '📷 Foto';
    }
    return '📷 Foto';
  }
  return content || '';
};

export const buildCallUrl = (room: string, type: CallType, displayName: string) => {
  const cfg = [
    'config.prejoinPageEnabled=false',
    'config.prejoinConfig.enabled=false',
    'config.disableDeepLinking=true',
    `config.startWithVideoMuted=${type === 'voice'}`,
    'config.startWithAudioMuted=false',
    'config.disableInviteFunctions=true',
    'interfaceConfig.MOBILE_APP_PROMO=false',
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`,
  ].join('&');
  return `${VIDEO_CALL_SERVER}/${room}#${cfg}`;
};

/**
 * Inisialisasi panggilan: simpan ke database (jika ada active_calls)
 * dan broadcast sinyal panggilan langsung ke kanal Realtime milik penerima.
 */
export async function initiateCallSession(session: CallSession): Promise<string> {
  let callId = `call_${Date.now()}`;

  try {
    const { data } = await supabase
      .from('active_calls')
      .insert({
        conversation_id: session.conversationId,
        caller_id: session.callerId,
        receiver_id: session.receiverId,
        room_name: session.room,
        call_type: session.type,
        status: 'calling',
      })
      .select('id')
      .single();

    if (data?.id) callId = data.id;
  } catch {
    // Toleran bila migrasi database belum dieksekusi
  }

  // Broadcast sinyal ke user penerima (bisa diterima di layar manapun!)
  try {
    const existing = supabase.getChannels().find(
      (c) => c.topic === `user_call:${session.receiverId}` || c.topic === `realtime:user_call:${session.receiverId}`
    );
    if (existing && existing.state === 'joined') {
      existing.send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: { ...session, id: callId },
      });
    } else {
      const userCh = supabase.channel(`user_call:${session.receiverId}`);
      userCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          userCh.send({
            type: 'broadcast',
            event: 'incoming_call',
            payload: { ...session, id: callId },
          });
        }
      });
    }
  } catch (err) {
    console.warn('[initiateCallSession] broadcast error:', err);
  }

  // Kirim push notification ke HP penerima (muncul di status bar meskipun app di background)
  try {
    sendPushNotification(session.receiverId, {
      title: session.type === 'video' ? `📹 ${session.callerName} memanggilmu` : `📞 ${session.callerName} memanggilmu`,
      body: 'Panggilan masuk — ketuk untuk membuka',
      data: {
        room: session.room,
        call_type: session.type,
        conversation_id: session.conversationId,
        caller_id: session.callerId,
      },
      channelId: 'calls',
    });
  } catch {
    // non-critical
  }

  return callId;
}

/**
 * Update status panggilan (calling -> ringing -> accepted -> rejected -> ended)
 * dan beritahu seluruh peserta di room via Broadcast dan DB.
 */
export async function updateCallStatus(room: string, status: CallStatus, receiverId?: string) {
  // 1. Broadcast ke room
  try {
    const roomCh = supabase.channel(`call_room:${room}`);
    roomCh.subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        roomCh.send({
          type: 'broadcast',
          event: 'status_change',
          payload: { room, status },
        });
      }
    });
  } catch (err) {
    console.warn('[updateCallStatus] broadcast error:', err);
  }

  // 2. Jika panggilan dibatalkan/ditutup oleh pemanggil, beritahu penerima agar nada dering mati
  if ((status === 'ended' || status === 'rejected') && receiverId) {
    try {
      const existing = supabase.getChannels().find(
        (c) => c.topic === `user_call:${receiverId}` || c.topic === `realtime:user_call:${receiverId}`
      );
      if (existing && existing.state === 'joined') {
        existing.send({
          type: 'broadcast',
          event: 'call_dismiss',
          payload: { room, status },
        });
      } else {
        const userCh = supabase.channel(`user_call:${receiverId}`);
        userCh.subscribe((st) => {
          if (st === 'SUBSCRIBED') {
            userCh.send({
              type: 'broadcast',
              event: 'call_dismiss',
              payload: { room, status },
            });
          }
        });
      }
    } catch {
      // ignore
    }
  }

  // 3. Update database
  try {
    const dbStatus = status === 'timeout' ? 'ended' : status;
    await supabase
      .from('active_calls')
      .update({ status: dbStatus, updated_at: new Date().toISOString() })
      .eq('room_name', room);
  } catch {
    // ignore jika belum ada tabel
  }
}

/**
 * Dengarkan perubahan status di dalam room panggilan tertentu.
 */
export function listenToCallRoom(room: string, onStatus: (status: CallStatus) => void) {
  const existing = supabase.getChannels().find(
    (c) => c.topic === `call_room:${room}` || c.topic === `realtime:call_room:${room}`
  );
  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel(`call_room:${room}`)
    .on('broadcast', { event: 'status_change' }, ({ payload }) => {
      if (payload?.status) {
        onStatus(payload.status);
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'active_calls',
        filter: `room_name=eq.${room}`,
      },
      (payload) => {
        const row = payload.new as { status?: CallStatus };
        if (row?.status) onStatus(row.status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Dengarkan panggilan masuk global untuk user tertentu (di halaman manapun di aplikasi).
 */
export function listenToIncomingCalls(
  userId: string,
  onIncoming: (call: CallSession) => void,
  onDismiss: (room: string) => void
) {
  const existing = supabase.getChannels().find(
    (c) => c.topic === `user_call:${userId}` || c.topic === `realtime:user_call:${userId}`
  );
  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel(`user_call:${userId}`)
    .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
      if (payload) onIncoming(payload as CallSession);
    })
    .on('broadcast', { event: 'call_dismiss' }, ({ payload }) => {
      if (payload?.room) onDismiss(payload.room);
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'active_calls',
        filter: `receiver_id=eq.${userId}`,
      },
      async (payload) => {
        const row = payload.new as any;
        if (row && row.status === 'calling') {
          // Ambil nama & avatar pemanggil
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', row.caller_id)
            .single();

          onIncoming({
            id: row.id,
            conversationId: row.conversation_id,
            callerId: row.caller_id,
            callerName: prof?.full_name || 'Teman Belajar',
            callerAvatar: prof?.avatar_url,
            receiverId: row.receiver_id,
            room: row.room_name,
            type: row.call_type,
            status: 'calling',
          });
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'active_calls',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as any;
        if (row && (row.status === 'ended' || row.status === 'rejected')) {
          onDismiss(row.room_name);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
