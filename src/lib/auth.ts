import { supabaseAdmin } from '@/lib/supabaseServer';

export type AuthUser = {
  id: string;
  role: string;
  name: string;
};

/**
 * API 라우트에서 JWT 토큰을 검증하고 사용자 정보를 반환합니다.
 * 인증 실패 시 null을 반환합니다.
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;

    // profiles 테이블에서 역할 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single();

    if (!profile) return null;

    return {
      id: user.id,
      role: profile.role,
      name: profile.name,
    };
  } catch {
    return null;
  }
}

/**
 * Admin 또는 Master 역할인지 확인합니다.
 */
export function isAdminOrMaster(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'Master';
}

/**
 * 입력값에서 HTML 태그를 제거하고 길이를 제한합니다 (XSS 방지).
 */
export function sanitize(input: string | undefined | null, maxLength = 500): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')     // HTML 태그 제거
    .replace(/[<>"'&]/g, '')     // 특수문자 제거
    .trim()
    .slice(0, maxLength);
}
