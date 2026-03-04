'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, ShieldAlert, Zap, RefreshCw, ClipboardList, PlusCircle, AlertCircle, X, Link2, Copy, Check, Trash2, CalendarDays } from 'lucide-react';
import clsx from 'clsx';
import { parseLegacyExcelData } from '@/lib/excelParser';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authClient';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      let targetId: string | undefined = session?.user?.id;

      if (targetId) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', targetId).single();
        if (p) {
          setCurrentUser(p);
          if (p.role === 'Admin' || p.role === 'Master') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            router.push('/');
          }
          return;
        }
      }
      setIsAdmin(false);
      router.push('/');
    }
    checkAdmin();
  }, [router]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isRunningAlgo, setIsRunningAlgo] = useState(false);
  const [algoResult, setAlgoResult] = useState<{count: number, mode: string} | null>(null);

  const [allTasks, setAllTasks] = useState<any[]>([]);

  useEffect(() => {
    const savedSize = localStorage.getItem('app-font-size') || '16px';
    document.documentElement.style.setProperty('--base-font-size', savedSize);
  }, []);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAllSchedulesModalOpen, setIsAllSchedulesModalOpen] = useState(false);
  const [selectedTaskTab, setSelectedTaskTab] = useState('전체');

  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [allSchedulesData, setAllSchedulesData] = useState<{user: any, schedules: any[]}[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [editScheduleData, setEditScheduleData] = useState({ startHour: 9, endHour: 10, note: '' });
  
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<'Worker'|'Admin'|'Master'>('Worker');
  
  const [newTask, setNewTask] = useState({ 
    title: '', intensity: 1, startHour: 9, endHour: 10, 
    color: 'bg-emerald-100 text-emerald-800', location: '', description: '', 
    days: [] as string[],
    preferred_users: [] as string[],
    disliked_users: [] as string[],
    excluded_users: [] as string[]
  });
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [editingTaskWorkers, setEditingTaskWorkers] = useState<any>(null);
  const [emergencyConfig, setEmergencyConfig] = useState({ title: '긴급 지원', intensity: 2, startHour: 14, endHour: 15, location: '', description: '', color: 'bg-rose-100 text-rose-800' });

  const fetchAllTasks = async () => {
     const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
     if (data) setAllTasks(data);
  };

  const fetchAllWorkers = async () => {
     // 대표(Admin)와 업무(Worker) 권한만 업무 배정 풀에 노출 (Master인 CEO 본인 제외)
     const { data } = await supabase.from('profiles').select('id, name, role').in('role', ['Worker', 'Admin']).order('name');
     if (data) setAllWorkers(data);
  };

  const fetchAllSchedules = async (dateStr: string) => {
    setIsLoadingSchedules(true);
    try {
      // 전체 일정 조회 시에도 Requester를 제외하고 실제 투입 인원인 Worker, Master, Admin만 조회
      const { data: users } = await supabase.from('profiles').select('*').in('role', ['Worker', 'Master', 'Admin']);
      // Fetch schedules directly and also inner join tasks via Supabase related syntax
      const { data: schedules } = await supabase.from('schedules').select(`
        *,
        tasks (*)
      `).eq('date', dateStr);
      
      if (users) {
        const combined = users.map(u => {
          return {
            user: u,
            schedules: schedules ? schedules.filter(s => s.user_id === u.id).sort((a: any, b: any) => a.start_hour - b.start_hour) : []
          };
        });
        setAllSchedulesData(combined);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const handleEditScheduleClick = (schedule: any) => {
    setEditingScheduleId(schedule.id);
    setEditScheduleData({ 
      startHour: schedule.start_hour || 9, 
      endHour: schedule.end_hour || 10, 
      note: schedule.note || '' 
    });
  };

  const handleSaveScheduleEdit = async () => {
    if (!editingScheduleId) return;
    try {
       const res = await authFetch('/api/admin/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             scheduleId: editingScheduleId, 
             startHour: editScheduleData.startHour, 
             endHour: editScheduleData.endHour, 
             note: editScheduleData.note 
          })
       });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);
       alert('일정이 수정되었습니다.');
       setEditingScheduleId(null);
       fetchAllSchedules(scheduleDate);
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까? (이 작업은 복구할 수 없습니다)')) return;
    try {
       const res = await authFetch('/api/admin/schedule', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleId })
       });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);
       alert('일정이 삭제되었습니다.');
       fetchAllSchedules(scheduleDate);
    } catch (err: any) { alert(err.message); }
  };


  useEffect(() => {
    if (isAllSchedulesModalOpen) {
      fetchAllSchedules(scheduleDate);
    }
  }, [scheduleDate, isAllSchedulesModalOpen]);

  useEffect(() => {
    if (isAdmin) {
       fetchAllTasks();
       fetchAllWorkers();
    }
  }, [isAdmin]);

  const handleCreateTask = async () => {
     try {
       const targetDays = newTask.days.length > 0 ? newTask.days.join(',') : null;
       const mappedTask = {
         title: newTask.title, intensity: newTask.intensity, start_hour: newTask.startHour, end_hour: newTask.endHour, color: newTask.color, location: newTask.location, description: newTask.description,
         set_id: targetDays,
         preferred_users: newTask.preferred_users,
         disliked_users: newTask.disliked_users,
         excluded_users: newTask.excluded_users
       };
       const { error } = await supabase.from('tasks').insert([mappedTask]);
       if (error) throw error;
       alert('신규 업무 종류가 DB에 등록되었습니다.');
       setIsTaskModalOpen(false);
       setNewTask({ title: '', intensity: 1, startHour: 9, endHour: 10, color: 'bg-emerald-100 text-emerald-800', location: '', description: '', days: [], preferred_users: [], disliked_users: [], excluded_users: [] });
       fetchAllTasks();
     } catch (err: any) { alert(err.message); }
  };

  const handleEmergencyAssign = async () => {
     try {
        const res = await authFetch('/api/assign/emergency', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(emergencyConfig)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(`✅ 긴급 자동 할당 완료! \n가장 부하가 적은 [${data.assignedTo}] 님에게 당첨되었습니다! (기존 오늘 부하치: ${data.dailyLoadBefore})`);
        setIsEmergencyModalOpen(false);
     } catch (err: any) { alert(err.message); }
  };

  const handleDeleteTask = async (id: string) => {
     if (!confirm('이 업무를 데이터베이스에서 정말 삭제하시겠습니까? (이 업무로 배정되었던 과거 기록은 유지됩니다)')) return;
     try {
       const { error } = await supabase.from('tasks').delete().eq('id', id);
       if (error) throw error;
       alert('삭제 완료');
       fetchAllTasks();
     } catch (err: any) { alert('삭제 실패: ' + err.message); }
  };

  const toggleDay = (day: string) => {
    setNewTask(prev => {
       const has = prev.days.includes(day);
       if (has) return { ...prev, days: prev.days.filter(d => d !== day) };
       return { ...prev, days: [...prev.days, day] };
    });
  };

  const toggleWorkerCategory = (workerId: string, listType: 'preferred_users' | 'disliked_users' | 'excluded_users') => {
    setNewTask(prev => {
      // 교차 중복을 막기 위해 모든 리스트에서 이 워커를 일단 지움
      const preferred = prev.preferred_users.filter(id => id !== workerId);
      const disliked = prev.disliked_users.filter(id => id !== workerId);
      const excluded = prev.excluded_users.filter(id => id !== workerId);

      // 목표 리스트에 이미 있었다면 그냥 삭제된 상태로 둔다 (토글 off)
      const wasInTarget = prev[listType].includes(workerId);
      if (!wasInTarget) {
        if (listType === 'preferred_users') preferred.push(workerId);
        if (listType === 'disliked_users') disliked.push(workerId);
        if (listType === 'excluded_users') excluded.push(workerId);
      }

      return {
        ...prev,
        preferred_users: preferred,
        disliked_users: disliked,
        excluded_users: excluded
      };
    });
  };

  const toggleEditingWorkerCategory = (workerId: string, listType: 'preferred_users' | 'disliked_users' | 'excluded_users') => {
    setEditingTaskWorkers((prev: any) => {
      const preferred = (prev.preferred_users || []).filter((id: string) => id !== workerId);
      const disliked = (prev.disliked_users || []).filter((id: string) => id !== workerId);
      const excluded = (prev.excluded_users || []).filter((id: string) => id !== workerId);

      const wasInTarget = (prev[listType] || []).includes(workerId);
      if (!wasInTarget) {
        if (listType === 'preferred_users') preferred.push(workerId);
        if (listType === 'disliked_users') disliked.push(workerId);
        if (listType === 'excluded_users') excluded.push(workerId);
      }

      return {
        ...prev,
        preferred_users: preferred,
        disliked_users: disliked,
        excluded_users: excluded
      };
    });
  };

  const handleSaveTaskWorkers = async () => {
    try {
      const { id, preferred_users, disliked_users, excluded_users } = editingTaskWorkers;
      const { error } = await supabase.from('tasks').update({
        preferred_users, disliked_users, excluded_users
      }).eq('id', id);
      if (error) throw error;
      alert('인력 설정이 저장되었습니다.');
      setEditingTaskWorkers(null);
      fetchAllTasks();
    } catch (err: any) { alert(err.message); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
       alert('자기 자신의 계정은 삭제할 수 없습니다. (관리자 페이지에서는 본인 계정 삭제가 금지됩니다. [내 정보] 메뉴를 이용하세요)');
       return;
    }
    if (!confirm(`[${userName}] 님의 계정을 정말 삭제하시겠습니까? \n삭제 시 모든 개인 설정 및 배정 기록 데이터가 연결 해제됩니다.`)) return;

    try {
       const { data: { session } } = await supabase.auth.getSession();
       const res = await authFetch('/api/auth/delete-account', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ userId })
       });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);

       alert('계정이 성공적으로 삭제되었습니다.');
       fetchAllWorkers(); // 명단 새로고침
    } catch (err: any) {
       alert('삭제 실패: ' + err.message);
    }
  };

  const handleGenerateInvite = async () => {
    if (!currentUser) return;
    setIsGeneratingInvite(true);
    setGeneratedInviteUrl('');
    try {
       const res = await authFetch('/api/admin/invite', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ role: inviteRole,  })
       });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);
       setGeneratedInviteUrl(data.inviteUrl);
    } catch (err: any) {
       alert('초대 링크 생성 실패: ' + err.message);
    } finally {
       setIsGeneratingInvite(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!generatedInviteUrl) return;
    await navigator.clipboard.writeText(generatedInviteUrl);
    setCopiedInviteUrl(true);
    setTimeout(() => setCopiedInviteUrl(false), 2500);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processExcelFile(e.target.files[0]);
    }
  };

  const runAlgorithm = async () => {
    setIsRunningAlgo(true);
    setAlgoResult(null);
    try {
      const res = await authFetch('/api/assign', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      

      setAlgoResult({ count: data.assignedCount, mode: data.mode });
    } catch (err: any) {
      alert(`배정 실패: ${err.message}`);
    } finally {
      setIsRunningAlgo(false);
    }
  };

  const processExcelFile = async (file: File) => {
    const isConfirmed = window.confirm('새로운 엑셀(마이그레이션)을 업로드하면 기존 DB의 업무(Tasks) 목록이 모두 지워지고 이 엑셀 파일의 데이터로 덮어씌워집니다. 진행하시겠습니까?');
    if (!isConfirmed) return;

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const data = await parseLegacyExcelData(file);

      
      if (data.tasks.length > 0) {
        const { error: deleteError } = await supabase.from('tasks').delete().gte('intensity', -1);
        if (deleteError) throw new Error('기존 업무 테이터를 삭제하는 도중 권한 오류가 발생했습니다.');

        const mappedTasks = data.tasks.map(t => ({
          title: t.title, intensity: t.intensity, start_hour: t.startHour, end_hour: t.endHour,
          set_id: t.setId || null, color: t.color || 'bg-gray-100 text-gray-800'
        }));
        
        const { error: taskError } = await supabase.from('tasks').insert(mappedTasks);
        if (taskError) throw new Error('새로운 업무 데이터를 저장하는 중 오류가 발생했습니다.'); 
      }

      setTimeout(() => {
        setIsUploading(false);
        setUploadSuccess(true);
      }, 1000);
    } catch (error: any) {
      alert(error.message || '엑셀 파싱 중 오류가 발생했습니다.');
      setIsUploading(false);
    }
  };

  if (isAdmin === null) return (
     <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 flex border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
     </div>
  );

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">대표 업무 관리</h2>
        <p className="text-xs text-gray-500 mt-1">이 페이지는 대표 및 마스터 권한을 가진 계정에게만 표시됩니다.</p>
      </div>

      {/* Task DB Access for Admin */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4">
         <button onClick={() => setIsTableModalOpen(true)} className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors text-left text-sm font-bold text-gray-800">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileSpreadsheet size={20}/></div>
               <div>
                 사내 전체 업무 DB 조회
                 <span className="block text-xs font-normal text-gray-400 mt-0.5">등록된 모든 업무({allTasks.length}건)를 테이블로 확인하고 관리합니다.</span>
               </div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
               <span className="text-xl leading-none">›</span>
            </div>
         </button>
      </section>

      {/* Schedule Access for Admin */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6">
         <button onClick={() => setIsAllSchedulesModalOpen(true)} className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors text-left text-sm font-bold text-gray-800">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><CalendarDays size={20}/></div>
               <div>
                 직원 전체 일정 조회
                 <span className="block text-xs font-normal text-gray-400 mt-0.5">날짜별 모든 직원의 업무 일정을 확인합니다.</span>
               </div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
               <span className="text-xl leading-none">›</span>
            </div>
         </button>
      </section>

      {/* Admin: Invite Link Generator */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-violet-200/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
        <div className="flex items-center gap-2 mb-4">
          <Link2 size={18} className="text-violet-500" />
          <h3 className="text-sm font-bold text-gray-800">직원 초대 링크 생성</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          역할을 선택하고 초대 링크를 생성하세요. 이 링크는 <span className="font-bold text-violet-600">1회</span>만 사용 가능하며, 직접 전달하세요.
        </p>
        <div className="flex gap-2 mb-3">
          {(['Worker','Master','Admin'] as const).map(r => (
            <button key={r} onClick={() => setInviteRole(r)} className={clsx(
              'flex-1 py-2 text-xs font-bold rounded-xl border transition-colors',
              inviteRole === r
                ? r === 'Admin' ? 'bg-rose-500 text-white border-rose-600'
                  : r === 'Master' ? 'bg-amber-400 text-white border-amber-500'
                  : 'bg-indigo-600 text-white border-indigo-700'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            )}>
              {r === 'Worker' ? '업무 직원용' : r === 'Admin' ? '대표 계정용' : '마스터 계정용'}
            </button>
          ))}
        </div>
        <button
          onClick={handleGenerateInvite}
          disabled={isGeneratingInvite}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
        >
          {isGeneratingInvite ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
          초대 링크 생성
        </button>

        {generatedInviteUrl && (
          <div className="mt-4 p-3 bg-violet-50 rounded-xl border border-violet-100">
            <p className="text-[10px] font-bold text-violet-600 mb-2 uppercase tracking-wider">생성된 초대 링크 ({inviteRole})</p>
            <div className="flex gap-2 items-center">
              <p className="flex-1 text-xs text-gray-700 truncate font-mono">{generatedInviteUrl}</p>
              <button
                onClick={handleCopyInviteUrl}
                className={clsx('shrink-0 p-2 rounded-lg transition-colors', copiedInviteUrl ? 'bg-green-100 text-green-600' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200')}
                title="복사"
              >
                {copiedInviteUrl ? <Check size={16}/> : <Copy size={16}/>}
              </button>
            </div>
            <p className="text-[10px] text-violet-400 mt-2">⚠ 이 링크는 1회만 사용 가능합니다. 카카오톡 또는 메신저로 직접 전달하세요.</p>
          </div>
        )}
      </section>

      {/* Admin Settings: Task Management & Emergency */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-200/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
        
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={18} className="text-emerald-500" />
          <h3 className="text-sm font-bold text-gray-800">업무 할당 및 배포 도구</h3>
        </div>
        
        <div className="space-y-3">
           <button onClick={() => setIsTaskModalOpen(true)} className="w-full py-3.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 flex justify-center items-center gap-2 transition-colors shadow-sm">
             <PlusCircle size={18} className="text-gray-500" /> 1. 풀(Pool)에 새 업무 추가
           </button>
           <button onClick={() => setIsEmergencyModalOpen(true)} className="w-full py-3.5 bg-rose-600 border border-rose-700 rounded-xl text-sm font-bold text-white hover:bg-rose-700 flex justify-center items-center gap-2 transition-colors shadow-sm">
             <AlertCircle size={18} /> 2. 일회성 긴급 업무 생성 및 강제 배정
           </button>
        </div>
      </section>

      {/* Admin Settings: Run Algorithm */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-200/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-indigo-500" />
            <h3 className="text-sm font-bold text-gray-800">일일 배정 무작위 돌리기 (v3.0)</h3>
          </div>
          {algoResult && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-bold">
              방금 완료됨
            </span>
          )}
        </div>
        
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          저장된 직원 목록과 업무 규칙(우선순위, 불가능 인원 등)을 종합하여 <span className="font-bold text-indigo-600">가장 공평하고 효율적인 업무 배정</span>을 자동으로 실행합니다.
        </p>

        <button 
          onClick={runAlgorithm}
          disabled={isRunningAlgo}
          className="w-full flex justify-center items-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
        >
          {isRunningAlgo ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
          {isRunningAlgo ? '개인별 맞춤 업무 배정 중...' : '자동 업무 배정 시작하기'}
        </button>

        {algoResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs font-semibold text-gray-600 flex justify-between items-center border border-gray-100">
            <div className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-500"/> 할당 성공: {algoResult.count}건</div>
            <span className="text-gray-400">모드: {algoResult.mode}</span>
          </div>
        )}
      </section>

      {/* Admin: User Management */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 size={18} className="text-slate-500" />
          <h3 className="text-sm font-bold text-gray-800">직원 계정 관리 (Pool)</h3>
        </div>
        <p className="text-[10px] text-gray-400 mb-4 italic">잘못 생성되었거나 퇴사한 직원의 계정을 영구 삭제합니다.</p>
        
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
           {allWorkers.length === 0 && <div className="text-center text-xs text-gray-400 py-6">등록된 직원이 없습니다.</div>}
           {allWorkers.map(w => (
             <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-800">{w.name}</div>
                    <div className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">
                      {w.role === 'Admin' ? '대표' : (w.role === 'Master' ? '마스터' : '업무 직원')}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteUser(w.id, w.name)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="계정 삭제"
                >
                  <Trash2 size={16} />
                </button>
             </div>
           ))}
        </div>
      </section>

      {/* Admin Settings: Excel Dropzone */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-amber-200/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400"></div>
        
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={18} className="text-amber-500" />
          <h3 className="text-sm font-bold text-gray-800">관리자 도구 (과거 데이터 마이그레이션)</h3>
        </div>
        
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          기존 엑셀(VBA)에서 사용하던 <span className="font-bold text-gray-700">`누적_데이터.xlsx`</span> 파일을 업로드하여 DB 초기값 점수를 동기화합니다. (과거 데이터 100% 승계)
        </p>

        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={clsx(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-colors relative",
            uploadSuccess ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-indigo-400 bg-gray-50 hover:bg-indigo-50/30"
          )}
        >
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center gap-3">
            {uploadSuccess ? (
              <>
                <CheckCircle2 size={36} className="text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-700">업로드 및 동기화 완료!</p>
                  <p className="text-xs text-green-600 mt-1">파싱된 데이터가 콘솔(F12)에 노출됩니다.</p>
                </div>
              </>
            ) : isUploading ? (
              <>
                <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-1"></div>
                <p className="text-sm font-bold text-indigo-700">데이터 파싱 중...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-1 text-gray-500">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">Excel 파일을 여기로 드래그 하거나 클릭하세요</p>
                  <p className="text-[10px] text-gray-400 mt-1">지원 형식: .xlsx, .xls</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Modals for Admin Actions */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative max-h-[90vh] overflow-y-auto">
             <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
             <h3 className="font-bold text-xl mb-1 text-gray-900">1. 신규 업무(타입) 데이터베이스 추가</h3>
             <p className="text-xs text-gray-500 mb-4">엑셀처럼 쓸 수 있는 '풀(Pool)'에 업무 종류를 등록합니다.</p>
             <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">업무명</label>
                  <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-indigo-500" placeholder="예: 창고 정리" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-500 mb-1">기본 강도(0~3)</label>
                     <input type="number" step="0.5" value={newTask.intensity} onChange={e => setNewTask({...newTask, intensity: Number(e.target.value)})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-500 mb-1">라벨 컬러</label>
                     <select value={newTask.color} onChange={e => setNewTask({...newTask, color: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 focus:outline-none focus:border-indigo-500 font-bold">
                         <option value="bg-emerald-100 text-emerald-900 border-emerald-200">🥗 에메랄드</option>
                         <option value="bg-cyan-100 text-cyan-900 border-cyan-200">💎 시안</option>
                         <option value="bg-pink-100 text-pink-900 border-pink-200">🌸 핑크</option>
                         <option value="bg-amber-100 text-amber-900 border-amber-200">🍯 앰버</option>
                         <option value="bg-violet-100 text-violet-900 border-violet-200">🍇 퍼플</option>
                         <option value="bg-slate-100 text-slate-900 border-slate-200">⌨️ 그레이</option>
                     </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-indigo-500 mb-1">시작(시)</label>
                     <input type="number" step="1" value={newTask.startHour} onChange={e => setNewTask({...newTask, startHour: Number(e.target.value)})} className="w-full border border-gray-200 bg-indigo-50 rounded-lg p-2 text-indigo-700 font-bold focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-indigo-500 mb-1">종료(시)</label>
                     <input type="number" step="1" value={newTask.endHour} onChange={e => setNewTask({...newTask, endHour: Number(e.target.value)})} className="w-full border border-gray-200 bg-indigo-50 rounded-lg p-2 text-indigo-700 font-bold focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">기본 위치/장소</label>
                  <input type="text" value={newTask.location} onChange={e => setNewTask({...newTask, location: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-indigo-500" placeholder="예: A구역 제2창고" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">대상 요일 지정 (선택 안하면 매일 배정 대상에 포함됨)</label>
                  <div className="flex flex-wrap gap-2">
                     {['월','화','수','목','금','토','일'].map(d => (
                        <button key={d} onClick={() => toggleDay(d)} className={`px-2.5 py-1 text-xs font-bold rounded-full border transition-colors ${newTask.days.includes(d) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                           {d}
                        </button>
                     ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">인력 권한 설정 (선택 사항)</label>
                  <p className="text-[10px] text-gray-400 mb-2">기본 상태: 권한 없음(일반 배정). 한 직원당 하나의 속성만 부여할 수 있습니다.</p>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border border-gray-100 p-2 rounded-lg bg-gray-50">
                     {allWorkers.length === 0 && <div className="text-center text-xs text-gray-400 py-4">등록된 직원이 없습니다.</div>}
                     {allWorkers.map(w => {
                        const isPref = newTask.preferred_users.includes(w.id);
                        const isDisl = newTask.disliked_users.includes(w.id);
                        const isExcl = newTask.excluded_users.includes(w.id);
                        
                        return (
                          <div key={w.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                            <span className="font-bold text-gray-700">{w.name}</span>
                            <div className="flex gap-1">
                               <button 
                                 onClick={() => toggleWorkerCategory(w.id, 'preferred_users')} 
                                 className={clsx("px-2.5 py-1.5 rounded-md font-bold transition-all", isPref ? "bg-indigo-500 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                               >
                                 우선인력
                               </button>
                               <button 
                                 onClick={() => toggleWorkerCategory(w.id, 'disliked_users')} 
                                 className={clsx("px-2.5 py-1.5 rounded-md font-bold transition-all", isDisl ? "bg-amber-500 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                               >
                                 후순위
                               </button>
                               <button 
                                 onClick={() => toggleWorkerCategory(w.id, 'excluded_users')} 
                                 className={clsx("px-2.5 py-1.5 rounded-md font-bold transition-all", isExcl ? "bg-red-500 text-white shadow" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                               >
                                 불가능
                               </button>
                            </div>
                          </div>
                        );
                     })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">간단한 설명</label>
                  <textarea rows={2} value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 placeholder:text-gray-300 resize-none focus:outline-none focus:border-indigo-500" placeholder="업무 지침 작성..." />
                </div>
                <button onClick={handleCreateTask} className="w-full mt-2 py-3 bg-gray-900 text-white rounded-xl font-bold">풀(Pool)에 추가하기</button>
             </div>
          </div>
        </div>
      )}

      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative max-h-[90vh] overflow-y-auto">
             <button onClick={() => setIsEmergencyModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
             <h3 className="font-bold text-xl mb-1 text-gray-900">🚨 2. 일회성 다이렉트 긴급 배정</h3>
             <p className="text-xs text-gray-500 mb-4">임의의 업무를 직접 적어서 잉여 직원(최저 부하량)에게 즉시 할당합니다.</p>
             <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">갑자기 떠오른 업무명</label>
                  <input type="text" value={emergencyConfig.title} onChange={e => setEmergencyConfig({...emergencyConfig, title: e.target.value})} className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-rose-500" placeholder="직접 입력하세요..." />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-gray-800 mb-1">업무 강도(부하량)</label>
                     <input type="number" step="0.5" value={emergencyConfig.intensity} onChange={e => setEmergencyConfig({...emergencyConfig, intensity: Number(e.target.value)})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 focus:outline-none focus:border-rose-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-semibold text-gray-500 mb-1">위치/설명(옵션)</label>
                     <input type="text" value={emergencyConfig.location} onChange={e => setEmergencyConfig({...emergencyConfig, location: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-rose-500" placeholder="장소 입력" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-red-500 mb-1">수행 시작(시)</label>
                     <input type="number" step="1" value={emergencyConfig.startHour} onChange={e => setEmergencyConfig({...emergencyConfig, startHour: Number(e.target.value)})} className="w-full border border-gray-200 bg-rose-50 rounded-lg p-2 text-red-700 font-bold focus:outline-none focus:border-rose-500" />
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-bold text-red-500 mb-1">수행 종료(시)</label>
                     <input type="number" step="1" value={emergencyConfig.endHour} onChange={e => setEmergencyConfig({...emergencyConfig, endHour: Number(e.target.value)})} className="w-full border border-gray-200 bg-rose-50 rounded-lg p-2 text-red-700 font-bold focus:outline-none focus:border-rose-500" />
                  </div>
                </div>
                
                <div>
                  <textarea rows={2} value={emergencyConfig.description} onChange={e => setEmergencyConfig({...emergencyConfig, description: e.target.value})} className="w-full border border-gray-200 bg-white rounded-lg p-2 text-gray-900 text-xs placeholder:text-gray-300 focus:outline-none focus:border-rose-500" placeholder="해당 작업 시 주의사항이나 디테일한 설명을 적어주세요." />
                </div>
                <button onClick={handleEmergencyAssign} className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-indigo-200 transition-colors">
                  <Zap size={16} /> 실시간 최적의 인원 스캔 및 배정!
                </button>
             </div>
          </div>
        </div>
      )}

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
                          ? 'bg-blue-600 text-white shadow-sm' 
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
                           <div 
                             key={t.id} 
                             onClick={() => setEditingTaskWorkers(t)}
                             className="flex flex-col gap-2 p-3 bg-white hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer rounded-xl border border-gray-100 shadow-sm transition-all w-full text-left"
                           >
                             <div className="flex justify-between items-start">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.color || 'bg-gray-200 text-gray-700'}`}>
                                   강도 {t.intensity}
                                </span>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                   <button onClick={() => handleDeleteTask(t.id)} className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md hover:bg-red-100 border border-red-100">
                                     삭제
                                   </button>
                                </div>
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
                                {/* 인력 정보 뱃지 */}
                                {(t.preferred_users?.length > 0 || t.disliked_users?.length > 0 || t.excluded_users?.length > 0) && (
                                  <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                                    {t.preferred_users?.map((id:string) => {
                                       const w = allWorkers.find(u => u.id === id);
                                       return w ? <span key={`p-${id}`} className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded">{w.name} (우선)</span> : null;
                                    })}
                                    {t.disliked_users?.map((id:string) => {
                                       const w = allWorkers.find(u => u.id === id);
                                       return w ? <span key={`d-${id}`} className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">{w.name} (후순위)</span> : null;
                                    })}
                                    {t.excluded_users?.map((id:string) => {
                                       const w = allWorkers.find(u => u.id === id);
                                       return w ? <span key={`e-${id}`} className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded">{w.name} (불가능)</span> : null;
                                    })}
                                  </div>
                                )}
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

      {isAllSchedulesModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col p-4 bg-gray-50/95 backdrop-blur-md">
           <div className="flex justify-between items-center mb-4 mt-8 px-2">
              <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2"><CalendarDays size={24} className="text-purple-600"/> 직원 전체 일정 조회</h3>
              <button onClick={() => setIsAllSchedulesModalOpen(false)} className="p-2 rounded-full bg-white text-gray-600 shadow-sm"><X size={20}/></button>
           </div>
           
           <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                 <label className="text-sm font-bold text-gray-700">조회 날짜</label>
                 <input 
                   type="date" 
                   value={scheduleDate} 
                   onChange={(e) => setScheduleDate(e.target.value)} 
                   className="border border-gray-300 rounded-md p-1.5 text-sm font-bold text-gray-900 bg-white focus:outline-indigo-500"
                 />
                 {isLoadingSchedules && <RefreshCw size={14} className="text-gray-400 animate-spin ml-2" />}
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-6">
                 {allSchedulesData.length === 0 && !isLoadingSchedules && (
                   <div className="py-10 text-center text-gray-400 text-sm">해당 날짜에 등록된 일정이 없습니다.</div>
                 )}
                 {allSchedulesData.map((data, idx) => (
                    <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                       <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                                {data.user.name.charAt(0)}
                             </div>
                             {data.user.name}
                          </div>
                          <div className="text-xs font-semibold text-gray-500">배정된 업무 {data.schedules.length}건</div>
                       </div>
                       <div className="p-3 space-y-2">
                          {data.schedules.length === 0 ? (
                             <p className="text-xs text-center text-gray-400 py-3">업무가 없습니다.</p>
                          ) : (
                             data.schedules.map((schedule: any) => (
                                 <div key={schedule.id} className="flex flex-col gap-1 p-3 bg-white border border-gray-100 rounded-lg shadow-sm relative">
                                    {editingScheduleId === schedule.id ? (
                                      <div className="flex flex-col gap-2 relative pointer-events-auto">
                                        <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-md">
                                          <div className="flex gap-2 w-full">
                                            <div className="flex flex-col flex-1">
                                              <label className="text-[10px] text-gray-500 font-bold mb-0.5">수행 시작(시)</label>
                                              <input type="number" step="1" value={editScheduleData.startHour} onChange={e => setEditScheduleData({...editScheduleData, startHour: Number(e.target.value)})} className="w-full border border-gray-200 rounded p-1 text-xs" />
                                            </div>
                                            <div className="flex flex-col flex-1">
                                              <label className="text-[10px] text-gray-500 font-bold mb-0.5">수행 종료(시)</label>
                                              <input type="number" step="1" value={editScheduleData.endHour} onChange={e => setEditScheduleData({...editScheduleData, endHour: Number(e.target.value)})} className="w-full border border-gray-200 rounded p-1 text-xs" />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col">
                                          <label className="text-[10px] text-gray-500 font-bold mb-0.5">내용 및 메모</label>
                                          <input type="text" value={editScheduleData.note} onChange={e => setEditScheduleData({...editScheduleData, note: e.target.value})} className="w-full border border-gray-200 rounded p-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none" placeholder="비고 작성 (옵션)" />
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                          <button onClick={() => setEditingScheduleId(null)} className="flex-1 text-xs bg-gray-200 text-gray-700 font-bold py-1.5 rounded-md transition-colors hover:bg-gray-300">취소</button>
                                          <button onClick={handleSaveScheduleEdit} className="flex-1 text-xs bg-indigo-600 text-white font-bold py-1.5 rounded-md transition-colors hover:bg-indigo-700 shadow-sm">수정 저장하기</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex justify-between items-start">
                                           {schedule.tasks ? (
                                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${schedule.tasks.color || 'bg-gray-100 text-gray-700'}`}>
                                               {schedule.start_hour}시 ~ {schedule.end_hour}시
                                             </span>
                                           ) : (
                                             <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-center">
                                               {schedule.start_hour}시 ~ {schedule.end_hour}시
                                             </span>
                                           )}
                                           <div className="flex gap-1 shrink-0 ml-2">
                                              <button onClick={() => handleEditScheduleClick(schedule)} className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 flex items-center justify-center py-1 rounded-md hover:bg-blue-100 border border-blue-100 transition-colors">
                                                수정
                                              </button>
                                              <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-[10px] text-red-600 font-bold bg-red-50 px-2 flex items-center justify-center py-1 rounded-md hover:bg-red-100 border border-red-100 transition-colors">
                                                삭제
                                              </button>
                                           </div>
                                        </div>
                                        <div className="font-bold text-gray-800 text-sm mt-1.5">
                                           {schedule.tasks ? schedule.tasks.title : '예외/휴가/기타 일정'}
                                        </div>
                                        {schedule.tasks?.location && <div className="text-[10px] text-gray-500 mt-1">📍 {schedule.tasks.location}</div>}
                                        {schedule.note && <div className="text-[10px] text-gray-600 mt-1 break-all bg-yellow-50/50 p-1.5 border border-yellow-100 rounded-md">📝 {schedule.note}</div>}
                                      </>
                                    )}
                                 </div>
                             ))
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Editing Task Workers Modal */}
      {editingTaskWorkers && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative max-h-[90vh] overflow-y-auto shadow-2xl ring-1 ring-gray-900/10">
             <button onClick={() => setEditingTaskWorkers(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-colors"><X size={20}/></button>
             <h3 className="font-bold text-xl mb-1 text-indigo-900 border-b pb-3 border-gray-100">직원 배정 권한 (Pool)</h3>
             <div className="bg-indigo-50 p-3 rounded-lg my-3 border border-indigo-100">
               <p className="text-sm font-bold text-indigo-700">📌 {editingTaskWorkers.title}</p>
             </div>
             <p className="text-xs text-gray-500 mb-4 ml-1 italic">해당 업무에만 적용되는 직원 속성(대표, 업무)을 지정합니다.</p>
             
             <div className="flex flex-col gap-2 max-h-80 overflow-y-auto border border-gray-200 p-2 rounded-xl bg-gray-50 shadow-inner">
                {allWorkers.length === 0 && <div className="text-center text-xs text-gray-400 py-6">지정 가능한 직원이 없습니다.</div>}
                {allWorkers.map(w => {
                   const isPref = (editingTaskWorkers.preferred_users || []).includes(w.id);
                   const isDisl = (editingTaskWorkers.disliked_users || []).includes(w.id);
                   const isExcl = (editingTaskWorkers.excluded_users || []).includes(w.id);
                   
                   return (
                     <div key={w.id} className={clsx("flex flex-col gap-2 text-xs bg-white p-3 rounded-xl border shadow-sm", w.id === currentUser?.id ? "border-indigo-400 bg-indigo-50/30" : "border-gray-200")}>
                       <div className="flex justify-between items-center px-1">
                         <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                           {w.name}
                           {w.id === currentUser?.id && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">나</span>}
                         </span>
                         <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 uppercase font-bold">
                           {w.role === 'Admin' ? '대표' : (w.role === 'Master' ? '마스터' : '업무')}
                         </span>
                       </div>
                       <div className="flex gap-1">
                          <button 
                            onClick={() => toggleEditingWorkerCategory(w.id, 'preferred_users')} 
                            className={clsx("flex-1 py-2 rounded-lg font-bold transition-all border", isPref ? "bg-indigo-600 text-white border-transparent shadow-md" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}
                          >
                            우선
                          </button>
                          <button 
                            onClick={() => toggleEditingWorkerCategory(w.id, 'disliked_users')} 
                            className={clsx("flex-1 py-2 rounded-lg font-bold transition-all border", isDisl ? "bg-amber-500 text-white border-transparent shadow-md" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}
                          >
                            후순위
                          </button>
                          <button 
                            onClick={() => toggleEditingWorkerCategory(w.id, 'excluded_users')} 
                            className={clsx("flex-1 py-2 rounded-lg font-bold transition-all border", isExcl ? "bg-red-500 text-white border-transparent shadow-md" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50")}
                          >
                            불가능
                          </button>
                       </div>
                     </div>
                   );
                })}
             </div>
             
             <div className="mt-5 flex gap-3">
               <button onClick={() => setEditingTaskWorkers(null)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-colors">취소</button>
               <button onClick={handleSaveTaskWorkers} className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-colors">설정 저장 후 닫기</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
