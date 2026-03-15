import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const { data, error } = await supabaseAdmin
    .from('invites')
    .select('used')
    .eq('token', token)
    .single();

  if (error || !data || data.used) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true });
}
