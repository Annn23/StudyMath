'use client';

import { useState } from 'react';

const NOTIF_TYPES = [
  { value: 'system',           label: '📢 Sistem (Umum)' },
  { value: 'match',            label: '💞 Match' },
  { value: 'session_invite',   label: '📅 Undangan Sesi' },
  { value: 'review',           label: '⭐ Review' },
];

export default function BroadcastForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('system');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, type }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message });
      if (res.ok) { setTitle(''); setBody(''); }
    } catch {
      setResult({ ok: false, message: 'Terjadi kesalahan.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Type */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
          Tipe Notifikasi
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {NOTIF_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                border: `1.5px solid ${type === t.value ? '#cd4f75' : 'rgba(205,79,117,0.2)'}`,
                background: type === t.value ? 'rgba(205,79,117,0.1)' : '#f8f4ff',
                color: type === t.value ? '#cd4f75' : '#6b7280',
                cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
          Judul Notifikasi
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Contoh: Pembaruan StudyMatch tersedia! 🎉"
          maxLength={80}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12, boxSizing: 'border-box',
            border: '1.5px solid rgba(205,79,117,0.2)', outline: 'none', fontSize: 14,
            fontFamily: 'Outfit, sans-serif', background: '#f8f4ff', color: '#1a1a2e',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {title.length}/80
        </div>
      </div>

      {/* Body */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
          Isi Pesan
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Tulis pesan yang akan dikirim ke semua pengguna..."
          maxLength={300}
          rows={4}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12, boxSizing: 'border-box',
            border: '1.5px solid rgba(205,79,117,0.2)', outline: 'none', fontSize: 14,
            fontFamily: 'Outfit, sans-serif', background: '#f8f4ff', color: '#1a1a2e',
            resize: 'vertical',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {body.length}/300
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: result.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1.5px solid ${result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: result.ok ? '#10b981' : '#ef4444',
          fontSize: 13, fontWeight: 500,
        }}>
          {result.ok ? '✅' : '❌'} {result.message}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !title.trim() || !body.trim()}
        style={{
          padding: '14px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: loading || !title.trim() || !body.trim()
            ? 'rgba(205,79,117,0.3)'
            : 'linear-gradient(135deg, #ffa9f9, #cd4f75)',
          color: '#fff', fontSize: 16, fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
          boxShadow: '0 6px 20px rgba(205,79,117,0.3)',
        }}
      >
        {loading ? '⏳ Mengirim...' : '📢 Kirim ke Semua Pengguna'}
      </button>
    </form>
  );
}
