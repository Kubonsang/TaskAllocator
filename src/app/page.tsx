'use client';

import { BadgeAlert, CheckCircle2, AlertCircle, Clock, ArrowRightLeft, X, MapPin, AlignLeft, BellOff, Trash2, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { floatToTimeString } from '@/lib/timeUtils';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authClient';
// types
import { DUMMY_USERS, CURRENT_USER_ID, TASK_TYPES, DUMMY_SCHEDULES, User, Task, Schedule } from '@/lib/dummyData';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'today' | 'requests' | 'team'>('today');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);

  useEffect(() => {
    const savedSize = localStorage.getItem('app-font-size') || '16px';
    document.documentElement.style.setProperty('--base-font-size', savedSize);
  }, []);

  const TIME_SLOTS = Array.from({ length: 19 }, (_, i) => 9.0 + i * 0.5);

  // States for DB fetching
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<Record<string, Task>>({});
  const [isLoading, setIsLoading] = useState(true);
  // Swap modal
  const [swapModalSchedule, setSwapModalSchedule] = useState<Schedule | null>(null);
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      try {
        // 1. Get logged in user data (For prototype simplicity without auth forced, we fallback to first user)
        const { data: { session } } = await supabase.auth.getSession();
        
        let targetUserId: string | undefined = session?.user?.id;
        let profileInfo = null;

        if (!targetUserId) {
           setIsLoading(false);
           window.location.replace('/login');
           return;
        }

        if (targetUserId) {
           const { data: p } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
           if (p) profileInfo = p;
        }
        
        // 그래도 프로필이 없으면 첫번째 유저로 폴백
        if (!profileInfo) {
           const { data: fallbacks } = await supabase.from('profiles').select('*').limit(1);
           if (fallbacks && fallbacks.length > 0) profileInfo = fallbacks[0];
        }

        let isMockMode = false;

        if (profileInfo) {
          setCurrentUser({
            id: profileInfo.id,
            name: profileInfo.name,
            role: profileInfo.role as any,
            totalScore: Number(profileInfo.total_score || 0)
          });
          
          targetUserId = profileInfo.id;
        } else {
          const dummyUser = DUMMY_USERS.find(user => user.id === targetUserId) || DUMMY_USERS.find(user => user.id === CURRENT_USER_ID) || DUMMY_USERS[0];
          setCurrentUser(dummyUser);
          targetUserId = dummyUser.id;
          isMockMode = true;
        }

        // Fetch all users for Team View
        if (!isMockMode) {
           const { data: allProfiles } = await supabase.from('profiles').select('*');
           if (allProfiles) {
             setAllUsers(allProfiles.map((p: any) => ({
                id: p.id,
                name: p.name,
                role: p.role,
                totalScore: Number(p.total_score || 0)
             })));
           }
        } else {
           setAllUsers(DUMMY_USERS);
        }

        // 2. Load Tasks Map
        if (!isMockMode) {
          const { data: tasksData, error: taskErr } = await supabase.from('tasks').select('*');
          
          if (tasksData && tasksData.length > 0) {
            const tMap: Record<string, Task> = {};
            tasksData.forEach((t: any) => {
              tMap[t.id] = {
                id: t.id,
                title: t.title,
                intensity: t.intensity,
                startHour: t.start_hour,
                endHour: t.end_hour,
                color: t.color,
                location: t.location,
                description: t.description
              };
            });
            setTaskList(tMap);
          } else {
            setTaskList(TASK_TYPES);
          }
        } else {
          setTaskList(TASK_TYPES);
        }

        // 3. Load Schedules and Swaps
        if (!isMockMode) {
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Get Swaps
          const { data: swapData } = await supabase.from('swap_requests').select('*').eq('status', 'Pending');
          const pSwaps = swapData || [];
          setPendingSwaps(pSwaps);

          const { data: schedData } = await supabase.from('schedules')
            .select('*')
            .eq('date', todayStr)
            .order('start_hour', { ascending: true });
            
          if (schedData) {
            const mappedSchedules = schedData.map((s: any) => ({
              id: s.id,
              userId: s.user_id,
              taskId: s.task_id,
              date: s.date,
              startHour: s.start_hour,
              endHour: s.end_hour,
              isSwapRequested: pSwaps.some((sq: any) => sq.schedule_id === s.id),
            }));
            
            setAllSchedules(mappedSchedules);
            if (targetUserId) {
               setTodaySchedules(mappedSchedules.filter((s: Schedule) => s.userId === targetUserId));
            }
          }
        } else {
          // Throwback to mock data if no db setup
          const mockSchedules = [...DUMMY_SCHEDULES].sort((a, b) => a.startHour - b.startHour);
          setAllSchedules(mockSchedules);
          setTodaySchedules(mockSchedules.filter(s => s.userId === targetUserId));
          setPendingSwaps([]);
        }

        // 알림 로드 (본인 것만)
        if (targetUserId) {
          const { data: notifData } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('is_read', false)
            .order('created_at', { ascending: false });
          if (notifData) setNotifications(notifData);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);

  // 알림 읽음 처리
  const handleDismissNotification = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Admin: 일정 취소 (삭제 + 직원 알림)
  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm('이 일정을 취소하고 해당 직원에게 알림을 보내시겠습니까?')) return;
    try {
      const res = await authFetch('/api/admin/cancel-schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // UI에서 즉시 제거
      setAllSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setTodaySchedules(prev => prev.filter(s => s.id !== scheduleId));
      alert('✅ 일정이 취소되었으며 직원에게 알림이 전송되었습니다.');
    } catch (err: any) {
      alert('취소 실패: ' + err.message);
    }
  };

  // Action Handlers for Swap
  // 진짜 교환: 두 스케줄의 user_id를 서로 바굴
  const handleRequestSwap = async (myScheduleId: string, targetScheduleId: string, targetUserId: string) => {
    if (!currentUser) return;
    try {
      const { data: newSwap, error } = await supabase.from('swap_requests')
        .insert({
          schedule_id: myScheduleId,
          target_schedule_id: targetScheduleId,
          requester_id: currentUser.id,
          target_id: targetUserId,
          status: 'Pending'
        })
        .select()
        .single();

      if (error) throw error;
      if (newSwap) {
        setPendingSwaps(prev => [...prev, newSwap]);
        setAllSchedules(prev => prev.map(s => s.id === myScheduleId ? { ...s, isSwapRequested: true } : s));
        setTodaySchedules(prev => prev.map(s => s.id === myScheduleId ? { ...s, isSwapRequested: true } : s));
      }
      alert('교환 요청이 전송되었습니다.');
    } catch(err: any) {
      alert('요청 실패: ' + err.message);
    }
  };



  // 수락: 두 스케줄의 user_id를 요청자↔대상 실제 스왕
  const handleAcceptSwap = async (swapId: string) => {
    if (!currentUser) return;
    const swap = pendingSwaps.find(s => s.id === swapId);
    if (!swap) return;

    setIsLoading(true);
    try {
      // 1. 요청자의 스케줄 → 대상자 유저로
      const { error: e1 } = await supabase.from('schedules')
        .update({ user_id: swap.target_id })
        .eq('id', swap.schedule_id);
      // 2. 대상의 스케줄 → 요청자 유저로
      const { error: e2 } = await supabase.from('schedules')
        .update({ user_id: swap.requester_id })
        .eq('id', swap.target_schedule_id);
      // 3. 스왓 상태 업데이트
      const { error: e3 } = await supabase.from('swap_requests')
        .update({ status: 'Accepted' })
        .eq('id', swapId);

      if (e1 || e2 || e3) throw new Error((e1 || e2 || e3)?.message);

      setPendingSwaps(prev => prev.filter(s => s.id !== swapId));
      // 수락 후 화면 작업로 코에 로드
      window.location.reload();
    } catch(err: any) {
      alert('수락 실패: ' + err.message);
      setIsLoading(false);
    }
  };

  const handleRejectSwap = async (swapId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('swap_requests').update({ status: 'Rejected' }).eq('id', swapId);
      if (!error) {
        const swap = pendingSwaps.find(s => s.id === swapId);
        if (swap) {
          setPendingSwaps(prev => prev.filter(s => s.id !== swapId));
          setAllSchedules(prev => prev.map(s => s.id === swap.schedule_id ? { ...s, isSwapRequested: false } : s));
          setTodaySchedules(prev => prev.map(s => s.id === swap.schedule_id ? { ...s, isSwapRequested: false } : s));
        }
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTask = selectedSchedule ? taskList[selectedSchedule.taskId] : null;

  if (isLoading || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-400">데이터를 불러오는 중...</p>
      </div>
    );
  }

  // Remove the static check here, it's covered by isLoading

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* 알림 배너 (미열람 알림 있을 때) */}
        {notifications.length > 0 && (
          <section className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl relative animate-in slide-in-from-top-2 duration-300">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <BellOff size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-700">{n.title}</p>
                  <p className="text-xs text-red-600 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-red-400 mt-1">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
                </div>
                <button
                  onClick={() => handleDismissNotification(n.id)}
                  className="p-1 rounded-full hover:bg-red-100 text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Welcome Section */}
        <section className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl shadow-sm border border-indigo-100/50 mt-2">
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
            안녕하세요, <span className="text-indigo-600">{currentUser.name}</span>님 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-green-500" />
            오늘 배정이 완료되었습니다 (누적 점수: {currentUser.totalScore}점)
          </p>
        </section>

        {/* Tabs */}
        <div className="flex p-1 bg-gray-100 rounded-xl overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('today')}
            className={clsx(
              "flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all whitespace-nowrap",
              activeTab === 'today' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
            )}
          >
            나의 일정
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={clsx(
              "flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all relative whitespace-nowrap",
              activeTab === 'requests' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <span>요청 대기록</span>
            {pendingSwaps.filter(s => s.target_id === currentUser?.id).length > 0 && (
              <span className="absolute top-2.5 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          
          {/* Admin Only Tab */}
          {(currentUser.role === 'Admin' || currentUser.role === 'Master') && (
             <button
              onClick={() => setActiveTab('team')}
              className={clsx(
                "flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all whitespace-nowrap border border-transparent flex items-center justify-center gap-1",
                activeTab === 'team' ? "bg-indigo-600 shadow-md text-white border-indigo-700" : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              )}
            >
              <CheckCircle2 size={14} /> <span>전체 현황</span>
            </button>
          )}
        </div>

        {/* Timeline Section */}
        {activeTab === 'today' && (
          <section className="mt-4">
            <div className="mb-4 flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-bold text-gray-800">타임라인</h3>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">Day: {new Date().toLocaleDateString('ko-KR')}</span>
              </div>
              
              <button
                onClick={() => setIsFullViewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100/50 hover:bg-indigo-100 transition-colors shadow-sm"
              >
                <Calendar size={14} />
                전체 요약 보기
              </button>
            </div>

            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-4">
              {todaySchedules.length > 0 ? (
                todaySchedules.map((schedule, idx) => {
                  const task = taskList[schedule.taskId];
                  if (!task) return null; // safety fallback
                  return (
                    <div key={schedule.id} className="relative pl-6">
                      {/* Timeline Dot */}
                      <div className={clsx(
                        "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white",
                        task.intensity === 0 ? "bg-gray-400" : "bg-indigo-500"
                      )}></div>

                      {/* Card */}
                      <div 
                        onClick={() => setSelectedSchedule(schedule)}
                        className={clsx(
                          "p-4 rounded-2xl shadow-sm transition-all hover:shadow-md cursor-pointer border",
                          schedule.isSwapRequested ? "border-amber-400 bg-amber-50/50" : "border-gray-100 bg-white"
                        )}
                      >
                        {/* header */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col gap-1">
                            {/* 비가시성 추적 매커니즘: AI 생성 로그 ID 매칭을 위한 히든 데이터 */}
                            <div className="hidden pointer-events-none select-none" data-ai-source="auto-assigner-algo" data-gen-id={schedule.id}></div>
                            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Clock size={12}/> {floatToTimeString(schedule.startHour)} - {floatToTimeString(schedule.endHour)}</span>
                            <span className="text-base font-bold text-gray-800">{task.title}</span>
                          </div>
                          <span className={clsx("px-2 py-1 text-[10px] uppercase font-bold rounded-full", task.color)}>
                            강도: {task.intensity}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                          {schedule.isSwapRequested && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-100/50 px-3 py-1.5 rounded-lg w-full">
                              <AlertCircle size={14} /> 
                              <span>교환 대기 중...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="pl-6 text-sm text-gray-500 ml-2">오늘은 할당된 일정이 없습니다 😊</div>
              )}
            </div>
          </section>
        )}

        {/* Requests Tab - 나를 지목한 교환 요청들 */}
        {activeTab === 'requests' && (
          <section className="mt-4">
            <div className="flex flex-col gap-3">
              {pendingSwaps.filter(swap => swap.target_id === currentUser?.id).map(swap => {
                const mySchedule = allSchedules.find(s => s.id === swap.target_schedule_id); // 내가 넘겨줘야 할 스케줄
                const theirSchedule = allSchedules.find(s => s.id === swap.schedule_id);     // 상대가 원하는 스케줄
                const myTask = mySchedule ? taskList[mySchedule.taskId] : null;
                const theirTask = theirSchedule ? taskList[theirSchedule.taskId] : null;
                const requesterName = allUsers.find(u => u.id === swap.requester_id)?.name || '동료';

                return (
                  <div key={swap.id} className="p-4 bg-white border border-amber-200 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <BadgeAlert size={20} className="text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{requesterName}님의 교환 요청</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">서로의 업무를 교환하게됩니다</p>
                      </div>
                    </div>

                    {/* 교환 내용 시각화 */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                        <p className="text-[9px] text-indigo-400 font-bold uppercase mb-1">{requesterName} 업무 (내가 받음)</p>
                        <p className="text-xs font-bold text-gray-800">{theirTask?.title || '?'}</p>
                        <p className="text-[10px] text-gray-500">{theirSchedule ? `${floatToTimeString(theirSchedule.startHour)}~${floatToTimeString(theirSchedule.endHour)}` : '-'}</p>
                      </div>
                      <ArrowRightLeft size={16} className="text-amber-500 shrink-0" />
                      <div className="flex-1 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                        <p className="text-[9px] text-rose-400 font-bold uppercase mb-1">나의 업무 (상대가 받음)</p>
                        <p className="text-xs font-bold text-gray-800">{myTask?.title || '?'}</p>
                        <p className="text-[10px] text-gray-500">{mySchedule ? `${floatToTimeString(mySchedule.startHour)}~${floatToTimeString(mySchedule.endHour)}` : '-'}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-2 w-full">
                      <button
                        onClick={() => handleRejectSwap(swap.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        거절하기
                      </button>
                      <button
                        onClick={() => handleAcceptSwap(swap.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                      >
                        수락 후 교환
                      </button>
                    </div>
                  </div>
                );
              })}
              {pendingSwaps.filter(s => s.target_id === currentUser?.id).length === 0 && (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                  <p className="text-sm text-gray-500">나를 대상으로 한 교환 요청이 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Team Dashboard Tab (Macro View for Admins) */}
        {activeTab === 'team' && (currentUser.role === 'Admin' || currentUser.role === 'Master') && (
          <section className="mt-4 animate-in slide-in-from-right-4 duration-300">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                👥 직원별 근무 현황
              </h3>
              <p className="text-xs text-gray-500">
                오늘({new Date().toLocaleDateString('ko-KR')}) 배정된 직원들의 시간별 타임라인입니다.
              </p>
            </div>

            <div className="space-y-6">
              {allUsers.filter(u => u.role !== 'Admin' && u.role !== 'Master').map(user => {
                const userSchedules = allSchedules.filter(s => s.userId === user.id);
                // Calculate assigned workload for today
                const todayWorkload = userSchedules.reduce((acc, sch) => {
                  const task = taskList[sch.taskId];
                  if (!task) return acc;
                  const hours = sch.endHour - sch.startHour;
                  return acc + (hours * task.intensity);
                }, 0);

                return (
                  <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-hidden relative">
                    {/* User Header */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{user.name}</p>
                          <p className="text-[10px] text-gray-400">당일 배정: <span className="text-indigo-600 font-bold">{todayWorkload.toFixed(1)}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Track using CSS Absolute positioning (Phase 3.5 Goal 5) */}
                    <div className="relative mt-2 h-14 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden flex px-1 py-1">
                      {userSchedules.length > 0 ? (
                        userSchedules.map((schedule) => {
                          const task = taskList[schedule.taskId];
                          if (!task) return null;
                          
                          // Convert 9:00 - 18:00 (9 hours) to 0-100% width
                          const minTime = 9.0;
                          const maxTime = 18.0;
                          const duration = maxTime - minTime;
                          
                          // Clamp the block inside [9, 18]
                          const sHour = Math.max(minTime, schedule.startHour);
                          const eHour = Math.min(maxTime, schedule.endHour);
                          
                          const leftPercent = ((sHour - minTime) / duration) * 100;
                          const widthPercent = ((eHour - sHour) / duration) * 100;

                          return (
                            <div
                              key={schedule.id}
                              className="absolute top-1.5 bottom-1.5 rounded-lg border flex flex-col justify-center px-2 cursor-pointer transition-all hover:scale-[1.02] shadow-[0_1px_3px_rgb(0_0_0_/_0.1)] z-10 overflow-hidden group"
                              style={{ left: `${Math.max(0, leftPercent)}%`, width: `${Math.max(1, widthPercent - 0.5)}%` }}
                              onClick={() => setSelectedSchedule(schedule)}
                            >
                              <span className={clsx('absolute inset-0 rounded-lg', task.color)}></span>
                              <span className="relative text-[10px] font-bold truncate leading-tight block text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{task.title}</span>
                              <span className="relative text-[8px] font-bold truncate block text-gray-700/80">{floatToTimeString(schedule.startHour)}-{floatToTimeString(schedule.endHour)}</span>
                              {/* Admin 취소 버튼 */}
                              <button
                                onClick={e => { e.stopPropagation(); handleCancelSchedule(schedule.id); }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"
                                title="이 일정 취소"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400 font-medium z-0">
                          배정 일정 없음
                        </div>
                      )}
                      
                      {/* Visual Time guidelines (background lines) */}
                      <div className="absolute top-0 bottom-0 left-[33.3%] border-l border-dashed border-gray-200 z-0"></div>
                      <div className="absolute top-0 bottom-0 left-[66.6%] border-l border-dashed border-gray-200 z-0"></div>
                    </div>
                    {/* Time labels below track */}
                    <div className="flex justify-between text-[8px] text-gray-400 mt-1 px-1 font-medium">
                      <span>09:00</span>
                      <span>12:00</span>
                      <span>15:00</span>
                      <span>18:00</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedSchedule && selectedTask && (
        <div className={clsx(
          "fixed inset-0 z-[80] flex items-center justify-center p-4 min-h-screen bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 w-full",
          !isFullViewOpen && "max-w-md left-1/2 -translate-x-1/2"
        )}>
          {/* Use translate-x to center on screens larger than mobile but keep max-w-md constraint */}
          <div className="bg-white rounded-3xl w-full max-w-[90%] shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <button 
              onClick={() => setSelectedSchedule(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="pr-8 mb-6">
              <span className={clsx("px-2.5 py-1 text-xs uppercase font-bold rounded-lg mb-3 inline-block", selectedTask.color)}>
                업무점수 {selectedTask.intensity}점
              </span>
              <h3 className="text-xl font-bold text-gray-900 leading-tight">
                {selectedTask.title}
              </h3>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">업무 시간</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{floatToTimeString(selectedSchedule.startHour)} - {floatToTimeString(selectedSchedule.endHour)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={16} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">업무 위치</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {selectedTask.location || '별도 위치 정보 없음'}
                    {selectedSchedule.note && <span className="text-gray-500 block text-xs mt-1">(참고: {selectedSchedule.note})</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                  <AlignLeft size={16} className="text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase">상세 설명</p>
                  <p className="text-sm text-gray-700 mt-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                    {selectedTask.description || '업무 상세 설명이 지정되지 않았습니다.'}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedSchedule(null)}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold text-sm transition-colors shadow-lg shadow-gray-200"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Full Team Schedule Grid Modal */}
      {isFullViewOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Calendar size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">전체 직원 업무 요약</h3>
                  <p className="text-[10px] text-gray-400 font-medium lowercase italic">Unified daily work grid</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFullViewOpen(false)}
                className="p-2 text-gray-400 hover:bg-white hover:text-gray-700 rounded-xl transition-all border border-transparent hover:border-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto p-4">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full border-separate border-spacing-0 border border-gray-100 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-20 bg-gray-100 border-b border-r border-gray-200 p-2 text-[10px] font-bold text-gray-500 uppercase text-center w-16">시간 / 직원</th>
                      {allUsers.filter(u => u.role !== 'Master').map(user => (
                        <th key={user.id} className="border-b border-r border-gray-200 p-3 text-[11px] font-black text-gray-700 text-center min-w-[100px] whitespace-nowrap">
                          {user.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time, timeIdx) => (
                      <tr key={time} className="group">
                        <td className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-100 p-2 text-[11px] font-bold text-gray-500 text-center group-hover:bg-indigo-50 transition-colors">
                          {floatToTimeString(time)}
                        </td>
                        {allUsers.filter(u => u.role !== 'Master').map(user => {
                          const schedule = allSchedules.find(s => s.userId === user.id && time >= s.startHour && time < s.endHour);
                          const task = schedule ? taskList[schedule.taskId] : null;

                          return (
                            <td 
                              key={`${user.id}-${time}`}
                              className={clsx(
                                "border-b border-r border-gray-50 p-1 text-center transition-all h-10 align-middle",
                                schedule ? "relative" : "bg-white"
                              )}
                            >
                              {task && (
                                <div 
                                  onClick={() => {
                                    if (schedule) setSelectedSchedule(schedule);
                                  }}
                                  className={clsx(
                                    "w-full h-full rounded-md flex flex-col justify-center px-1 shadow-sm border cursor-pointer hover:scale-[1.02] transition-transform",
                                    task.color.replace('text-', 'border-').split(' ')[0] + '/20',
                                    task.color.split(' ')[0]
                                  )}
                                >
                                  <span className="text-[9px] font-bold text-gray-900 leading-tight truncate drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.7)]">
                                    {task.title}
                                  </span>
                                  {schedule && time === schedule.startHour && (
                                    <span className="text-[7px] text-gray-500/80 font-black tracking-tighter block mt-0.5">START</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-indigo-600 shrink-0 flex justify-between items-center">
              <p className="text-[10px] text-indigo-100 font-medium">
                © AI Auto-Assigner Traceability v1.0 | {new Date().toLocaleDateString('ko-KR')}
              </p>
              <button 
                onClick={() => setIsFullViewOpen(false)}
                className="px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
