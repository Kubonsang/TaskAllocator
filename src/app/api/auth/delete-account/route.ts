import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    // Authorization 헤더에서 사용자 토큰 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // 토큰으로 실제 유저 확인
    const { data: { user: requester }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !requester) {
      return NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 });
    }

    // 요청 바디에서 삭제할 대상 ID 확인 (관리자 기능)
    let targetUserId = requester.id;
    try {
      const body = await req.json();
      if (body.userId && body.userId !== requester.id) {
        // 다른 유저를 삭제하려는 경우 관리자 권한 확인
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', requester.id)
          .single();
        
        if (profile?.role !== 'Admin' && profile?.role !== 'Master') {
          return NextResponse.json({ error: '다른 사용자의 계정을 삭제할 권한이 없습니다.' }, { status: 403 });
        }
        targetUserId = body.userId;
      }
    } catch (e) {
      // 바디가 없는 경우 (본인 삭제) - 무시하고 본인 ID 사용
    }

    // 1. 프로필 먼저 삭제 (외래 키 제약 조건 때문)
    // schedules, swap_requests 등은 profiles 삭제 시 CASCADE 설정되어 있음
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetUserId);
    
    if (profileErr) throw profileErr;

    // 2. auth.users에서 삭제
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: '계정이 성공적으로 삭제되었습니다.' });
  } catch (err: any) {
    console.error('[delete-account error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
