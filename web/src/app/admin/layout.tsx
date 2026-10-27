import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar email={user.email ?? ''} />
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
