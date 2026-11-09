import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;
  let failed = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user ? (user.email ?? '') : null;
  } catch (err) {
    console.error('[AdminLayout] Supabase auth gagal:', err);
    failed = true;
  }

  if (failed) redirect('/login?error=server_config');
  if (email === null) redirect('/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar email={email} />
      <main style={{
        flex: 1,
        marginLeft: 260,
        padding: 32,
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  );
}
