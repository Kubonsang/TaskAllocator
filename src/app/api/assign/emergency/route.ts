import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { DUMMY_USERS } from '@/lib/dummyData';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { sendPushNotification } from '@/lib/webpush';

export async function POST(request: Request) {
  try {
    const { title, intensity, description, location, color, date, startHour, endHour } = await request.json();

    if (!title || startHour === undefined || endHour === undefined) {
      return NextResponse.json({ error: '필수 파라미터(업무명, 시간)가 누락되었습니다.' }, { status: 400 });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Fetch all users excluding Admins and Masters (assign to Worker)
    let { data: users, error: userErr } = await supabase.from('profiles').select('id, name, total_score, role').neq('role', 'Admin').neq('role', 'Master');
    if (userErr) throw new Error('유저 목록을 가져올 수 없습니다.');

    let isMockMode = false;
    if (!users || users.length === 0) {
       isMockMode = true;
       // DB에 임직원(Worker)이 아예 없으면 테스트용 더미 데이터를 채용
       users = DUMMY_USERS.filter(u => u.role !== 'Admin' && u.role !== 'Master').map(u => ({
         id: u.id,
         name: u.name,
         total_score: u.totalScore,
         role: u.role
       }));
    }

    // 2. Fetch all schedules for today to calculate current daily workload
    const { data: todaySchedules } = await supabase.from('schedules').select('*').eq('date', targetDate);
    const { data: tasks } = await supabase.from('tasks').select('*');

    const taskMap = (tasks || []).reduce((acc: any, t: any) => {
      acc[t.id] = t.intensity;
      return acc;
    }, {});

    // Calculate current workload for each user today
    const workloads = users.map(user => {
      const userScheds = (todaySchedules || []).filter((s: any) => s.user_id === user.id);
      const dailyLoad = userScheds.reduce((sum: number, s: any) => {
         const intensity = taskMap[s.task_id] || 0;
         const hours = s.end_hour - s.start_hour;
         return sum + (intensity * hours);
      }, 0);

      const totalScore = Number(user.total_score || 0);
      
      return {
         ...user,
         dailyLoad,
         combinedLoad: totalScore + dailyLoad // Total score tracking overall fairness
      };
    });

    // 3. Find the user with the minimum dailyLoad (or combinedLoad)
    // Here we prioritize who is the most free TODAY.
    workloads.sort((a, b) => a.dailyLoad - b.dailyLoad);
    const selectedUser = workloads[0];

    if (!selectedUser) {
       return NextResponse.json({ error: '배정할 직원이 없습니다.' }, { status: 400 });
    }

    // 4. Create the 1-off Task in Tasks table (Only if NOT mock mode)
    if (!isMockMode) {
      const mappedTask = {
         title, 
         intensity, 
         start_hour: startHour, 
         end_hour: endHour, 
         color, 
         location, 
         description: description || '단발성 긴급 할당 업무',
         set_id: 'EMERGENCY'
      };
      
      const { data: insertedTask, error: taskErr } = await supabase.from('tasks').insert([mappedTask]).select('id').single();
      if (taskErr || !insertedTask) throw new Error('업무 레코드를 생성할 수 없습니다.');
      const newTaskId = insertedTask.id;

      // 5. Insert the new emergency schedule schedule
      const newSchedule = {
         user_id: selectedUser.id,
         task_id: newTaskId,
         date: targetDate,
         start_hour: startHour,
         end_hour: endHour,
         note: description || '긴급 배정 건'
      };

      const { error: insertErr } = await supabase.from('schedules').insert(newSchedule);
      if (insertErr) throw insertErr;

      // 6. Send Push Notification
      try {
        const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', selectedUser.id);
        if (subs && subs.length > 0) {
          const payload = {
            title: '🚨 긴급 업무 배정',
            body: `${title} 업무가 배정되었습니다. (${targetDate} ${startHour}시~${endHour}시)`
          };
          for (const sub of subs) {
            const pushSub = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            };
            await sendPushNotification(pushSub, payload);
          }
        }
      } catch (pushErr) {
        console.error('Push notification sending failed:', pushErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      assignedTo: selectedUser.name, 
      dailyLoadBefore: selectedUser.dailyLoad,
      message: `${selectedUser.name} 님에게 긴급 업무가 배정되었습니다.` 
    });

  } catch (err: any) {
    console.error('Emergency Assign Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
