import { createClient } from '@/lib/supabase/server';

async function getStats() {
  const supabase = await createClient();
  const [
    { count: totalUsers },
    { count: totalSessions },
    { count: totalMatches },
    { count: pendingReports },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('study_sessions').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('is_matched', true),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, full_name, username, grade_level, created_at, average_rating')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: recentSessions } = await supabase
    .from('study_sessions')
    .select('id, title, subject, status, scheduled_at, organizer:organizer_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(5);

  return { totalUsers, totalSessions, totalMatches, pendingReports, recentUsers, recentSessions };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const statCards = [
    { label: 'Total Pengguna', value: stats.totalUsers || 0, icon: '👥', color: '#cd4f75', bg: 'rgba(205,79,117,0.1)' },
    { label: 'Total Match', value: stats.totalMatches || 0, icon: '💞', color: '#ffa9f9', bg: 'rgba(255,169,249,0.15)' },
    { label: 'Sesi Belajar', value: stats.totalSessions || 0, icon: '📅', color: '#93dcfc', bg: 'rgba(147,220,252,0.15)' },
    { label: 'Laporan Pending', value: stats.pendingReports || 0, icon: '🚩', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  ];

  const statusColors: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#10b981', completed: '#6b7280', cancelled: '#ef4444',
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
          Dashboard 📊
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Selamat datang di panel admin StudyMatch
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: '24px',
            boxShadow: '0 4px 16px rgba(205,79,117,0.1)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(205,79,117,0.08)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, marginBottom: 16,
            }}>
              {card.icon}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {card.value.toLocaleString('id-ID')}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, fontWeight: 500 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Users */}
        <div style={{
          background: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 24,
          boxShadow: '0 4px 16px rgba(205,79,117,0.1)', backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>👥 Pengguna Terbaru</h2>
            <a href="/admin/users" style={{ fontSize: 12, color: '#cd4f75', textDecoration: 'none', fontWeight: 500 }}>
              Lihat Semua →
            </a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nama', 'Jenjang', 'Rating', 'Bergabung'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontSize: 11,
                    color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', borderBottom: '1px solid rgba(205,79,117,0.1)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats.recentUsers || []).map((user: any) => (
                <tr key={user.id}>
                  <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                    {user.full_name || 'N/A'}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12 }}>
                    {user.grade_level && (
                      <span style={{
                        background: 'rgba(205,79,117,0.1)', color: '#cd4f75',
                        padding: '3px 8px', borderRadius: 999, fontWeight: 500,
                      }}>
                        {user.grade_level}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                    ⭐ {user.average_rating?.toFixed(1) || '—'}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12, color: '#9ca3af' }}>
                    {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Sessions */}
        <div style={{
          background: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 24,
          boxShadow: '0 4px 16px rgba(205,79,117,0.1)', backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📅 Sesi Terbaru</h2>
            <a href="/admin/sessions" style={{ fontSize: 12, color: '#cd4f75', textDecoration: 'none', fontWeight: 500 }}>
              Lihat Semua →
            </a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Judul', 'Mapel', 'Status', 'Tanggal'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontSize: 11,
                    color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', borderBottom: '1px solid rgba(205,79,117,0.1)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats.recentSessions || []).map((session: any) => (
                <tr key={session.id}>
                  <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#1a1a2e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.title}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12, color: '#6b7280' }}>
                    {session.subject || '—'}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12 }}>
                    <span style={{
                      background: statusColors[session.status] + '22',
                      color: statusColors[session.status],
                      padding: '3px 8px', borderRadius: 999, fontWeight: 600,
                    }}>
                      {session.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12, color: '#9ca3af' }}>
                    {session.scheduled_at
                      ? new Date(session.scheduled_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
