import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser, isAdminOrMaster } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  // ✅ [C-1] 인증 검사
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (!isAdminOrMaster(authUser)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const { scheduleId } = await req.json();
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    const { data: schedule } = await supabaseAdmin
      .from('schedules')
      .select('user_id, task_id, date, start_hour, end_hour')
      .eq('id', scheduleId)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: '스케줄을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: task } = await supabaseAdmin
      .from('tasks').select('title').eq('id', schedule.task_id).single();

    const taskTitle = task?.title || '업무';
    const hour = `${schedule.start_hour}시~${schedule.end_hour}시`;
    const dateStr = new Date(schedule.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    const { error: deleteErr } = await supabaseAdmin
      .from('schedules').delete().eq('id', scheduleId);
    if (deleteErr) throw deleteErr;

    await supabaseAdmin.from('notifications').insert({
      user_id: schedule.user_id,
      title: '⚠️ 업무 취소 알림',
      body: `${dateStr} ${hour} [${taskTitle}] 업무가 취소되었습니다.`,
      is_read: false
    });

    return NextResponse.json({ success: true, notifiedUserId: schedule.user_id });
  } catch (err: any) {
    return NextResponse.json({ error: '일정 취소 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
