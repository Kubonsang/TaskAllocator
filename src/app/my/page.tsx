'use client';

import { DUMMY_USERS, User } from '@/lib/dummyData';
import { LogOut, Bell, BellRing, Trash2, FileSpreadsheet, X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase';

export default function MyPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    async function loadUser() {
      // 1부선: 실제 Supabase 세션에서 로그인 유저 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      let targetId: string | undefined = session?.user?.id;

      // 세션이 없으면 리턴
      if (!targetId) return;

      if (targetId) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId).single();
        if (p) {
          setCurrentUser({ id: p.id, name: p.name, role: p.role, totalScore: Number(p.total_score) });
          return;
        }
      }

      // 마지막 폴백: DB 첫 번째 유저
      const { data: f } = await supabase.from('profiles').select('*').limit(1);
      if (f && f.length > 0) {
        setCurrentUser({ id: f[0].id, name: f[0].name, role: f[0].role, totalScore: Number(f[0].total_score) });
        return;
      }
      setCurrentUser(DUMMY_USERS[0]);
    }
    loadUser();
  }, []);

  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [selectedTaskTab, setSelectedTaskTab] = useState('전체');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [fontSize, setFontSize] = useState('16px'); // Default

  useEffect(() => {
    const savedSize = localStorage.getItem('app-font-size') || '16px';
    setFontSize(savedSize);
    document.documentElement.style.setProperty('--base-font-size', savedSize);
  }, []);

  const changeFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('app-font-size', size);
    document.documentElement.style.setProperty('--base-font-size', size);
  };

  useEffect(() => {
    const fetchAllTasks = async () => {
       const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
       if (data) setAllTasks(data);
    };
    fetchAllTasks();
  }, []);

  useEffect(() => {
    const checkPushSubStatus = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) setIsPushSubscribed(true);
      }
    };
    checkPushSubStatus();
  }, []);

  const handleSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('현재 브라우저에서는 서비스 워커 및 푸시 알림을 지원하지 않습니다. (Safari의 경우 최신 버전을 사용하거나 홈 화면 추가가 필요합니다)');
      return;
    }

    if (!currentUser) return;
    setIsSubscribing(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        setIsSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Calculate Uint8Array from Base64 URL safe VAPID key (환경 변수 전용, 하드코딩 금지)
      const vapidKeyString = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKeyString) {
        alert('푸시 알림 설정 오류: VAPID 공개키가 환경 변수에 설정되지 않았습니다. 관리자에게 문의하세요.');
        setIsSubscribing(false);
        return;
      }
      const cleanVapidKey = vapidKeyString.replace(/['"]/g, '').trim();
      
      const padding = '='.repeat((4 - cleanVapidKey.length % 4) % 4);
      const base64 = (cleanVapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      // Clear existing conflicting subscriptions
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
         await existingSub.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          subscription
        })
      });

      if (!res.ok) throw new Error('서버에 구독 정보를 저장하지 못했습니다.');
      
      setIsPushSubscribed(true);
      alert('🎉 실시간 푸시 알림 구독이 완료되었습니다!\n이제 앱을 종료해도 업무 배정 시 알림이 수신됩니다.');
    } catch (err: any) {
      console.error(err);
      alert('푸시 알림 구독 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleUnsubscribePush = async () => {
    if (!('serviceWorker' in navigator)) return;
    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // DB에서 구독 삭제
        await fetch('/api/push/unsubscribe', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setIsPushSubscribed(false);
      alert('푸시 알림 구독이 해제되었습니다.');
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!currentUser) return (
     <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 flex border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
     </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Profile Section */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-md uppercase">
          {currentUser.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">{currentUser.name}</h2>
            <span className={clsx(
              "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md",
              (currentUser.role === 'Admin' || currentUser.role === 'Master') ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
            )}>
               {currentUser.role === 'Admin' ? '대표' : (currentUser.role === 'Master' ? '마스터' : '업무')}
            </span>
          </div>
          <p className="text-sm text-gray-500">누적 배정 점수: <span className="font-bold text-indigo-600">{currentUser.totalScore}점</span></p>
        </div>
      </section>

      {/* Task DB Access for Everyone */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
         <button onClick={() => setIsTableModalOpen(true)} className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors text-left text-sm font-bold text-gray-800">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileSpreadsheet size={20}/></div>
               <div>
                 사내 전체 업무 DB 조회
                 <span className="block text-xs font-normal text-gray-400 mt-0.5">등록된 모든 업무({allTasks.length}건)를 테이블로 확인합니다.</span>
               </div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
               <span className="text-xl leading-none">›</span>
            </div>
         </button>
      </section>

      {/* General Settings */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {isPushSubscribed ? (
           <button 
             onClick={handleUnsubscribePush}
             disabled={isSubscribing}
             className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm font-bold text-gray-700 border-b border-gray-100 disabled:opacity-50"
           >
             <div className="flex items-center gap-2">
               <BellRing className="text-green-500" size={16} /> 푸시 알림 구독 중 (알림 켜짐)
             </div>
             <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full flex gap-1 items-center"><Check size={8}/> 활성됨</span>
           </button>
        ) : (
           <button 
             onClick={handleSubscribePush}
             disabled={isSubscribing}
             className="w-full p-4 flex items-center justify-between hover:bg-indigo-50 transition-colors text-sm font-bold text-indigo-700 border-b border-gray-100 disabled:opacity-50"
           >
             <div className="flex items-center gap-2">
               <Bell size={16} /> 실시간 푸시 알림 기기 등록하기
             </div>
           </button>
        )}
        {/* Font Size Setting */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
           <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">글꼴 크기 설정</p>
           <div className="flex gap-2">
              {[
                { label: '작게', size: '14px' },
                { label: '기본', size: '18px' },
                { label: '크게', size: '24px' }
              ].map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => changeFontSize(opt.size)}
                  className={clsx(
                    "flex-1 py-2 text-xs font-bold rounded-xl transition-all border",
                    fontSize === opt.size 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
           </div>
        </div>

        <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 border-b border-gray-100">
          앱 버전 정보 (v2.2)
        </button>
        <button
          onClick={async () => {
            const step1 = confirm('⚠️ 정말로 계정을 삭제하시겠습니까?\n\n삭제하면 모든 배정 기록과 계정 정보가 영구적으로 사라집니다.');
            if (!step1) return;
            const step2 = confirm('마지막 확인: 이 작업은 되돌릴 수 없습니다.\n계정을 완전히 삭제하시겠습니까?');
            if (!step2) return;

            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                alert('세션이 없습니다. 다시 로그인해주세요.');
                return;
              }
              const res = await fetch('/api/auth/delete-account', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);

              alert('계정이 삭제되었습니다. 이용해 주셔서 감사합니다.');

              window.location.href = '/login';
            } catch (err: any) {
              alert('계정 삭제 실패: ' + err.message);
            }
          }}
          className="w-full p-4 flex items-center gap-2 hover:bg-red-50 transition-colors text-sm font-medium text-red-400 border-b border-gray-100"
        >
          <Trash2 size={16} /> 계정 삭제
        </button>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="w-full p-4 flex items-center gap-2 hover:bg-red-50 transition-colors text-sm font-bold text-red-500"
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </section>



      {isTableModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col p-4 bg-gray-50/95 backdrop-blur-md">
           <div className="flex justify-between items-center mb-4 mt-8 px-2">
              <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2"><FileSpreadsheet size={24} className="text-blue-600"/> 데이터 테이블 (업무 Pool)</h3>
              <button onClick={() => setIsTableModalOpen(false)} className="p-2 rounded-full bg-white text-gray-600 shadow-sm"><X size={20}/></button>
           </div>
           
           <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="flex overflow-x-auto gap-2 p-3 border-b border-gray-100 bg-gray-50/50">
                 {['전체', '월', '화', '수', '목', '금', '단발/기타'].map(tab => (
                    <button
                       key={tab}
                       onClick={() => setSelectedTaskTab(tab)}
                       className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          selectedTaskTab === tab 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                       }`}
                    >
                       {tab}
                    </button>
                 ))}
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                 {(() => {
                    const filteredTasks = allTasks.filter(t => {
                       if (selectedTaskTab === '전체') return true;
                       if (selectedTaskTab === '단발/기타') return t.set_id === 'EMERGENCY' || t.set_id?.includes('토') || t.set_id?.includes('일');
                       if (!t.set_id) return true; // 매일 배정
                       if (t.set_id === 'EMERGENCY') return false;
                       return t.set_id.includes(selectedTaskTab);
                    });

                    if (filteredTasks.length === 0) {
                       return <div className="p-10 text-center text-gray-400">해당 분류에 업무가 없습니다.</div>;
                    }

                    return (
                       <div className="space-y-2">
                          {filteredTasks.map(t => (
                          <div key={t.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                             <div className="flex justify-between items-start">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.color || 'bg-gray-200 text-gray-700'}`}>
                                   강도 {t.intensity}
                                </span>
                             </div>
                             <div>
                               <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                  {t.title}
                                  {t.set_id && t.set_id !== 'EMERGENCY' && <span className="px-1 text-[9px] bg-indigo-50 text-indigo-500 rounded border border-indigo-100">{t.set_id}만</span>}
                                  {t.set_id === 'EMERGENCY' && <span className="px-1 text-[9px] bg-rose-50 text-rose-500 rounded border border-rose-100">긴급단발</span>}
                               </div>
                               {t.location && <div className="text-[10px] text-gray-500 mt-0.5">📍 {t.location}</div>}
                               <div className="text-xs text-gray-600 mt-1.5 flex gap-2">
                                  <span>⏰ {t.start_hour}시 ~ {t.end_hour}시</span>
                               </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 );
                 })()}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
