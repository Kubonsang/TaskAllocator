import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // === Phase 3.5: Middleware based access control ===
  // 1. 프로토타입 구동을 위해 현재는 로깅과 Pass-through로 처리합니다.
  // 2. 실제 프로덕션 서버에서는 아래 주석 처리된 Supabase Auth 서버 검증을 활성화합니다.
  /*
  const supabase = createMiddlewareClient({ req: request, res: NextResponse.next() });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && (pathname.startsWith('/my') || pathname.startsWith('/stats'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  */

  return NextResponse.next();
}

export const config = {
  matcher: ['/my', '/stats'],
};
