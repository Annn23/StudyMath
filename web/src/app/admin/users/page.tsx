import { createClient } from '@/lib/supabase/server';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
          👥 Pengguna
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Kelola semua pengguna StudyMatch ({users?.length || 0} total)
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: '16px 20px',
        marginBottom: 20, boxShadow: '0 4px 16px rgba(205,79,117,0.08)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          placeholder="🔍 Cari nama atau username..."
          style={{
            flex: 1, minWidth: 220, padding: '10px 16px', borderRadius: 999,
            border: '1.5px solid rgba(205,79,117,0.2)', outline: 'none',
            fontSize: 14, fontFamily: 'Outfit, sans-serif',
            background: '#f8f4ff',
          }}
        />
        <select style={{
          padding: '10px 16px', borderRadius: 999, border: '1.5px solid rgba(205,79,117,0.2)',
          outline: 'none', fontSize: 14, fontFamily: 'Outfit, sans-serif',
          background: '#f8f4ff', color: '#6b7280', cursor: 'pointer',
        }}>
          <option value="">Semua Universitas</option>
          {['UI', 'ITB', 'UGM', 'ITS', 'UNAIR', 'UNDIP', 'UB', 'UNPAD', 'Telkom', 'Binus'].map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select style={{
          padding: '10px 16px', borderRadius: 999, border: '1.5px solid rgba(205,79,117,0.2)',
          outline: 'none', fontSize: 14, fontFamily: 'Outfit, sans-serif',
          background: '#f8f4ff', color: '#6b7280', cursor: 'pointer',
        }}>
          <option value="">Semua Status</option>
          <option value="available">Tersedia</option>
          <option value="blocked">Diblokir</option>
        </select>
      </div>

      {/* Users Table */}
      <div style={{
        background: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: 24,
        boxShadow: '0 4px 20px rgba(205,79,117,0.1)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(205,79,117,0.05)' }}>
              {['Pengguna', 'Username', 'Universitas', 'Mata Kuliah', 'Sesi', 'Rating', 'Status', 'Bergabung', 'Aksi'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '14px 16px', fontSize: 11,
                  color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users || []).map((user: any, i: number) => (
              <tr key={user.id} style={{
                borderTop: '1px solid rgba(205,79,117,0.07)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(205,79,117,0.02)',
              }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `url(${user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=cd4f75&color=fff`}) center/cover`,
                      flexShrink: 0, border: '2px solid rgba(255,169,249,0.5)',
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                      {user.full_name || 'N/A'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                  @{user.username || '—'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {(user.university || user.grade_level) && (
                    <span style={{
                      background: 'rgba(205,79,117,0.1)', color: '#cd4f75', fontSize: 12,
                      padding: '3px 10px', borderRadius: 999, fontWeight: 600,
                    }}>{user.university || 'Univ'}</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.subjects?.slice(0, 2).join(', ') || '—'}
                  {user.subjects?.length > 2 ? ` +${user.subjects.length - 2}` : ''}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#93dcfc' }}>
                  {user.total_sessions || 0}
                </td>
                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>
                  ⭐ {user.average_rating?.toFixed(1) || '—'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: user.is_blocked ? 'rgba(239,68,68,0.1)' : user.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.2)',
                    color: user.is_blocked ? '#ef4444' : user.is_available ? '#10b981' : '#9ca3af',
                  }}>
                    {user.is_blocked ? '❌ Diblokir' : user.is_available ? '● Tersedia' : '○ Offline'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: '#9ca3af' }}>
                  {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={`/admin/users/${user.id}`} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'rgba(205,79,117,0.1)', color: '#cd4f75', textDecoration: 'none',
                    }}>Detail</a>
                    <button style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: user.is_blocked ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: user.is_blocked ? '#10b981' : '#ef4444',
                      border: 'none', cursor: 'pointer',
                    }}>
                      {user.is_blocked ? 'Aktifkan' : 'Blokir'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
