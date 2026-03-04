import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendPushNotification } from '@/lib/webpush';
import { getAuthUser, isAdminOrMaster, sanitize } from '@/lib/auth';

export async function POST(request: Request) {
  // ✅ [C-1] 인증 검사 + [C-2] supabaseAdmin만 사용
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isAdminOrMaster(authUser)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    // ✅ [M-2] 입력값 새니타이징
    const title = sanitize(body.title, 100);
    const intensity = Number(body.intensity) || 1;
    const description = sanitize(body.description, 500);
    const location = sanitize(body.location, 200);
    const color = sanitize(body.color, 50);
    const date = body.date;
    const startHour = Number(body.startHour);
    const endHour = Number(body.endHour);

    if (!title || isNaN(startHour) || isNaN(endHour)) {
      return NextResponse.json({ error: '필수 파라미터(업무명, 시간)가 누락되었습니다.' }, { status: 400 });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // ✅ [C-2] supabaseAdmin 사용으로 변경 (anon key 사용 제거)
    let { data: users, error: userErr } = await supabaseAdmin
      .from('profiles').select('id, name, total_score, role')
      .neq('role', 'Admin').neq('role', 'Master');
    if (userErr) throw new Error('유저 목록을 가져올 수 없습니다.');

    if (!users || users.length === 0) {
      return NextResponse.json({ error: '배정할 직원이 없습니다.' }, { status: 400 });
    }

    const { data: todaySchedules } = await supabaseAdmin
      .from('schedules').select('*').eq('date', targetDate);
    const { data: tasks } = await supabaseAdmin.from('tasks').select('*');

    const taskMap = (tasks || []).reduce((acc: any, t: any) => {
      acc[t.id] = t.intensity;
      return acc;
    }, {});

    const workloads = users.map(user => {
      const userScheds = (todaySchedules || []).filter((s: any) => s.user_id === user.id);
      const dailyLoad = userScheds.reduce((sum: number, s: any) => {
         const taskIntensity = taskMap[s.task_id] || 0;
         const hours = s.end_hour - s.start_hour;
         return sum + (taskIntensity * hours);
      }, 0);
      const totalScore = Number(user.total_score || 0);
      return { ...user, dailyLoad, combinedLoad: totalScore + dailyLoad };
    });

    workloads.sort((a, b) => a.dailyLoad - b.dailyLoad);
    const selectedUser = workloads[0];

    if (!selectedUser) {
       return NextResponse.json({ error: '배정할 직원이 없습니다.' }, { status: 400 });
    }

    const mappedTask = {
       title, intensity, start_hour: startHour, end_hour: endHour,
       color, location, description: description || '단발성 긴급 할당 업무',
       set_id: 'EMERGENCY'
    };
    
    const { data: insertedTask, error: taskErr } = await supabaseAdmin
      .from('tasks').insert([mappedTask]).select('id').single();
    if (taskErr || !insertedTask) throw new Error('업무 레코드를 생성할 수 없습니다.');

    const newSchedule = {
       user_id: selectedUser.id, task_id: insertedTask.id,
       date: targetDate, start_hour: startHour, end_hour: endHour,
       note: description || '긴급 배정 건'
    };

    const { error: insertErr } = await supabaseAdmin.from('schedules').insert(newSchedule);
    if (insertErr) throw insertErr;

    // 푸시 알림
    try {
      const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', selectedUser.id);
      if (subs && subs.length > 0) {
        const payload = {
          title: '🚨 긴급 업무 배정',
          body: `${title} 업무가 배정되었습니다. (${targetDate} ${startHour}시~${endHour}시)`
        };
        for (const sub of subs) {
          await sendPushNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        }
      }
    } catch (pushErr) {
      // 푸시 실패는 배정 성공에 영향 없음
    }

    return NextResponse.json({ 
      success: true, 
      assignedTo: selectedUser.name, 
      dailyLoadBefore: selectedUser.dailyLoad,
      message: `${selectedUser.name} 님에게 긴급 업무가 배정되었습니다.` 
    });

  } catch (err: any) {
    console.error('Emergency Assign Error:', err);
    return NextResponse.json({ error: '긴급 배정 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
