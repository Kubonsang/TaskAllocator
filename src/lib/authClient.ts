import { supabase } from './supabase';

/**
 * 현재 로그인된 사용자의 JWT 액세스 토큰을 반환합니다.
 * API 호출 시 Authorization 헤더에 사용합니다.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * 인증된 fetch 호출을 수행합니다.
 * 자동으로 Authorization 헤더를 추가합니다.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}
