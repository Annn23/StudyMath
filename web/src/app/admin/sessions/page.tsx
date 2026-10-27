import { createClient } from '@/lib/supabase/server';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  confirmed: { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  completed: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
  cancelled: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
};

const STATUS_LABELS: Record<string, string> = {
  pending:   '⏳ Menunggu',
  confirmed: '✅ Dikonfirmasi',
  completed: '🎓 Selesai',
  cancelled: '❌ Dibatalkan',
};

export default async function SessionsPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from('study_sessions')
    .select(`
      *,
      organizer:organizer_id ( full_name, avatar_url ),
      partner:partner_id ( full_name, avatar_url )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  // Stats
  const total     = sessions?.length ?? 0;
  const pending   = sessions?.filter(s => s.status === 'pending').length ?? 0;
  const confirmed = sessions?.filter(s => s.status === 'confirmed').length ?? 0;
  const completed = sessions?.filter(s => s.status === 'completed').length ?? 0;
  const cancelled = sessions?.filter(s => s.status === 'cancelled').length ?? 0;

  const miniCards = [
    { label: 'Total Sesi',    value: total,     icon: '📅', color: '#93dcfc' },
    { label: 'Menunggu',      value: pending,   icon: '⏳', color: '#f59e0b' },
    { label: 'Dikonfirmasi',  value: confirmed, icon: '✅', color: '#10b981' },
    { label: 'Selesai',       value: completed, icon: '🎓', color: '#cd4f75' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
          📅 Sesi Belajar
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Kelola semua sesi belajar yang dibuat pengguna
        </p>
      </div>

      {/* Mini Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {miniCards.map(c => (
          <div key={c.label} style={{
            background: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: '18px 20px',
            boxShadow: '0 4px 14px rgba(205,79,117,0.08)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: 24,
        boxShadow: '0 4px 20px rgba(205,79,117,0.1)', overflow: 'auto',
      }}>
        {(!sessions || sessions.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📅</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#6b7280' }}>Belum ada sesi belajar</p>
            <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 6 }}>
              Sesi akan muncul di sini setelah pengguna membuat jadwal belajar.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: 'rgba(205,79,117,0.05)' }}>
                {['Judul', 'Mata Pelajaran', 'Organizer', 'Partner', 'Jadwal', 'Durasi', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '13px 16px', fontSize: 11, color: '#9ca3af',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: any, i: number) => (
                <tr key={s.id} style={{
                  borderTop: '1px solid rgba(205,79,117,0.07)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(205,79,117,0.02)',
                }}>
                  <td style={{ padding: '13px 16px', fontWeight: 600, fontSize: 14, color: '#1a1a2e', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b7280' }}>
                    {s.subject || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#1a1a2e' }}>
                    {s.organizer?.full_name || '—'}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#1a1a2e' }}>
                    {s.partner?.full_name || '—'}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {s.scheduled_at
                      ? new Date(s.scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#6b7280' }}>
                    {s.duration_minutes} mnt
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{
                      background: STATUS_COLORS[s.status]?.bg ?? 'rgba(156,163,175,0.1)',
                      color: STATUS_COLORS[s.status]?.text ?? '#9ca3af',
                      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
