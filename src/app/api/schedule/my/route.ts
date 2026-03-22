import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAuthUser } from '@/lib/auth';

export async function DELETE(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const { scheduleId } = await req.json();
    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    // 자신이 등록한 스케줄인지 확인 (또는 특정 조건 확인 가능)
    // 휴가/블록 등 task_id가 없는 일정만 삭제할 수 있도록 제한
    const { data: schedule } = await supabaseAdmin
      .from('schedules')
      .select('user_id, task_id')
      .eq('id', scheduleId)
      .single();

    if (!schedule) {
       return NextResponse.json({ error: '일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (schedule.user_id !== authUser.id) {
       return NextResponse.json({ error: '본인의 일정만 취소할 수 있습니다.' }, { status: 403 });
    }

    if (schedule.task_id) {
       return NextResponse.json({ error: '업무가 배정된 일정은 임의로 취소할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('schedules')
      .delete()
      .eq('id', scheduleId);
      
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: '휴가/개인 일정이 취소되었습니다.' });
  } catch (err: any) {
    return NextResponse.json({ error: '일정 취소 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
