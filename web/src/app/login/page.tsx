export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)',
        borderRadius: 28, padding: '48px 40px', width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(205,79,117,0.2)',
        border: '1px solid rgba(205,79,117,0.1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #ffa9f9, #cd4f75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>📚</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#cd4f75', marginBottom: 4 }}>
            StudyMatch
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>Admin Panel</p>
        </div>

        {/* Error Banner */}
        {error === 'invalid_credentials' && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>❌</span>
            <p style={{ fontSize: 13, color: '#ef4444', fontWeight: 500, margin: 0 }}>
              Email atau password salah. Pastikan akun admin sudah dibuat di Supabase.
            </p>
          </div>
        )}

        <form action="/api/auth/login" method="POST">
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
              Email Admin
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="admin@studymath.app"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                border: '1.5px solid rgba(205,79,117,0.25)', outline: 'none',
                fontSize: 15, fontFamily: 'Outfit, sans-serif', background: '#f8f4ff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 12,
                border: '1.5px solid rgba(205,79,117,0.25)', outline: 'none',
                fontSize: 15, fontFamily: 'Outfit, sans-serif', background: '#f8f4ff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%', padding: '14px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(135deg, #ffa9f9, #cd4f75)',
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 6px 20px rgba(205,79,117,0.35)',
            }}
          >
            Masuk ke Admin Panel
          </button>
        </form>
      </div>
    </div>
  );
}
