// ⚠️ DEV-ONLY ENDPOINT — 測試完 21 天後請刪除這支檔案
//
// 功能：強制把 journey.current_day 推進 +1（cap 在 21）
// 用途：讓測試帳號可以一天內走完 21 天課程，不用等 00:00
// 守門：
//   (1) email 白名單（只對 steveweng7@gmail.com 開放）
//   (2) production 環境直接 404（避免上線後被探測到）
// 搭配：
//   - 晚間按「完成今日」後 → 按此 dev 按鈕 → 立即進 Day N+1
//   - 同時也 upsert 一筆 yesterday 的假 date 進 daily_records，讓 /today 的 auto-advance 不會再重複推

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionFromRequest } from '@/lib/auth';

const DEV_EMAIL_ALLOWLIST = ['steveweng7@gmail.com'];

export async function POST(request: NextRequest) {
  try {
    // (1) production 環境直接 404
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // (2) 必須登入
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // (3) email 白名單
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', session.userId)
      .single();

    if (!user || !DEV_EMAIL_ALLOWLIST.includes(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // (4) 拿 active journey
    const { data: journey, error: journeyError } = await supabaseAdmin
      .from('journeys')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json({ error: '找不到旅程' }, { status: 404 });
    }

    if (journey.current_day >= 21) {
      return NextResponse.json({ error: '已經是最後一天（Day 21）', current_day: 21 }, { status: 400 });
    }

    // (5) 強制推進 current_day
    const newDay = journey.current_day + 1;
    const { error: updateError } = await supabaseAdmin
      .from('journeys')
      .update({ current_day: newDay })
      .eq('id', journey.id);

    if (updateError) {
      return NextResponse.json({ error: '推進失敗', detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      previous_day: journey.current_day,
      current_day: newDay,
      message: `已推進到 Day ${newDay}`,
    });
  } catch (error) {
    console.error('[dev/advance-day]', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
