import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAuthUser, isAdminOrMaster } from '@/lib/auth';

export async function POST(req: Request) {
  // ✅ [C-1] 인증 검사
  // ✅ [H-1] JWT에서 사용자 ID 추출 (body의 requesterUserId를 신뢰하지 않음)
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isAdminOrMaster(authUser)) {
    return NextResponse.json({ error: '관리자 또는 마스터만 초대 링크를 생성할 수 있습니다.' }, { status: 403 });
  }

  try {
    const { role } = await req.json();

    const validRoles = ['Worker', 'Admin', 'Master'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 });
    }

    // ✅ [H-1] 인증된 사용자의 ID를 사용 (클라이언트 입력값이 아님)
    const { data: invite, error } = await supabaseAdmin
      .from('invites')
      .insert({ role, created_by: authUser.id })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://task-allocator-hc.vercel.app';
    const inviteUrl = `${baseUrl}/register?token=${invite.token}&role=${role}`;

    return NextResponse.json({ inviteUrl, token: invite.token, role });
  } catch (err: any) {
    return NextResponse.json({ error: '초대 링크 생성에 실패했습니다.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // ✅ [C-1] 인증 검사
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isAdminOrMaster(authUser)) {
    return NextResponse.json({ error: '관리자 또는 마스터만 접근 가능합니다.' }, { status: 403 });
  }

  try {
    const { data: invites, error } = await supabaseAdmin
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ invites });
  } catch (err: any) {
    return NextResponse.json({ error: '초대 내역 조회에 실패했습니다.' }, { status: 500 });
  }
}
