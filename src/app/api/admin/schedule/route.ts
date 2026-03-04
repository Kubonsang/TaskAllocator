import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAuthUser, isAdminOrMaster, sanitize } from '@/lib/auth';

export async function PUT(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  if (!isAdminOrMaster(authUser)) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  try {
    const { scheduleId, startHour, endHour, note, taskId } = await req.json();
    if (!scheduleId) return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });

    const updateData: any = {};
    if (startHour !== undefined) updateData.start_hour = Number(startHour);
    if (endHour !== undefined) updateData.end_hour = Number(endHour);
    if (note !== undefined) updateData.note = sanitize(note, 200);
    if (taskId !== undefined) updateData.task_id = taskId;

    const { error } = await supabaseAdmin.from('schedules').update(updateData).eq('id', scheduleId);
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: '일정이 수정되었습니다.' });
  } catch (error: any) {
    return NextResponse.json({ error: '일정 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authUser = await getAuthUser(req);
  if (!authUser) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  if (!isAdminOrMaster(authUser)) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

  try {
    const { scheduleId } = await req.json();
    if (!scheduleId) return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });

    const { error: deleteErr } = await supabaseAdmin.from('schedules').delete().eq('id', scheduleId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: '일정이 삭제/초기화되었습니다.' });
  } catch (error: any) {
    return NextResponse.json({ error: '일정 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
