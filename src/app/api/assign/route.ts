import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assignTasks, AlgorithmUser, AlgorithmTask } from '@/lib/algorithm';
import { DUMMY_USERS, TASK_TYPES } from '@/lib/dummyData';
import { sendPushNotification } from '@/lib/webpush';

// Service role key 사용 → RLS 우회하여 schedules 테이블에 INSERT 가능
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. DB에서 직원과 업무 목록 로드
    // 대표(Admin)도 배정 대상에 포함하기 위해 Worker와 Admin을 모두 가져옴
    let { data: dbProfiles } = await supabaseAdmin.from('profiles').select('*').in('role', ['Worker', 'Admin']);
    let { data: dbTasks }    = await supabaseAdmin.from('tasks').select('*');

    // 오늘 날짜의 휴가/개인 블록 (task_id가 null인 schedules)
    const todayStr = new Date().toISOString().split('T')[0];
    let { data: dbBlocks } = await supabaseAdmin.from('schedules').select('*').eq('date', todayStr).is('task_id', null);

    // 더미 모드 fallback
    let isMockMode = false;
    if (!dbProfiles || dbProfiles.length === 0) {
      dbProfiles = DUMMY_USERS.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        total_score: u.totalScore
      }));
      isMockMode = true;
    }
    if (!dbTasks || dbTasks.length === 0) {
      dbTasks = Object.values(TASK_TYPES).map(t => ({
        id: t.id,
        title: t.title,
        intensity: t.intensity,
        start_hour: t.startHour,
        end_hour: t.endHour,
        set_id: t.setId || null
      }));
    }

    // 2. 알고리즘용 사용자 데이터 포맷 (개인 블록 반영)
    const formatUser = (p: any) => {
      let slots = [{ start: 9.0, end: 18.0 }];
      if (dbBlocks && dbBlocks.length > 0) {
        const userBlocks = dbBlocks.filter((b: any) => b.user_id === p.id);
        for (const block of userBlocks) {
          const newSlots: { start: number; end: number }[] = [];
          const bStart = Number(block.start_hour);
          const bEnd = Number(block.end_hour);
          for (const slot of slots) {
            if (bEnd <= slot.start || bStart >= slot.end) {
              newSlots.push(slot);
            } else {
              if (slot.start < bStart) newSlots.push({ start: slot.start, end: bStart });
              if (slot.end > bEnd)   newSlots.push({ start: bEnd, end: slot.end });
            }
          }
          slots = newSlots;
        }
      }
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        totalScore: Number(p.total_score || 0),
        availableTimeSlots: slots
      };
    };

    const allUsers = dbProfiles.map(formatUser);
    const workerUsers = allUsers.filter(u => u.role === 'Worker');
    const adminUser = allUsers.find(u => u.role === 'Admin');

    // 3. 오늘 요일에 맞는 업무 필터링
    const currentDayStr = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
    const todayTasks = dbTasks.filter((t: any) => {
      if (!t.set_id) return true;
      if (t.set_id === 'EMERGENCY') return false;
      const targetDays = t.set_id.split(',').map((d: string) => d.trim());
      if (targetDays.includes(currentDayStr)) return true;
      if (!targetDays.some((d: string) => ['월','화','수','목','금','토','일'].includes(d))) return true;
      return false;
    });

    const algoTasks: AlgorithmTask[] = todayTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      intensity: Number(t.intensity || 1.0),
      startHour: Number(t.start_hour),
      endHour: Number(t.end_hour),
      setId: t.set_id || '',
      preferredUsers: t.preferred_users || [],
      dislikedUsers: t.disliked_users || [],
      excludedUsers: t.excluded_users || []
    }));

    if (algoTasks.length === 0) {
      return NextResponse.json({ success: false, error: `오늘(${currentDayStr}요일)에 배정할 업무가 없습니다.` }, { status: 400 });
    }

    // --- [알고리즘 개편: 2단계 검증 및 대표 우선 재배정] ---
    
    // 1단계: 시뮬레이션 (일반 직원만 대상으로 배정 시도)
    let finalResults = assignTasks(workerUsers, algoTasks, { fuzzyMargin: 1.5 });
    
    const initialAssignedIds = new Set(finalResults.map(r => r.taskId));
    const initialLeftovers = algoTasks.filter(t => !initialAssignedIds.has(t.id));

    // 2단계: 업무가 남았다면 (비상 상황) -> 대표 우선 순위로 전면 재배정
    if (initialLeftovers.length > 0 && adminUser) {
      console.log(`[Assign] 업무 ${initialLeftovers.length}건 누락 확인. 대표 우선 재배정 모드 진입.`);
      
      let secondPhaseResults: any[] = [];
      let remainingTasks = [...algoTasks];

      // Step A: 대표가 '우선 인력'으로 지정된 업무들만 모아서 대표에게 먼저 선점 배정
      const adminPreferredTasks = remainingTasks.filter(t => t.preferredUsers?.includes(adminUser.id));
      if (adminPreferredTasks.length > 0) {
        const adminStepAResults = assignTasks([adminUser], adminPreferredTasks, { fuzzyMargin: 0 });
        secondPhaseResults = [...secondPhaseResults, ...adminStepAResults];
        
        const stepAIds = new Set(adminStepAResults.map(r => r.taskId));
        remainingTasks = remainingTasks.filter(t => !stepAIds.has(t.id));
      }

      // Step B: 남은 업무들을 일반 직원(Worker)들에게 최적으로 분배
      const workerStepBResults = assignTasks(workerUsers, remainingTasks, { fuzzyMargin: 1.5 });
      secondPhaseResults = [...secondPhaseResults, ...workerStepBResults];
      
      const stepBIds = new Set(workerStepBResults.map(r => r.taskId));
      remainingTasks = remainingTasks.filter(t => !stepBIds.has(t.id));

      // Step C: 그래도 남는 업무가 있다면 최종적으로 다시 대표님이 가져감
      if (remainingTasks.length > 0) {
        const adminStepCResults = assignTasks([adminUser], remainingTasks, { fuzzyMargin: 0 });
        secondPhaseResults = [...secondPhaseResults, ...adminStepCResults];
      }

      finalResults = secondPhaseResults;
    }

    const results = finalResults;

    // 5. 실제 DB에 결과 저장
    if (!isMockMode && results.length > 0) {
      const todayDateStr = new Date().toISOString().split('T')[0];

      const { error: clearError } = await supabaseAdmin
        .from('schedules')
        .delete()
        .eq('date', todayDateStr)
        .not('task_id', 'is', null);

      if (clearError) {
        console.error('[assign] Clear Existing Schedule Error:', clearError);
        return NextResponse.json({ success: false, error: `기존 일정 초기화 실패: ${clearError.message}` }, { status: 500 });
      }

      const schedulesToInsert = results.map(r => {
        const matchingTask = algoTasks.find(t => t.id === r.taskId);
        return {
          user_id: r.userId,
          task_id: r.taskId,
          date: todayDateStr,
          start_hour: matchingTask?.startHour ?? 9.0,
          end_hour:   matchingTask?.endHour   ?? 10.0,
        };
      });

      const { error: scheduleError } = await supabaseAdmin.from('schedules').insert(schedulesToInsert);
      if (scheduleError) {
        console.error('[assign] Schedule Insert Error:', scheduleError);
        return NextResponse.json({ success: false, error: `일정 저장 실패: ${scheduleError.message}` }, { status: 500 });
      }

      // 누적 점수 업데이트 및 푸시 알림 발송
      for (const r of results) {
        const userData = allUsers.find(u => u.id === r.userId);
        if (userData) {
          const newScore = userData.totalScore + r.scoreAdded;
          await supabaseAdmin.from('profiles').update({ total_score: newScore }).eq('id', r.userId);
          
          // Push notification
          try {
            const matchingTask = algoTasks.find(t => t.id === r.taskId);
            const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', r.userId);
            if (subs && subs.length > 0) {
              const payload = {
                title: '✅ 일일 업무 배정 완료',
                body: `${matchingTask?.title} 업무가 배정되었습니다. (${todayDateStr} ${matchingTask?.startHour}시~${matchingTask?.endHour}시)`
              };
              for (const sub of subs) {
                const pushSub = {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth }
                };
                await sendPushNotification(pushSub, payload);
              }
            }
          } catch (e) {
            console.error('Failed to send push notification to user', r.userId, e);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: isMockMode ? 'Mock (더미 데이터)' : 'Database (실가동)',
      assignedCount: results.length,
      results
    });

  } catch (error: any) {
    console.error('배정 알고리즘 실행 실패:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
