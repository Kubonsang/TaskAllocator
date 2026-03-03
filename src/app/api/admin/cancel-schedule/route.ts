import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { scheduleId } = await req.json();
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    // 1. 삭제할 스케줄 정보 가져오기 (알림용)
    const { data: schedule } = await supabaseAdmin
      .from('schedules')
      .select('user_id, task_id, date, start_hour, end_hour')
      .eq('id', scheduleId)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: '스케줄을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 업무 정보 가져오기
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('title')
      .eq('id', schedule.task_id)
      .single();

    const taskTitle = task?.title || '업무';
    const hour = `${schedule.start_hour}시~${schedule.end_hour}시`;
    const dateStr = new Date(schedule.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    // 3. 스케줄 삭제
    const { error: deleteErr } = await supabaseAdmin
      .from('schedules')
      .delete()
      .eq('id', scheduleId);

    if (deleteErr) throw deleteErr;

    // 4. 해당 직원에게 알림 생성
    await supabaseAdmin.from('notifications').insert({
      user_id: schedule.user_id,
      title: '⚠️ 업무 취소 알림',
      body: `${dateStr} ${hour} [${taskTitle}] 업무가 취소되었습니다.`,
      is_read: false
    });

    return NextResponse.json({ success: true, notifiedUserId: schedule.user_id });
  } catch (err: any) {
    console.error('[cancel-schedule error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
