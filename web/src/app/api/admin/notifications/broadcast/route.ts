import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { title, body, type } = await request.json();
  if (!title || !body) {
    return NextResponse.json({ message: 'Judul dan isi pesan wajib diisi.' }, { status: 400 });
  }

  // Get all user IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id');

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: 'Tidak ada pengguna yang ditemukan.' }, { status: 404 });
  }

  // Insert notification for each user
  const notifications = profiles.map(p => ({
    user_id: p.id,
    type: type || 'system',
    title,
    body,
    data: { broadcast: true, sent_by: user.id },
  }));

  const { error } = await supabase.from('notifications').insert(notifications);

  if (error) {
    return NextResponse.json({ message: `Gagal mengirim: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    message: `Berhasil dikirim ke ${profiles.length} pengguna! 🎉`,
  });
}
