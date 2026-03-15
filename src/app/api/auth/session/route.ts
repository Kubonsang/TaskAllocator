import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

/**
 * POST: 로그인 성공 후 access_token을 받아 HttpOnly 쿠키로 발급
 * DELETE: 로그아웃 시 쿠키 삭제
 */

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7일
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
