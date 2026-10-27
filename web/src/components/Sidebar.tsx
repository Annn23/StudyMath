'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', icon: '📊', label: 'Dashboard' },
  { href: '/admin/users', icon: '👥', label: 'Pengguna' },
  { href: '/admin/sessions', icon: '📅', label: 'Sesi Belajar' },
  { href: '/admin/reports', icon: '🚩', label: 'Laporan' },
  { href: '/admin/notifications', icon: '📢', label: 'Notifikasi' },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 260,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(205,79,117,0.1)',
      padding: '24px 0',
      position: 'fixed',
      top: 0, left: 0,
      height: '100vh',
      zIndex: 50,
      boxShadow: '4px 0 20px rgba(205,79,117,0.08)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 28px', borderBottom: '1px solid rgba(205,79,117,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffa9f9, #cd4f75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>📚</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#cd4f75', lineHeight: 1 }}>StudyMatch</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Admin Dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                textDecoration: 'none', marginBottom: 4, fontWeight: 500,
                fontSize: 14, transition: 'all 0.2s',
                background: isActive ? 'rgba(205,79,117,0.1)' : 'transparent',
                color: isActive ? '#cd4f75' : '#6b7280',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
              {isActive && (
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: '#cd4f75',
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(205,79,117,0.1)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #93dcfc, #cd4f75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>👤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#1a1a2e',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {email}
          </div>
          <div style={{ fontSize: 11, color: '#10b981' }}>● Admin</div>
        </div>
        <Link
          href="/api/auth/logout"
          style={{ fontSize: 16, textDecoration: 'none', opacity: 0.6 }}
          title="Keluar"
        >
          🚪
        </Link>
      </div>
    </aside>
  );
}
