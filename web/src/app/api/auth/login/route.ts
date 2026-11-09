import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.redirect(new URL('/login?error=invalid_credentials', request.url), 303);
    }
  } catch (err) {
    console.error('[Login] Supabase gagal:', err);
    return NextResponse.redirect(new URL('/login?error=server_config', request.url), 303);
  }

  return NextResponse.redirect(new URL('/admin', request.url), 303);
}
