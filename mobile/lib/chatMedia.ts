import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from './supabase';

// Ubah string base64 → ArrayBuffer
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

export interface PickedMedia {
  uri: string;
  base64: string;
  width?: number;
  height?: number;
}

/**
 * Pilih file gambar dari Galeri / Media Library perangkat
 */
export const pickImageFromGallery = async (): Promise<PickedMedia | null> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Izin Galeri Diperlukan',
        'StudyMatch membutuhkan izin akses galeri untuk memilih dan mengunggah gambar.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Gagal', 'Tidak dapat membaca data gambar.');
      return null;
    }

    return {
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    };
  } catch (err: any) {
    console.error('[pickImageFromGallery] error:', err);
    Alert.alert('Error', 'Terjadi kesalahan saat membuka galeri foto.');
    return null;
  }
};

/**
 * Ambil foto langsung menggunakan Kamera perangkat
 */
export const takePhotoWithCamera = async (): Promise<PickedMedia | null> => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Izin Kamera Diperlukan',
        'StudyMatch membutuhkan izin akses kamera untuk mengambil foto secara langsung.'
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Gagal', 'Tidak dapat mengambil foto dari kamera.');
      return null;
    }

    return {
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    };
  } catch (err: any) {
    console.error('[takePhotoWithCamera] error:', err);
    Alert.alert('Error', 'Terjadi kesalahan saat membuka kamera.');
    return null;
  }
};

/**
 * Unggah gambar ke Supabase Storage (bucket 'chat-attachments' dengan fallback ke 'avatars')
 */
export const uploadChatImage = async (
  userId: string,
  base64: string,
  prefix: string = 'chat'
): Promise<{ url: string | null; error: any }> => {
  if (!base64) {
    return { url: null, error: { message: 'Data gambar kosong' } };
  }

  const fileName = `${userId}/${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
  const body = base64ToArrayBuffer(base64);

  // 1. Coba bucket 'chat-attachments'
  let bucket = 'chat-attachments';
  let uploadRes = await supabase.storage.from(bucket).upload(fileName, body, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  // 2. Jika bucket 'chat-attachments' belum aktif/dibuat di Supabase, fallback ke bucket 'avatars'
  if (uploadRes.error) {
    console.warn(`[uploadChatImage] bucket '${bucket}' gagal, mencoba fallback ke 'avatars':`, uploadRes.error.message);
    bucket = 'avatars';
    uploadRes = await supabase.storage.from(bucket).upload(fileName, body, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  }

  if (uploadRes.error) {
    console.error('[uploadChatImage] upload failed:', uploadRes.error);
    return { url: null, error: uploadRes.error };
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return { url: publicUrl, error: null };
};

/**
 * Buat string konten pesan gambar dengan format standar:
 * [[IMAGE:https://...|Keterangan opsional]] atau [[IMAGE:https://...]]
 */
export const buildImageMessage = (imageUrl: string, caption: string = ''): string => {
  const cleanCap = caption.trim().replace(/[\[\]]/g, '');
  if (cleanCap) {
    return `[[IMAGE:${imageUrl}|${cleanCap}]]`;
  }
  return `[[IMAGE:${imageUrl}]]`;
};

/**
 * Parse apakah pesan ini merupakan pesan gambar
 */
export const parseImageMessage = (
  content: string | null | undefined,
  imageUrl?: string | null
): { url: string; caption: string } | null => {
  // 1. Jika ada kolom image_url langsung di baris pesan
  if (imageUrl) {
    return {
      url: imageUrl,
      caption: content && !content.startsWith('[[IMAGE:') && content !== '📷 Foto' ? content : '',
    };
  }

  if (!content) return null;

  // 2. Parse pola [[IMAGE:url|caption]] atau [[IMAGE:url]]
  const match = content.match(/^\[\[IMAGE:([^\|\]]+)(?:\|(.*))?\]\]$/);
  if (match) {
    return {
      url: match[1],
      caption: match[2] ? match[2].trim() : '',
    };
  }

  return null;
};

/**
 * Teks preview ramah untuk daftar chat & push notifikasi
 */
export const previewMediaText = (content: string | null | undefined, imageUrl?: string | null): string => {
  const img = parseImageMessage(content, imageUrl);
  if (img) {
    return img.caption ? `📷 Foto: ${img.caption}` : '📷 Foto';
  }
  return content || '';
};
