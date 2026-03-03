'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, UserPlus, AlertCircle, CheckCircle2, ShieldCheck, Users, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';

const ROLE_LABELS: Record<string, { label: string; desc: string; color: string; icon: any }> = {
  Worker:    { label: '일반 직원',  desc: '업무를 배정받고 수행하는 일반 직원', color: 'indigo', icon: Users },
  Admin:     { label: '대표 / 관리자', desc: '업무 배정과 전체 시스템을 관리', color: 'rose',   icon: ShieldCheck },
  Master:    { label: '마스터 / 최고 관리자', desc: '모든 권한을 가진 최고 관리자', color: 'amber', icon: ShieldCheck },
};

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const role = searchParams.get('role') || 'Worker';

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // 토큰 유효성 확인
  useEffect(() => {
    if (!token) {
      setIsTokenValid(false);
      return;
    }
    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/check-invite?token=${token}`);
        const data = await res.json();
        setIsTokenValid(data.valid === true);
      } catch {
        setIsTokenValid(false);
      }
    }
    checkToken();
  }, [token]);

  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.Worker;
  const IconComponent = roleInfo.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (username.trim().length < 2) {
      setErrorMsg('아이디는 2자 이상이어야 합니다.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setErrorMsg('아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.');
      return;
    }
    if (displayName.trim().length < 2) {
      setErrorMsg('이름은 2자 이상이어야 합니다.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      return;
    }


    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password, token })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '계정 생성에 실패했습니다.');
      }

      setSuccessMsg(`✅ 계정이 성공적으로 생성되었습니다! 잠시 후 로그인 페이지로 이동합니다.`);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 토큰 확인 중
  if (isTokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // 유효하지 않은 토큰
  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-red-100 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">유효하지 않은 링크</h1>
          <p className="text-sm text-gray-500 mb-6">
            초대 링크가 만료되었거나 이미 사용된 링크입니다.<br />
            관리자에게 새 초대 링크를 요청해주세요.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm"
          >
            로그인 페이지로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl mx-auto shadow-xl shadow-indigo-200 flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full bg-white opacity-20" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Auto-Assigner</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">계정 등록</p>
          <p className="text-[10px] text-gray-300 mt-2">© AI Content Traceability Management v1.0</p>
        </div>

        {/* Role Badge */}
        <div className={`flex items-center gap-3 p-4 rounded-2xl mb-6 ${
          role === 'Admin' ? 'bg-rose-50 border border-rose-100' :
          role === 'Master' ? 'bg-amber-50 border border-amber-100' :
          'bg-indigo-50 border border-indigo-100'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            role === 'Admin' ? 'bg-rose-100' :
            role === 'Master' ? 'bg-amber-100' :
            'bg-indigo-100'
          }`}>
            <IconComponent size={20} className={
              role === 'Admin' ? 'text-rose-600' :
              role === 'Master' ? 'text-amber-600' :
              'text-indigo-600'
            } />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">가입 역할</p>
            <p className="text-sm font-bold text-gray-900">{roleInfo.label}</p>
            <p className="text-[11px] text-gray-400">{roleInfo.desc}</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-gray-200/50">
          {successMsg ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="text-green-500" size={40} />
              <p className="text-sm font-bold text-gray-800">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">아이디 <span className="text-gray-300 normal-case">(로그인용, 영문/숫자)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="예: hong123 (영문/숫자/_)"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">이름 <span className="text-gray-300 normal-case">(실명, 화면에 표시됨)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                    required
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
                    placeholder="8자 이상"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">비밀번호 확인</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 transition-all text-gray-900 placeholder:text-gray-300"
                    required
                    autoComplete="new-password"
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
                disabled={isLoading}
                className="w-full py-4 mt-2 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-sm transition-transform active:scale-95 shadow-lg shadow-gray-200/50 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><UserPlus size={18} /> 계정 생성하기</>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          이미 계정이 있으신가요?{' '}
          <button onClick={() => router.push('/login')} className="text-indigo-600 font-bold">
            로그인
          </button>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
