import { createClient } from '@/lib/supabase/server';

const REPORT_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b',  label: '⏳ Menunggu' },
  reviewed:  { bg: 'rgba(147,220,252,0.2)',  text: '#0891b2',  label: '👁️ Ditinjau'  },
  resolved:  { bg: 'rgba(16,185,129,0.12)',  text: '#10b981',  label: '✅ Selesai'   },
  dismissed: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280',  label: '🚫 Ditolak'  },
};

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from('reports')
    .select(`
      *,
      reporter:reporter_id ( full_name ),
      reported:reported_id ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const total    = reports?.length ?? 0;
  const pending  = reports?.filter(r => r.status === 'pending').length ?? 0;
  const resolved = reports?.filter(r => r.status === 'resolved').length ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
          🚩 Laporan Pengguna
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Tinjau dan tangani laporan pelanggaran dari pengguna
        </p>
      </div>

      {/* Mini Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Laporan', value: total,   icon: '🚩', color: '#cd4f75' },
          { label: 'Perlu Ditinjau',value: pending,  icon: '⏳', color: '#f59e0b' },
          { label: 'Selesai',       value: resolved, icon: '✅', color: '#10b981' },
        ].map(c => (
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
        {(!reports || reports.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#6b7280' }}>Tidak ada laporan</p>
            <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 6 }}>
              Komunitas StudyMatch berjalan dengan baik!
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
            <thead>
              <tr style={{ background: 'rgba(205,79,117,0.05)' }}>
                {['Pelapor', 'Dilaporkan', 'Alasan', 'Deskripsi', 'Tanggal', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '13px 16px', fontSize: 11, color: '#9ca3af',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any, i: number) => (
                <tr key={r.id} style={{
                  borderTop: '1px solid rgba(205,79,117,0.07)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(205,79,117,0.02)',
                }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                    {r.reporter?.full_name || '—'}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                    {r.reported?.full_name || '—'}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: '#1a1a2e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reason}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description || <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{
                      background: REPORT_STATUS[r.status]?.bg,
                      color: REPORT_STATUS[r.status]?.text,
                      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    }}>
                      {REPORT_STATUS[r.status]?.label ?? r.status}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'pending' && (
                        <>
                          <form action="/api/admin/reports/update" method="POST" style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="resolved" />
                            <button type="submit" style={{
                              padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              background: 'rgba(16,185,129,0.1)', color: '#10b981',
                              border: 'none', cursor: 'pointer',
                            }}>✅ Selesai</button>
                          </form>
                          <form action="/api/admin/reports/update" method="POST" style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="dismissed" />
                            <button type="submit" style={{
                              padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              background: 'rgba(107,114,128,0.1)', color: '#6b7280',
                              border: 'none', cursor: 'pointer',
                            }}>🚫 Tolak</button>
                          </form>
                        </>
                      )}
                    </div>
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
