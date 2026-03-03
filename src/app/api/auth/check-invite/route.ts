import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const { data, error } = await supabaseAdmin
    .from('invites')
    .select('used, role')
    .eq('token', token)
    .single();

  if (error || !data || data.used) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, role: data.role });
}
