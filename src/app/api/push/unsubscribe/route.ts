import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
  // ✅ [C-1] 인증 검사
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter.' }, { status: 400 });
    }

    // ✅ 본인의 구독만 해제 가능 (해당 endpoint가 본인 소유인지 확인)
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
      .eq('endpoint', endpoint)
      .single();

    if (existing && existing.user_id !== authUser.id) {
      return NextResponse.json({ error: '본인의 구독만 해제할 수 있습니다.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      return NextResponse.json({ error: '구독 해제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription removed.' });
  } catch (error: any) {
    return NextResponse.json({ error: '구독 해제 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
