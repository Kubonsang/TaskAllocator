'use client';

import { useRef, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, BarChart2, CalendarDays } from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { DUMMY_USERS } from '@/lib/dummyData';

// 차트 예쁘게 그리기 위한 컬러 (Top 3 강조)
const colors = ['#4f46e5', '#818cf8', '#a5b4fc', '#e0e7ff'];

interface StatData {
  name: string;
  score: number;
  hours: number;
}

export default function StatsPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<StatData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 날짜 범위 지정 필터 (기본값 이번달 1일 ~ 오늘)
  const [startDate, setStartDate] = useState(() => {
     const d = new Date();
     d.setDate(1);
     return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
     return new Date().toISOString().split('T')[0];
  });

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // 1. 모든 프로필 이름 가져오기 (0점 방어용)
      const { data: profiles } = await supabase.from('profiles').select('id, name, role');
      
      const stats: Record<string, { score: number; hours: number }> = {};
      if (profiles && profiles.length > 0) {
        profiles.filter(p => p.role !== 'Master').forEach((p: any) => {
          stats[p.name] = { score: 0, hours: 0 };
        });
        
        // 2. 해당 기간의 스케줄 가져오면서 tasks 정보도 포함
        const { data: schedules } = await supabase
          .from('schedules')
          .select('user_id, start_hour, end_hour, profiles!inner(name), tasks(intensity)')
          .gte('date', startDate)
          .lte('date', endDate)
          .not('task_id', 'is', null);

        if (schedules) {
          schedules.forEach((s: any) => {
            const name = s.profiles.name;
            if (stats[name]) {
              const hours = Number(s.end_hour) - Number(s.start_hour);
              const intensity = Number(s.tasks?.intensity || 0);
              stats[name].hours += hours;
              stats[name].score += (hours * intensity);
            }
          });
        }

        const formatted = Object.entries(stats).map(([name, val]) => ({
          name, 
          score: Math.round(val.score * 10) / 10, 
          hours: Math.round(val.hours * 10) / 10
        })).sort((a, b) => b.score - a.score);
        
        setData(formatted);
      } else {
        const dummyFormatted = DUMMY_USERS.map(u => ({
          name: u.name,
          score: Number(u.totalScore),
          hours: Number(u.totalScore) / 2 // 임의의 더미 시간
        })).sort((a, b) => b.score - a.score);
        setData(dummyFormatted);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const handleDownloadImage = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    
    try {
      const generationMeta = {
        source: 'Auto-Assigner Pro (AI Algorithm v3.0)',
        timestamp: new Date().toISOString()
      };

      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true, // 외부 이미지 대비
        onclone: (clonedDoc, element) => {
          // 복제된 엘리먼트 내부의 특정 위치에 워터마크 삽입
          const watermark = clonedDoc.createElement('div');
          watermark.innerText = `AI Generated: ${generationMeta.source} | ${generationMeta.timestamp}`;
          watermark.style.position = 'absolute';
          watermark.style.bottom = '10px';
          watermark.style.right = '10px';
          watermark.style.fontSize = '8px';
          watermark.style.color = 'rgba(0,0,0,0.05)';
          watermark.style.zIndex = '9999';
          element.appendChild(watermark);
        }
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `업무_통계_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error('Image export failed:', error);
      alert('이미지 추출 중 오류가 발생했습니다. 브라우저 설정을 확인해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-6 px-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
              <BarChart2 className="text-indigo-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">직원 업무 분석</h2>
              <p className="text-xs text-gray-500 mt-0.5">배정된 업무 시간 및 기여 포인트</p>
            </div>
          </div>
          <button 
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 px-3 py-2.5 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Download size={14} /> {isExporting ? '저장 중...' : '이미지 저장'}
          </button>
        </div>

        {/* Date Filter */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-8">
          <div className="col-span-2 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            <CalendarDays size={14} className="text-gray-300"/> 통계 조회 기간
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400">FROM</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full pl-12 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400">TO</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Chart Area to Export */}
        <div ref={chartRef} className="p-4 bg-white rounded-2xl border border-gray-50 shadow-inner">
          <div className="mb-8 text-center bg-gray-50/50 py-4 rounded-2xl border border-dashed border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 tracking-tight">직원별 통합 기여 지표</h3>
            <p className="text-[10px] font-medium text-gray-400 mt-1.5 leading-none">조회 범위: {startDate} ~ {endDate}</p>
          </div>
          
          <div className="h-[400px] w-full mt-4">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-full gap-3">
                 <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                 <p className="text-xs font-bold text-indigo-400 animate-pulse">데이터 로드 중...</p>
              </div>
            ) : data.length === 0 ? (
               <div className="flex justify-center items-center h-full text-gray-400 text-sm italic">
                 해당 기간에 배정된 업무 데이터가 없습니다.
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" horizontal={true} vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={50}
                    tick={{ fontSize: 13, fill: '#1f2937', fontWeight: 800 }} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f9fafb', radius: 12}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-gray-100 animate-in zoom-in-95 duration-200">
                            <p className="text-sm font-black text-gray-900 mb-2.5 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              {d.name}
                            </p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between gap-6 items-center">
                                <span className="text-[11px] font-bold text-gray-400">총 업무 시간</span>
                                <span className="text-xs font-black text-emerald-600">{d.hours}시간</span>
                              </div>
                              <div className="flex justify-between gap-6 items-center">
                                <span className="text-[11px] font-bold text-gray-400">기여 포인트 (Score)</span>
                                <span className="text-xs font-black text-indigo-600">{d.score}점</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={34}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                  {/* 바 옆에 텍스트 직접 표시 */}
                  <Bar dataKey="score">
                     {data.map((entry, index) => {
                        return (
                          <Cell 
                            key={`text-${index}`} 
                            fill="transparent" 
                            strokeWidth={0}
                          />
                        );
                     })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {/* Summary Table for absolute clarity */}
          <div className="mt-10 space-y-2">
            <div className="flex items-center gap-1.5 px-1 mb-3">
              <span className="text-[10px] font-black text-gray-900 uppercase">📊 통합 수치 리스트</span>
              <div className="flex-1 h-px bg-gray-100"></div>
            </div>
            {data.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm transition-transform active:scale-[0.99]">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-black text-indigo-500 shadow-sm border border-indigo-50">
                       {idx + 1}
                    </div>
                    <span className="font-bold text-gray-900">{d.name}</span>
                 </div>
                 <div className="flex items-center gap-5">
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-gray-400 leading-none mb-1">TIME</p>
                       <p className="text-sm font-black text-emerald-600 leading-none">{d.hours}h</p>
                    </div>
                    <div className="text-right border-l border-gray-200 pl-4 min-w-[60px]">
                       <p className="text-[10px] font-bold text-gray-400 leading-none mb-1">SCORE</p>
                       <p className="text-sm font-black text-indigo-600 leading-none">{d.score}pt</p>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
