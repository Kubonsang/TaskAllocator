'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, LogIn, AlertCircle, User } from 'lucide-react';

const INTERNAL_EMAIL_DOMAIN = '@autoassigner.internal';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const failCountRef = useRef(0);
  const lockoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 자동 자동 로그인 (기존 세션 확인)
  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.replace('/');
      }
    }
    checkExistingSession();
    
    // Auth 상태 변경 감지해서 로그인 되어버리면 즉시 이동
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        router.replace('/');
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutRemaining > 0) {
      setErrorMsg(`로그인 시도가 너무 많습니다. ${lockoutRemaining}초 후 다시 시도하세요.`);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 아이디를 내부 이메일 형식으로 변환하여 로그인
      const internalEmail = `${username.trim()}${INTERNAL_EMAIL_DOMAIN}`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password
      });

      if (error) {
        // 실패 카운트 증가
        failCountRef.current += 1;
        if (failCountRef.current >= MAX_ATTEMPTS) {
          // 잠금 시작
          failCountRef.current = 0;
          let remaining = LOCKOUT_SECONDS;
          setLockoutRemaining(remaining);
          lockoutTimerRef.current = setInterval(() => {
            remaining -= 1;
            setLockoutRemaining(remaining);
            if (remaining <= 0) {
              clearInterval(lockoutTimerRef.current!);
              lockoutTimerRef.current = null;
            }
          }, 1000);
          throw new Error(`로그인 시도가 ${MAX_ATTEMPTS}회 실패했습니다. ${LOCKOUT_SECONDS}초 후 다시 시도하세요.`);
        }
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
        throw error;
      }

      // 로그인 성공: 실패 카운트 리셋
      failCountRef.current = 0;

      // 서버 측 HttpOnly 쿠키 발급 (미들웨어 인증용)
      if (data.session?.access_token) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
      }

      router.push('/');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('URL is required') || err.message?.includes('API key')) {
        setErrorMsg('Supabase 연동 오류: .env.local 설정을 확인해주세요.');
      } else {
        setErrorMsg(err.message || '로그인에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Brand Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl mx-auto shadow-xl shadow-indigo-200 flex items-center justify-center transform rotate-12 mb-4 relative overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-white opacity-20 absolute -top-2 -left-2" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Auto-Assigner</h1>
          <p className="text-sm font-medium text-gray-500 mt-2 tracking-wide uppercase">Smart Task Allocation</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-white">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">아이디</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="아이디 입력"
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">비밀번호</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex gap-2 items-center text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || lockoutRemaining > 0}
              className="w-full py-4 mt-2 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-sm transition-transform active:scale-95 shadow-lg shadow-gray-200/50 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : lockoutRemaining > 0 ? (
                <>{lockoutRemaining}초 대기 중...</>
              ) : (
                <><LogIn size={18} /> 로그인</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              계정이 없으신가요? 관리자에게 초대 링크를 요청하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
