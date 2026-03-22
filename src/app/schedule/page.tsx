'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Send, CalendarPlus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/authClient';

// 유틸: 시간 문자열(HH:mm)을 숫자(예: 9.5)로 변환
function timeStringToNum(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}

// 달력 생성을 위한 유틸
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function SchedulePage() {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [reason, setReason] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // 캘린더 관련 상태
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mySchedules, setMySchedules] = useState<any[]>([]);
  
  // 선택한 날짜 관련 상태
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [selectedDateSchedules, setSelectedDateSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedDateObj) return;
    const daySchedules = mySchedules.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getDate() === selectedDateObj.getDate() && sDate.getMonth() === selectedDateObj.getMonth() && sDate.getFullYear() === selectedDateObj.getFullYear();
    });
    setSelectedDateSchedules(daySchedules);
  }, [mySchedules, selectedDateObj]);

  // 접속한 유저 확인
  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (p) setCurrentUser(p);
      }
    }
    loadUser();
  }, []);

  // 유저의 한 달 치 스케줄 불러오기
  const fetchMonthSchedules = async (year: number, month: number) => {
    if (!currentUser) return;
    
    // 예: 2024-03-01 to 2024-04-01
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = getDaysInMonth(year, month);
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data } = await supabase
      .from('schedules')
      .select('*, tasks(title, color)')
      .eq('user_id', currentUser.id)
      .gte('date', startDate)
      .lte('date', endDate);

    if (data) {
      setMySchedules(data);
    }
  };

  useEffect(() => {
    if (currentUser) {
       fetchMonthSchedules(currentDate.getFullYear(), currentDate.getMonth());
    }
  }, [currentUser, currentDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!currentUser) {
       alert("로그인 후 이용 가능합니다.");
       return;
    }
    setIsSubmitting(true);
    
    try {
      const startH = timeStringToNum(startTime);
      const endH = timeStringToNum(endTime);
      
      if(startH >= endH) {
         throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
      }

      // task_id 없이 삽입
      const { error } = await supabase.from('schedules').insert({
        user_id: currentUser.id,
        date: date,
        start_hour: startH,
        end_hour: endH,
        note: reason || '개인 외출/휴무'
      });

      if (error) throw error;

      alert(`[저장 완료] 성공적으로 등록되었습니다.`);
      setDate(''); setReason('');
      fetchMonthSchedules(currentDate.getFullYear(), currentDate.getMonth());
      // 만약 등록한 날짜가 현재 보고있는 날짜라면 갱신 효과
    } catch(err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDayClick = (dateNum: number | null) => {
    if (!dateNum) return;
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), dateNum);
    setSelectedDateObj(d);
  };

  const handleDeleteHoliday = async (scheduleId: string) => {
    if(!confirm("해당 휴가/일정을 정말 취소하시겠습니까?")) return;
    try {
       const res = await authFetch('/api/schedule/my', {
         method: 'DELETE',
         body: JSON.stringify({ scheduleId })
       });
       const data = await res.json();
       if(!res.ok) throw new Error(data.error);
       alert("일정이 취소되었습니다.");
       fetchMonthSchedules(currentDate.getFullYear(), currentDate.getMonth());
    } catch(e:any) {
       alert(e.message);
    }
  };


  // 캘린더 그리기 로직
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <CalendarPlus className="text-indigo-600" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">일정 / 휴가 등록</h2>
            <p className="text-xs text-gray-500 mt-0.5">시간 단위의 외출이나 반차를 등록하세요.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar size={16} className="text-gray-400" /> 날짜 선택
            </label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-gray-800"
              required
            />
          </div>

          {/* Time Picker */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Clock size={16} className="text-gray-400" /> 시작 시간
              </label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-gray-800"
                required
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Clock size={16} className="text-gray-400" /> 종료 시간
              </label>
              <input 
                type="time" 
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-gray-800"
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText size={16} className="text-gray-400" /> 상세 사유
            </label>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 병원 진료로 인한 오후 2시간 외출"
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-gray-800 resize-none"
              required
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={18} /> {isSubmitting ? '등록 중...' : '일정 등록하기'}
            </button>
          </div>
        </form>
      </section>

      {/* Guide Note */}
      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex gap-3 items-start">
        <div className="text-indigo-600 bg-indigo-100 p-1 rounded-full shrink-0">
          <Clock size={16} />
        </div>
        <p className="text-xs text-indigo-900/80 leading-relaxed font-medium mt-0.5">
          시간 단위 블록은 자동 배정 시 <span className="font-bold text-indigo-600">제외 시간</span>으로 처리되며, 해당 시간 외의 남은 시간에만 업무가 공평하게 재분배됩니다.
        </p>
      </div>

      {/* Monthly Calendar View */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-6">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
           <div>
             <h2 className="text-xl font-bold text-gray-900">내 일정 달력 (월간)</h2>
             <p className="text-xs text-gray-500 mt-1">나의 스케줄과 휴가 내역을 한눈에 파악하세요.</p>
           </div>
           <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
              <button onClick={prevMonth} className="text-gray-500 hover:text-gray-800 transition"><ChevronLeft size={18}/></button>
              <span className="font-bold text-sm w-24 text-center text-gray-900">{year}년 {month + 1}월</span>
              <button onClick={nextMonth} className="text-gray-500 hover:text-gray-800 transition"><ChevronRight size={18}/></button>
           </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
             <div key={d} className={`text-xs font-bold ${d==='일'?'text-red-500': d==='토'?'text-blue-500':'text-gray-500'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {calendarDays.map((dateNum, idx) => {
             const isSun = idx % 7 === 0;
             const isSat = idx % 7 === 6;
             const textCol = isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800';
             
             // 이 날짜에 해당하는 내 일정 찾기
             const daySchedules = dateNum ? mySchedules.filter(s => {
                const sDate = new Date(s.date);
                return sDate.getDate() === dateNum && sDate.getMonth() === month && sDate.getFullYear() === year;
             }) : [];

             return (
               <div key={idx} onClick={() => handleDayClick(dateNum)} className={`min-h-[70px] border border-gray-100 rounded-lg p-1.5 relative ${!dateNum ? 'bg-gray-50/50 border-dashed' : 'bg-white hover:border-indigo-200 transition-colors cursor-pointer group hover:bg-indigo-50/10'}`}>
                 {dateNum && (
                    <>
                      <span className={`text-[11px] font-bold ${textCol}`}>{dateNum}</span>
                      <div className="mt-1 space-y-1 flex flex-col items-center">
                        {daySchedules.map((s, i) => {
                           // 휴가/블록 등은 task 정보가 없음
                           const isBlock = !s.task_id; 
                           const titleStr = isBlock ? (s.note || '휴가') : (s.tasks?.title || '업무');
                           
                           return (
                             <div key={i} className={`w-full max-w-full truncate text-[10px] leading-tight px-1 py-0.5 rounded-sm overflow-hidden font-medium ${isBlock ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`} title={titleStr}>
                               {titleStr.length > 5 ? titleStr.slice(0, 5)+'..' : titleStr}
                             </div>
                           );
                        })}
                      </div>
                    </>
                 )}
               </div>
             )
            })}
          </div>
        </section>
        
        {/* 선택한 날짜 상세 일정 패널 */}
        {selectedDateObj && (
          <section className="bg-white p-6 rounded-3xl shadow-lg border-2 border-indigo-100 mt-6 relative animate-in slide-in-from-bottom-4 duration-300">
             <button onClick={() => setSelectedDateObj(null)} className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition">
                <X size={20} />
             </button>
             <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                {selectedDateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} 상세 일정
             </h3>
             
             {selectedDateSchedules.length === 0 ? (
               <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed text-sm">
                 이 날짜에는 등록된 일정이 없습니다.
               </div>
             ) : (
               <div className="space-y-3">
                 {selectedDateSchedules.map((s, idx) => {
                    const isBlock = !s.task_id;
                    const titleStr = isBlock ? (s.note || '휴가/개인일정') : (s.tasks?.title || '업무');
                    return (
                       <div key={idx} className={`p-4 rounded-xl border flex justify-between items-center ${isBlock ? 'bg-orange-50/50 border-orange-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isBlock ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                 {s.start_hour}시 ~ {s.end_hour}시
                               </span>
                               <span className="font-bold text-gray-900 text-sm">{titleStr}</span>
                            </div>
                            {!isBlock && s.tasks?.color && (
                                <p className="text-xs text-gray-500 mt-1">이 일정은 업무이므로 임의로 취소할 수 없습니다.</p>
                            )}
                          </div>
                          {isBlock && (
                             <button onClick={() => handleDeleteHoliday(s.id)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-semibold text-xs rounded-lg transition-colors border border-red-100">
                                <Trash2 size={14} /> 취소하기
                             </button>
                          )}
                       </div>
                    )
                 })}
               </div>
             )}
          </section>
        )}
      </div>
    );
  }
