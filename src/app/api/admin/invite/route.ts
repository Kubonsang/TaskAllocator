import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 서버 사이드에서만 서비스 롤 키 사용
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { role, requesterUserId } = await req.json();

    // 요청자가 Admin인지 확인
    const { data: requester } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requesterUserId)
      .single();

    if (!requester || (requester.role !== 'Admin' && requester.role !== 'Master')) {
      return NextResponse.json({ error: '관리자 또는 마스터 관리자만 초대 링크를 생성할 수 있습니다.' }, { status: 403 });
    }

    const validRoles = ['Worker', 'Admin', 'Master'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 });
    }

    // 초대 토큰 생성 (UUID 기반)
    const { data: invite, error } = await supabaseAdmin
      .from('invites')
      .insert({ role, created_by: requesterUserId })
      .select()
      .single();

    if (error) throw error;

    // 앱 URL 기반으로 초대 링크 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/register?token=${invite.token}&role=${role}`;

    return NextResponse.json({ inviteUrl, token: invite.token, role });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requesterUserId = searchParams.get('userId');

    if (!requesterUserId) {
      return NextResponse.json({ error: '유저 ID가 필요합니다.' }, { status: 400 });
    }

    // Admin 확인
    const { data: requester } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requesterUserId)
      .single();

    if (!requester || (requester.role !== 'Admin' && requester.role !== 'Master')) {
      return NextResponse.json({ error: '관리자 또는 마스터 관리자만 접근 가능합니다.' }, { status: 403 });
    }

    // 초대 내역 조회
    const { data: invites, error } = await supabaseAdmin
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ invites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
