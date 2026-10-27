import { createClient } from '@/lib/supabase/server';
import BroadcastForm from '@/components/BroadcastForm';

export default async function NotificationsPage() {
  const supabase = await createClient();

  // Recent broadcasts (system notifications)
  const { data: recent } = await supabase
    .from('notifications')
    .select('id, title, body, type, created_at')
    .eq('type', 'system')
    .order('created_at', { ascending: false })
    .limit(10);

  // Total notif count
  const { count: totalNotifs } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true });

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
          📢 Notifikasi
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Kirim broadcast ke semua pengguna & lihat riwayat notifikasi
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Notifikasi',  value: totalNotifs ?? 0, icon: '🔔', color: '#cd4f75' },
          { label: 'Belum Dibaca',      value: unreadCount ?? 0, icon: '🔴', color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'rgba(255,255,255,0.88)', borderRadius: 16, padding: '18px 20px',
            boxShadow: '0 4px 14px rgba(205,79,117,0.08)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Broadcast Form */}
        <div style={{
          background: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: 28,
          boxShadow: '0 4px 20px rgba(205,79,117,0.1)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>
            📣 Kirim Broadcast
          </h2>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>
            Pesan akan dikirim ke seluruh pengguna yang terdaftar.
          </p>
          <BroadcastForm />
        </div>

        {/* Recent Broadcasts */}
        <div style={{
          background: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: 28,
          boxShadow: '0 4px 20px rgba(205,79,117,0.1)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 20 }}>
            🕐 Riwayat Broadcast
          </h2>
          {!recent || recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>📭</p>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>Belum ada broadcast yang dikirim</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recent.map((n: any) => (
                <div key={n.id} style={{
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px solid rgba(205,79,117,0.1)',
                  background: 'rgba(252,228,243,0.3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {new Date(n.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                      {n.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
