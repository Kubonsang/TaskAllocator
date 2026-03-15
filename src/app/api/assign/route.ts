import { NextResponse } from 'next/server';
import { assignTasks, AlgorithmUser, AlgorithmTask } from '@/lib/algorithm';
import { DUMMY_USERS, TASK_TYPES } from '@/lib/dummyData';
import { sendPushNotification } from '@/lib/webpush';
import { getAuthUser, isAdminOrMaster } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  // ✅ [C-1] 인증 검사
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isAdminOrMaster(authUser)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    let { data: dbProfiles } = await supabaseAdmin.from('profiles').select('*').in('role', ['Worker', 'Admin']);
    let { data: dbTasks }    = await supabaseAdmin.from('tasks').select('*');

    const todayStr = new Date().toISOString().split('T')[0];
    let { data: dbBlocks } = await supabaseAdmin.from('schedules').select('*').eq('date', todayStr).is('task_id', null);

    let isMockMode = false;
    if (!dbProfiles || dbProfiles.length === 0) {
      dbProfiles = DUMMY_USERS.map(u => ({
        id: u.id, name: u.name, role: u.role, total_score: u.totalScore
      }));
      isMockMode = true;
    }
    if (!dbTasks || dbTasks.length === 0) {
      dbTasks = Object.values(TASK_TYPES).map(t => ({
        id: t.id, title: t.title, intensity: t.intensity,
        start_hour: t.startHour, end_hour: t.endHour, set_id: t.setId || null
      }));
    }

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
        id: p.id, name: p.name, role: p.role,
        totalScore: Number(p.total_score || 0),
        availableTimeSlots: slots
      };
    };

    const allUsers = dbProfiles.map(formatUser);
    const workerUsers = allUsers.filter(u => u.role === 'Worker');
    const adminUser = allUsers.find(u => u.role === 'Admin');

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
      id: t.id, title: t.title, intensity: Number(t.intensity || 1.0),
      startHour: Number(t.start_hour), endHour: Number(t.end_hour),
      setId: t.set_id || '',
      preferredUsers: t.preferred_users || [],
      dislikedUsers: t.disliked_users || [],
      excludedUsers: t.excluded_users || []
    }));

    if (algoTasks.length === 0) {
      return NextResponse.json({ success: false, error: `오늘(${currentDayStr}요일)에 배정할 업무가 없습니다.` }, { status: 400 });
    }

    let finalResults = assignTasks(workerUsers, algoTasks, { fuzzyMargin: 1.5 });
    
    const initialAssignedIds = new Set(finalResults.map(r => r.taskId));
    const initialLeftovers = algoTasks.filter(t => !initialAssignedIds.has(t.id));

    if (initialLeftovers.length > 0 && adminUser) {
      let secondPhaseResults: any[] = [];
      let remainingTasks = [...algoTasks];

      const adminPreferredTasks = remainingTasks.filter(t => t.preferredUsers?.includes(adminUser.id));
      if (adminPreferredTasks.length > 0) {
        const adminStepAResults = assignTasks([adminUser], adminPreferredTasks, { fuzzyMargin: 0 });
        secondPhaseResults = [...secondPhaseResults, ...adminStepAResults];
        const stepAIds = new Set(adminStepAResults.map(r => r.taskId));
        remainingTasks = remainingTasks.filter(t => !stepAIds.has(t.id));
      }

      const workerStepBResults = assignTasks(workerUsers, remainingTasks, { fuzzyMargin: 1.5 });
      secondPhaseResults = [...secondPhaseResults, ...workerStepBResults];
      const stepBIds = new Set(workerStepBResults.map(r => r.taskId));
      remainingTasks = remainingTasks.filter(t => !stepBIds.has(t.id));

      if (remainingTasks.length > 0) {
        const adminStepCResults = assignTasks([adminUser], remainingTasks, { fuzzyMargin: 0 });
        secondPhaseResults = [...secondPhaseResults, ...adminStepCResults];
      }

      finalResults = secondPhaseResults;
    }

    const results = finalResults;

    if (!isMockMode && results.length > 0) {
      const todayDateStr = new Date().toISOString().split('T')[0];

      const { error: clearError } = await supabaseAdmin
        .from('schedules').delete().eq('date', todayDateStr).not('task_id', 'is', null);

      if (clearError) {
        return NextResponse.json({ success: false, error: '기존 일정 초기화에 실패했습니다.' }, { status: 500 });
      }

      const schedulesToInsert = results.map(r => {
        const matchingTask = algoTasks.find(t => t.id === r.taskId);
        return {
          user_id: r.userId, task_id: r.taskId, date: todayDateStr,
          start_hour: matchingTask?.startHour ?? 9.0,
          end_hour:   matchingTask?.endHour   ?? 10.0,
        };
      });

      const { error: scheduleError } = await supabaseAdmin.from('schedules').insert(schedulesToInsert);
      if (scheduleError) {
        return NextResponse.json({ success: false, error: '일정 저장에 실패했습니다.' }, { status: 500 });
      }

      for (const r of results) {
        const userData = allUsers.find(u => u.id === r.userId);
        if (userData) {
          const newScore = userData.totalScore + r.scoreAdded;
          await supabaseAdmin.from('profiles').update({ total_score: newScore }).eq('id', r.userId);
          
          try {
            const matchingTask = algoTasks.find(t => t.id === r.taskId);
            const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', r.userId);
            if (subs && subs.length > 0) {
              const payload = {
                title: '✅ 일일 업무 배정 완료',
                body: `${matchingTask?.title} 업무가 배정되었습니다. (${todayDateStr} ${matchingTask?.startHour}시~${matchingTask?.endHour}시)`
              };
              for (const sub of subs) {
                await sendPushNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
              }
            }
          } catch (e) {
            // 푸시 알림 실패는 배정 성공에 영향을 주지 않음
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
    return NextResponse.json({ success: false, error: '배정 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
