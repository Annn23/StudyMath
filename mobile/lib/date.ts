import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

/**
 * Mengubah string tanggal dari Supabase/PostgreSQL menjadi objek Date lokal yang aman.
 * Menangani kasus:
 * 1. String UTC tanpa penanda timezone (cth: "2026-10-25 15:50:35") agar tidak dianggap waktu lokal (selisih 7 jam di WIB).
 * 2. Format dengan spasi yang tidak didukung parser Hermes di React Native.
 */
export function parseSafeDate(dateStr: string | Date | undefined | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  let s = String(dateStr).trim();
  // Ganti spasi antara tanggal dan waktu menjadi 'T' untuk kompatibilitas ISO 8601
  if (s.includes(' ') && !s.includes('T')) {
    s = s.replace(' ', 'T');
  }

  // Jika belum ada penanda timezone (Z atau +HH / -HH / +HH:MM), tambahkan 'Z' (asumsi UTC dari server)
  const hasTimezone = s.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(s);
  if (!hasTimezone) {
    s += 'Z';
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(dateStr) : d;
}

/** Format waktu pesan: HH:mm (cth: 22:50) */
export function formatMessageTime(dateStr: string | Date | undefined | null): string {
  try {
    const d = parseSafeDate(dateStr);
    return format(d, 'HH:mm');
  } catch {
    return '';
  }
}

/** Header pemisah hari (Hari ini / Kemarin / Nama Hari, Tanggal Bulan Tahun) */
export function formatDayHeader(dateStr: string | Date | undefined | null): string {
  try {
    const d = parseSafeDate(dateStr);
    if (isToday(d)) return 'Hari ini';
    if (isYesterday(d)) return 'Kemarin';
    return format(d, 'EEEE, d MMMM yyyy', { locale: idLocale });
  } catch {
    return '';
  }
}

/** Cek apakah dua tanggal berbeda hari */
export function isDifferentDay(a: string | Date, b: string | Date): boolean {
  try {
    const da = parseSafeDate(a);
    const db = parseSafeDate(b);
    return (
      da.getFullYear() !== db.getFullYear() ||
      da.getMonth() !== db.getMonth() ||
      da.getDate() !== db.getDate()
    );
  } catch {
    return false;
  }
}

/** Format waktu relatif (cth: "2 menit yang lalu", "1 jam yang lalu") */
export function formatRelativeTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = parseSafeDate(dateStr);
    return formatDistanceToNow(d, { locale: idLocale, addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format waktu ringkas dan proporsional untuk kartu chat & status aktif
 * (cth: "Baru saja", "5m lalu", "2j lalu", "Kemarin", "24 Okt").
 * Menghindari teks panjang seperti "sekitar 2 jam yang lalu" yang meluber dari batas kotak/card.
 */
export function formatChatTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = parseSafeDate(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();

    if (diffMs < 60 * 1000) return 'Baru saja';

    const diffMin = Math.floor(diffMs / (60 * 1000));
    if (diffMin < 60) return `${diffMin}m lalu`;

    const diffHour = Math.floor(diffMs / (3600 * 1000));
    if (diffHour < 24 && isToday(d)) {
      return `${diffHour}j lalu`;
    }

    if (isYesterday(d)) return 'Kemarin';

    const diffDays = Math.floor(diffMs / (86400 * 1000));
    if (diffDays < 7) {
      return format(d, 'EEEE', { locale: idLocale });
    }

    if (d.getFullYear() === now.getFullYear()) {
      return format(d, 'd MMM', { locale: idLocale });
    }

    return format(d, 'dd/MM/yy');
  } catch {
    return '';
  }
}
