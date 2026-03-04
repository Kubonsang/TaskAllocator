'use client';

import { Bell, Menu, RefreshCw, X, Clock, MapPin, ArrowRightLeft, AlertTriangle, Check } from 'lucide-react';
import { User, DUMMY_USERS } from '@/lib/dummyData';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authClient';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type WorkerProfile = { id: string; name: string; role: string; total_score: number };
type ScheduleItem = {
  id: string;
  user_id: string;
  start_hour: number;
  end_hour: number;
  note?: string;
  task_id?: string;
  tasks?: { title: string; color: string; location?: string; intensity: number; start_hour: number; end_hour: number };
};

export default function Header() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerProfile | null>(null);
  const [workerSchedules, setWorkerSchedules] = useState<ScheduleItem[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // 교환 관련 상태
  const [swapStep, setSwapStep] = useState<'idle' | 'pick-theirs' | 'pick-mine' | 'confirm'>('idle');
  const [theirPick, setTheirPick] = useState<ScheduleItem | null>(null);
  const [mySchedules, setMySchedules] = useState<ScheduleItem[]>([]);
  const [myPick, setMyPick] = useState<ScheduleItem | null>(null);
  const [swapError, setSwapError] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const targetId = session?.user?.id;
      
      if (!targetId) {
        setCurrentUser(null);
        return;
      }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId).single();
      if (p) {
        setCurrentUser({ id: p.id, name: p.name, role: p.role, totalScore: Number(p.total_score || 0) });
      } else {
        setCurrentUser(null);
      }
    }
    loadUser();
  }, []);

  // 사이드바 열릴 때 직원 목록 로드
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    async function loadWorkers() {
     // 유저 요청에 따라 '대표(Admin)'와 '업무(Worker)' 권한만 업무 배정 풀에 노출
     const { data } = await supabase.from('profiles').select('id, name, role, total_score').in('role', ['Worker', 'Admin']).order('name');
     if (data) setWorkers(data);
    }
    loadWorkers();
  }, [isOpen, currentUser]);

  const isAuthPage = pathname === '/login' || pathname.startsWith('/register');



  // 직원 클릭 시 오늘 일정 로드
  const handleWorkerClick = async (worker: WorkerProfile) => {
    setSelectedWorker(worker);
    setSwapStep('idle');
    setTheirPick(null);
    setMyPick(null);
    setSwapError('');
    setIsLoadingSchedule(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('schedules')
        .select('*, tasks(*)')
        .eq('user_id', worker.id)
        .eq('date', today)
        .order('start_hour');
      setWorkerSchedules(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  // 교환 시작: 상대 업무 선택
  const handleStartSwap = () => {
    setSwapStep('pick-theirs');
    setTheirPick(null);
    setMyPick(null);
    setSwapError('');
  };

  // 상대 업무 선택 → 내 업무 로드
  const handlePickTheirs = async (schedule: ScheduleItem) => {
    if (!currentUser) return;
    setTheirPick(schedule);
    setSwapError('');

    // 내 오늘 일정 가져오기
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('schedules')
      .select('*, tasks(*)')
      .eq('user_id', currentUser.id)
      .eq('date', today)
      .order('start_hour');
    setMySchedules(data || []);
    setSwapStep('pick-mine');
  };

  // 시간 겹침 체크
  const isOverlapping = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
    return aStart < bEnd && bStart < aEnd;
  };

  // 내 업무 선택 → 충돌 검증
  const handlePickMine = (schedule: ScheduleItem) => {
    if (!theirPick) return;
    setSwapError('');

    // 1) 같은 시간대인지 검증
    if (!isOverlapping(theirPick.start_hour, theirPick.end_hour, schedule.start_hour, schedule.end_hour)) {
      setSwapError('⚠️ 서로 겹치는 시간대의 업무만 교환 가능합니다.');
      return;
    }

    // 2) 상대 업무가 내 기존 업무와 충돌하는지 검증
    //    (내가 교환하려는 업무를 빼고, 나머지 내 업무들과 상대 업무의 시간이 겹치는지)
    const myOtherSchedules = mySchedules.filter(s => s.id !== schedule.id);
    const theirTaskStart = theirPick.start_hour;
    const theirTaskEnd = theirPick.end_hour;

    for (const other of myOtherSchedules) {
      if (isOverlapping(theirTaskStart, theirTaskEnd, other.start_hour, other.end_hour)) {
        const conflictName = other.tasks?.title || '다른 업무';
        setSwapError(`⚠️ 교환하려는 업무(${floatToTime(theirTaskStart)}~${floatToTime(theirTaskEnd)})가 내 "${conflictName}"(${floatToTime(other.start_hour)}~${floatToTime(other.end_hour)})과 시간이 겹쳐 교환 불가합니다.`);
        return;
      }
    }

    // 3) 마찬가지로 내 업무가 상대 기존 업무와 충돌하지 않는지 검증
    const theirOtherSchedules = workerSchedules.filter(s => s.id !== theirPick.id);
    const myTaskStart = schedule.start_hour;
    const myTaskEnd = schedule.end_hour;

    for (const other of theirOtherSchedules) {
      if (isOverlapping(myTaskStart, myTaskEnd, other.start_hour, other.end_hour)) {
        const conflictName = other.tasks?.title || '다른 업무';
        setSwapError(`⚠️ 내 업무(${floatToTime(myTaskStart)}~${floatToTime(myTaskEnd)})가 상대의 "${conflictName}"(${floatToTime(other.start_hour)}~${floatToTime(other.end_hour)})과 충돌하여 교환 불가합니다.`);
        return;
      }
    }

    setMyPick(schedule);
    setSwapStep('confirm');
  };

  // 교환 실행 (요청 전송)
  const handleExecuteSwap = async () => {
    if (!theirPick || !myPick || !currentUser || !selectedWorker) return;
    setIsSwapping(true);
    try {
      // 진짜 교환을 바로 하지 않고, swap_requests 테이블에 Pending 상태로 등록
      const { error } = await supabase.from('swap_requests')
        .insert({
          schedule_id: myPick.id,              // 내 스케줄
          target_schedule_id: theirPick.id,    // 상대 스케줄
          requester_id: currentUser.id,
          target_id: selectedWorker.id,
          status: 'Pending'
        });

      if (error) throw new Error(error.message);

      alert(`✅ ${selectedWorker.name}님에게 업무 교환을 요청했습니다!\n(메인 화면의 '요청 대기 목록'에서 확인할 수 있습니다)`);
      
      // 리셋 후 상대 일정 재로드
      setSwapStep('idle');
      setTheirPick(null);
      setMyPick(null);
      setSwapError('');
      handleWorkerClick(selectedWorker);
      // 메인 페이지 반영
      window.location.reload();
    } catch (err: any) {
      alert('교환 요청 실패: ' + err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  const floatToTime = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleTestNotification = async () => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification('새로운 배정 안내', {
          body: '방금 새로운 업무가 배정/교환되었습니다!',
          icon: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200]
        } as never);
      } else {
        alert('알림 권한이 없습니다. 설정을 허용해주세요.');
        Notification.requestPermission();
      }
    } else {
      alert('현재 기기에서 푸시 알림을 지원하지 않습니다.');
    }
  };

  const runAlgorithm = async () => {
    try {
      const res = await authFetch('/api/assign', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ 배정 완료! ${data.assignedCount}건 배정됨 (${data.mode})\n화면을 새로고침합니다.`);
        window.location.reload();
      } else {
        alert(`배정 실패: ${data.error}`);
      }
    } catch (e) {
      alert('배정 실패: 서버 오류');
    }
  };


  if (!currentUser || isAuthPage) {
    return (
      <header className="fixed top-0 w-full max-w-md bg-white border-b border-gray-100 shadow-sm z-50 h-[60px] px-4 flex justify-between items-center isolate">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 tracking-tight">
            Auto-Assigner
          </span>
        </div>
      </header>
    );
  }

  // 렌더 헬퍼: 스케줄 카드
  const renderScheduleCard = (s: ScheduleItem, options?: { onClick?: () => void; selected?: boolean; disabled?: boolean; disabledReason?: string }) => (
    <button
      key={s.id}
      onClick={options?.onClick}
      disabled={options?.disabled}
      className={clsx(
        "w-full text-left p-3 rounded-xl border shadow-sm transition-all",
        options?.selected
          ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200"
          : options?.disabled
            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
            : "border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.98] cursor-pointer"
      )}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className={clsx(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          s.tasks?.color || 'bg-gray-100 text-gray-700'
        )}>
          강도 {s.tasks?.intensity ?? '-'}
        </span>
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
          <Clock size={10} />
          {floatToTime(s.start_hour)} - {floatToTime(s.end_hour)}
        </span>
      </div>
      <div className="font-bold text-sm text-gray-800">
        <div className="hidden" aria-hidden="true">AI_GEN_CONTENT_TRACE_{s.id}</div>
        {s.tasks?.title || '미분류 일정'}
      </div>
      {s.tasks?.location && (
        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-0.5">
          <MapPin size={10} /> {s.tasks.location}
        </div>
      )}
      {options?.disabledReason && (
        <div className="text-[10px] text-red-400 mt-1">{options.disabledReason}</div>
      )}
    </button>
  );

  return (
    <header className="fixed top-0 w-full max-w-md bg-white border-b border-gray-100 shadow-sm z-50 h-[60px] px-4 flex justify-between items-center isolate">
      <div className="flex items-center gap-3">
        <button onClick={() => { setIsOpen(true); setSelectedWorker(null); setSwapStep('idle'); }} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors relative">
          <Menu size={24} />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></span>
        </button>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 tracking-tight cursor-pointer" onClick={() => { setIsOpen(true); setSelectedWorker(null); setSwapStep('idle'); }}>
          Auto-Assigner
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={handleTestNotification} title="알림 즉시 발송" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
          <Bell size={22} />
        </button>
      </div>

      {/* 사이드바 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-start" onClick={() => setIsOpen(false)}>
          <div className="w-72 bg-white h-full shadow-2xl safe-area-left flex flex-col animate-in slide-in-from-left-4 duration-300" onClick={e => e.stopPropagation()}>
            
            {/* 헤더 */}
            <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-800 text-sm">
                {swapStep === 'pick-theirs' ? '🔄 상대 업무 선택' :
                 swapStep === 'pick-mine' ? '🔄 내 업무 선택' :
                 swapStep === 'confirm' ? '🔄 교환 확인' :
                 selectedWorker ? '직원 하루 일정' : '직원 목록'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full text-gray-400 hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            {/* 현재 로그인 계정 (항상 상단) */}
            <div className="p-3 border-b border-gray-100 bg-indigo-50/50 shrink-0">
              <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-indigo-100 shadow-sm">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                    {currentUser.name}
                    <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">나</span>
                  </div>
                  <div className={clsx(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded inline-block mt-0.5",
                    currentUser.role === 'Admin' ? 'bg-amber-100 text-amber-700' :
                    currentUser.role === 'Master' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-600'
                  )}>
                    {currentUser.role === 'Admin' ? '대표' : (currentUser.role === 'Master' ? '마스터' : '업무')}
                  </div>
                </div>
              </div>
            </div>

            {/* ===================== 교환 확인 단계 ===================== */}
            {swapStep === 'confirm' && theirPick && myPick && selectedWorker ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-center">
                  <ArrowRightLeft size={28} className="text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-800">아래 업무를 서로 교환하시겠습니까?</p>
                </div>

                {/* 상대 업무 → 내가 받는 */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1.5">내가 받는 업무 ({selectedWorker.name}의)</p>
                  <p className="text-sm font-bold text-gray-800">{theirPick.tasks?.title}</p>
                  <p className="text-[10px] text-gray-500">{floatToTime(theirPick.start_hour)} ~ {floatToTime(theirPick.end_hour)}</p>
                </div>

                <div className="flex justify-center"><ArrowRightLeft size={16} className="text-gray-300" /></div>

                {/* 내 업무 → 상대가 받는 */}
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <p className="text-[9px] font-bold text-rose-600 uppercase mb-1.5">상대가 받는 업무 (나의)</p>
                  <p className="text-sm font-bold text-gray-800">{myPick.tasks?.title}</p>
                  <p className="text-[10px] text-gray-500">{floatToTime(myPick.start_hour)} ~ {floatToTime(myPick.end_hour)}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setSwapStep('idle'); setTheirPick(null); setMyPick(null); }}
                    className="flex-1 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleExecuteSwap}
                    disabled={isSwapping}
                    className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-1 disabled:opacity-60 shadow-md shadow-indigo-200"
                  >
                    {isSwapping ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    교환 요청하기
                  </button>
                </div>
              </div>
            ) :

            /* ===================== 내 업무 선택 단계 ===================== */
            swapStep === 'pick-mine' && theirPick ? (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => { setSwapStep('pick-theirs'); setTheirPick(null); }}
                  className="w-full text-left p-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1 border-b border-gray-100 shrink-0"
                >
                  ← 상대 업무 다시 선택
                </button>

                {/* 선택된 상대 업무 미리보기 */}
                <div className="p-3 bg-emerald-50/50 border-b border-gray-100 shrink-0">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">선택한 상대 업무</p>
                  <p className="text-xs font-bold text-gray-800">{theirPick.tasks?.title} ({floatToTime(theirPick.start_hour)}~{floatToTime(theirPick.end_hour)})</p>
                </div>

                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">내 업무 중 교환할 것을 선택하세요</p>
                </div>

                {swapError && (
                  <div className="mx-3 mt-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-medium flex items-start gap-1.5">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{swapError}</span>
                  </div>
                )}

                <div className="p-3 space-y-2">
                  {mySchedules.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400">오늘 배정된 업무가 없습니다.</div>
                  ) : (
                    mySchedules.map(s => {
                      const sameTimeSlot = isOverlapping(theirPick.start_hour, theirPick.end_hour, s.start_hour, s.end_hour);
                      return renderScheduleCard(s, {
                        onClick: () => handlePickMine(s),
                        disabled: !sameTimeSlot,
                        disabledReason: !sameTimeSlot ? '시간대가 겹치지 않음' : undefined,
                      });
                    })
                  )}
                </div>
              </div>
            ) :

            /* ===================== 상대 업무 선택 단계 ===================== */
            swapStep === 'pick-theirs' && selectedWorker ? (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setSwapStep('idle')}
                  className="w-full text-left p-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1 border-b border-gray-100 shrink-0"
                >
                  ← 교환 취소
                </button>
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedWorker.name}의 업무 중 원하는 것을 선택하세요</p>
                </div>
                <div className="p-3 space-y-2">
                  {workerSchedules.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400">교환 가능한 업무가 없습니다.</div>
                  ) : (
                    workerSchedules.map(s => renderScheduleCard(s, {
                      onClick: () => handlePickTheirs(s),
                    }))
                  )}
                </div>
              </div>
            ) :

            /* ===================== 직원 일정 보기 (기본) ===================== */
            selectedWorker ? (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="w-full text-left p-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1 border-b border-gray-100 shrink-0"
                >
                  ← 목록으로
                </button>
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0",
                      selectedWorker.id === currentUser.id
                        ? "bg-gradient-to-tr from-indigo-500 to-purple-500"
                        : "bg-gradient-to-tr from-teal-400 to-emerald-500"
                    )}>
                      {selectedWorker.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{selectedWorker.name}</div>
                      <div className="text-[10px] text-gray-500">
                        오늘({new Date().toLocaleDateString('ko-KR')}) 일정
                      </div>
                    </div>
                  </div>
                  {/* 교환 버튼: 자기 자신이 아닌 경우만 */}
                  {selectedWorker.id !== currentUser.id && workerSchedules.length > 0 && (
                    <button
                      onClick={handleStartSwap}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors"
                    >
                      <ArrowRightLeft size={12} />
                      교환
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  {isLoadingSchedule ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw size={18} className="text-gray-400 animate-spin" />
                    </div>
                  ) : workerSchedules.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400">
                      오늘 배정된 일정이 없습니다.
                    </div>
                  ) : (
                    workerSchedules.map(s => (
                      <div key={s.id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            s.tasks?.color || 'bg-gray-100 text-gray-700'
                          )}>
                            강도 {s.tasks?.intensity ?? '-'}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock size={10} />
                            {floatToTime(s.start_hour)} - {floatToTime(s.end_hour)}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-gray-800">
                          {s.tasks?.title || '미분류 일정'}
                        </div>
                        {s.tasks?.location && (
                          <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-0.5">
                            <MapPin size={10} /> {s.tasks.location}
                          </div>
                        )}
                        {s.note && (
                          <div className="text-[10px] text-gray-400 mt-1">📝 {s.note}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (

            /* ===================== 전체 직원 목록 ===================== */
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    전체 직원 ({workers.length}명)
                  </p>
                </div>
                <div className="px-3 pb-3 space-y-1">
                  {workers.map(w => {
                    const isMe = w.id === currentUser.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => handleWorkerClick(w)}
                        className={clsx(
                          "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left",
                          isMe
                            ? "bg-indigo-50 border border-indigo-100"
                            : "hover:bg-gray-50 border border-transparent"
                        )}
                      >
                        <div className={clsx(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0",
                          isMe
                            ? "bg-gradient-to-tr from-indigo-500 to-purple-500"
                            : "bg-gradient-to-tr from-teal-400 to-emerald-500"
                        )}>
                          {w.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-800 truncate flex items-center gap-1">
                            {w.name}
                            {isMe && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-bold">나</span>}
                          </div>
                          <div className={clsx(
                            "text-[9px] font-bold uppercase px-1 py-0.5 rounded inline-block",
                            w.role === 'Admin' ? 'bg-amber-100 text-amber-700' :
                            w.role === 'Master' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-500'
                          )}>
                            {w.role === 'Admin' ? '대표' : (w.role === 'Master' ? '마스터' : '업무')}
                          </div>
                        </div>
                        <span className="text-gray-300 text-lg">›</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
