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
    const { userId, subscription } = await req.json();

    // ✅ 본인의 구독만 등록 가능 (타인 구독 조작 방지)
    if (userId !== authUser.id) {
      return NextResponse.json({ error: '본인의 구독만 등록할 수 있습니다.' }, { status: 403 });
    }

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

    if (error) {
      return NextResponse.json({ error: '구독 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription saved.' });
  } catch (error: any) {
    return NextResponse.json({ error: '구독 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
