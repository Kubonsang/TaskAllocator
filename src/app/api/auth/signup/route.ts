import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INTERNAL_EMAIL_DOMAIN = '@autoassigner.internal';

export async function POST(req: Request) {
  try {
    const { username, displayName, password, token } = await req.json();

    if (!username || !password || !token) {
      return NextResponse.json({ error: '아이디, 비밀번호, 초대 토큰이 모두 필요합니다.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    const finalName = displayName?.trim() || username;

    // 1. 초대 토큰 검증
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json({ error: '유효하지 않거나 이미 사용된 초대 링크입니다.' }, { status: 400 });
    }

    // 2. 아이디 중복 체크 (profiles 테이블에서 username으로 검색)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
    }

    // 3. Supabase Auth에 계정 생성 (내부 이메일 형식 사용)
    const internalEmail = `${username}${INTERNAL_EMAIL_DOMAIN}`;
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true, // 이메일 인증 건너뜀
      user_metadata: {
        name: finalName,
        role: invite.role
      }
    });

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
      }
      throw authErr;
    }

    // 4. profiles 테이블 업데이트 (트리거가 생성하지만, username과 role 명시적으로 설정)
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        name: finalName,
        username: username,
        role: invite.role,
        total_score: 0
      });

    if (profileErr) throw profileErr;

    // 5. 초대 토큰을 사용됨으로 표시
    await supabaseAdmin
      .from('invites')
      .update({ used: true, used_by: authUser.user.id, used_at: new Date().toISOString() })
      .eq('token', token);

    return NextResponse.json({ 
      success: true, 
      message: '계정이 성공적으로 생성되었습니다.',
      role: invite.role
    });
  } catch (err: any) {
    console.error('[signup error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
