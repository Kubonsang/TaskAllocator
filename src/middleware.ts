import { NextRequest, NextResponse } from 'next/server';

// ==============================
// Rate Limiting (DDoS 방어)
// ==============================
// 메모리 기반 슬라이딩 윈도우 Rate Limiter
// Vercel Edge Runtime에서 동작 (서버리스 인스턴스 단위로 상태 유지)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const RATE_LIMITS: Record<string, number> = {
  '/api/assign':                30,  // 분당 30회
  '/api/assign/emergency':      20,  // 분당 20회
  '/api/admin/invite':          10,  // 분당 10회 (초대 남발 방지)
  '/api/admin/cancel-schedule': 30,  // 분당 30회
  '/api/auth/signup':           5,   // 분당 5회 (무차별 가입 방지)
  '/api/auth/check-invite':     15,  // 분당 15회
  '/api/auth/delete-account':   5,   // 분당 5회
  '/api/push/subscribe':        10,  // 분당 10회
  '/api/push/unsubscribe':      10,  // 분당 10회
};
const DEFAULT_RATE_LIMIT = 60; // 기본: 분당 60회

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(key: string, maxRequests: number): { limited: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimit.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: maxRequests - 1 };
  }

  entry.count++;
  
  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: maxRequests - entry.count };
}

// 오래된 항목 정리 (메모리 누수 방지)
function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, entry] of rateLimit.entries()) {
    if (now > entry.resetTime) {
      rateLimit.delete(key);
    }
  }
}

// 매 100회 요청마다 정리 실행
let requestCounter = 0;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API 라우트만 Rate Limiting 적용
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 정기적 메모리 정리
  requestCounter++;
  if (requestCounter % 100 === 0) {
    cleanupRateLimit();
  }

  // Rate Limit 검사
  const clientIP = getClientIP(req);
  const maxRequests = RATE_LIMITS[pathname] || DEFAULT_RATE_LIMIT;
  const rateLimitKey = `${clientIP}:${pathname}`;
  const { limited, remaining } = isRateLimited(rateLimitKey, maxRequests);

  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // 정상 요청: Rate Limit 정보를 응답 헤더에 추가
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(remaining));

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
