import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAuthUser, isAdminOrMaster } from '@/lib/auth';

export async function DELETE(req: Request) {
  // ✅ [C-1] 인증 검사
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    let targetUserId = authUser.id; // 기본: 본인 삭제

    try {
      const body = await req.json();
      if (body.userId && body.userId !== authUser.id) {
        // ✅ [H-2] 다른 유저 삭제 시 계층 제한
        if (!isAdminOrMaster(authUser)) {
          return NextResponse.json({ error: '다른 사용자의 계정을 삭제할 권한이 없습니다.' }, { status: 403 });
        }

        // 삭제 대상의 역할 확인
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles').select('role').eq('id', body.userId).single();

        if (!targetProfile) {
          return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 });
        }

        // ✅ [H-2] 역할 계층 제한:
        // - Master는 모든 사용자 삭제 가능
        // - Admin은 Worker만 삭제 가능 (Admin/Master 삭제 불가)
        if (authUser.role === 'Admin') {
          if (targetProfile.role === 'Admin' || targetProfile.role === 'Master') {
            return NextResponse.json({ error: 'Admin은 같은 등급 이상의 계정을 삭제할 수 없습니다.' }, { status: 403 });
          }
        }

        targetUserId = body.userId;
      }
    } catch (e) {
      // 바디가 없는 경우 (본인 삭제)
    }

    // 프로필 삭제 (CASCADE로 관련 데이터 정리)
    const { error: profileErr } = await supabaseAdmin
      .from('profiles').delete().eq('id', targetUserId);
    if (profileErr) throw profileErr;

    // auth.users에서 삭제
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: '계정이 성공적으로 삭제되었습니다.' });
  } catch (err: any) {
    return NextResponse.json({ error: '계정 삭제 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
