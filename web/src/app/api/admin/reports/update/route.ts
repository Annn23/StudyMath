import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const status = formData.get('status') as string;

  if (!id || !status) {
    return NextResponse.redirect(new URL('/admin/reports', request.url));
  }

  await supabase
    .from('reports')
    .update({ status })
    .eq('id', id);

  return NextResponse.redirect(new URL('/admin/reports', request.url));
}
