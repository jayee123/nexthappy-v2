// 放置路徑：src/app/api/admin/conversations/[id]/route.ts
//
// Week 4 Session 4B：對話詳情 API
//
// 回傳：
//   - 完整 conversation（含 messages JSONB array）
//   - user 資訊（email/name/mbti）
//   - journey 資訊（若 journey_id 存在）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface Message {
  role: string;
  content: string;
  [key: string]: unknown;
}

interface ConversationDetail {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_mbti_self: string | null;
  journey_id: string | null;
  journey_round_number: number | null;
  journey_partner_nickname: string | null;
  journey_mbti_partner: string | null;
  journey_relationship_type: string | null;
  day_number: number;
  context_type: string | null;
  topic_title: string | null;
  topic_started_at: string | null;
  archived_at: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
  messages: Message[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const convId = params.id;
  if (!convId || !/^[0-9a-f-]{36}$/i.test(convId)) {
    return NextResponse.json<ApiResponse>({
      data: null,
      error: '無效的 conversation ID',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  try {
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, journey_id, day_number, context_type, topic_title, topic_started_at, archived_at, source, messages, created_at, updated_at, users!inner(email, name, mbti_self)')
      .eq('id', convId)
      .single();

    if (convError || !conv) {
      console.error('[conversation detail] fetch error:', convError);
      return NextResponse.json<ApiResponse>({
        data: null,
        error: '找不到此對話',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    let journey: {
      round_number: number | null;
      partner_nickname: string | null;
      mbti_partner: string | null;
      relationship_type: string | null;
    } | null = null;

    if (conv.journey_id) {
      const { data: jData } = await supabaseAdmin
        .from('journeys')
        .select('round_number, partner_nickname, mbti_partner, relationship_type')
        .eq('id', conv.journey_id)
        .single();
      journey = jData;
    }

    const userRaw = conv.users as unknown;
    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    const userObj = user as { email?: string; name?: string | null; mbti_self?: string | null } | undefined;

    const detail: ConversationDetail = {
      id: conv.id,
      user_id: conv.user_id,
      user_email: userObj?.email || '',
      user_name: userObj?.name || null,
      user_mbti_self: userObj?.mbti_self || null,
      journey_id: conv.journey_id,
      journey_round_number: journey?.round_number ?? null,
      journey_partner_nickname: journey?.partner_nickname ?? null,
      journey_mbti_partner: journey?.mbti_partner ?? null,
      journey_relationship_type: journey?.relationship_type ?? null,
      day_number: conv.day_number,
      context_type: conv.context_type,
      topic_title: conv.topic_title,
      topic_started_at: conv.topic_started_at,
      archived_at: conv.archived_at,
      source: conv.source,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      messages: (conv.messages as Message[]) || [],
    };

    return NextResponse.json<ApiResponse>({
      data: detail,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Conversation detail error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}