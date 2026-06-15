// 放置路徑：src/app/api/admin/conversations/route.ts
//
// Week 4 Session 4A：對話歷史 list API
//
// 功能：
//   - 列出所有 conversation rows
//   - filter: context_type / user_id / journey_id / day_number / search
//   - cursor pagination (sort by created_at DESC)
//   - inner join users → email/name
//   - 不展開 messages JSONB（只算 length 與抓 first message preview）
//
// v1.4.x (Issue 2 follow-up)：list preview + count 也過濾掉 system trigger prompt、
//   跟 /admin/conversations/[id] detail page + /chat + PDF export 一致。

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface ConversationListItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  journey_id: string | null;
  day_number: number;
  context_type: string | null;
  topic_title: string | null;
  message_count: number;
  first_user_message_preview: string;
  created_at: string;
  archived_at: string | null;
}

interface MessageItem {
  role: string;
  content: string;
}

const VALID_CONTEXT_TYPES = ['morning', 'evening', 'consultant'];

// v1.4.x (Issue 2 follow-up)：偵測注入的 AI trigger prompt
//   regex 與 chat/page.tsx + export/conversation + admin/conversations/[id] 一致
function isAITriggerPrompt(msg: MessageItem): boolean {
  if (msg.role !== 'user') return false;
  const content = msg.content || '';
  return /^今天是.{0,200}請/.test(content);
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim() || '';
    const contextType = url.searchParams.get('context_type') || '';
    const userId = url.searchParams.get('user_id') || '';
    const journeyId = url.searchParams.get('journey_id') || '';
    const dayNumberRaw = url.searchParams.get('day_number');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);

    let query = supabaseAdmin
      .from('conversations')
      .select('id, user_id, journey_id, day_number, context_type, topic_title, messages, created_at, archived_at, users!inner(email, name)')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&');
      query = query.or(`email.ilike.%${escaped}%,name.ilike.%${escaped}%`, { referencedTable: 'users' });
    }

    if (contextType && VALID_CONTEXT_TYPES.includes(contextType)) {
      query = query.eq('context_type', contextType);
    }

    if (userId) query = query.eq('user_id', userId);
    if (journeyId) query = query.eq('journey_id', journeyId);

    if (dayNumberRaw !== null) {
      const dayNum = parseInt(dayNumberRaw, 10);
      if (!isNaN(dayNum)) query = query.eq('day_number', dayNum);
    }

    if (cursor) query = query.lt('created_at', cursor);

    const { data: rawRows, error: queryError } = await query;

    if (queryError) {
      console.error('[conversations list] query error:', queryError);
      throw queryError;
    }

    const rows = rawRows || [];
    const hasMore = rows.length > limit;
    const slicedRows = hasMore ? rows.slice(0, limit) : rows;

    const conversations: ConversationListItem[] = slicedRows.map(row => {
      const userRaw = row.users as unknown;
      const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
      const userObj = user as { email?: string; name?: string | null } | undefined;

      const rawMessages = (row.messages as MessageItem[]) || [];
      // v1.4.x (Issue 2 follow-up)：過濾 system trigger、count + preview 顯示真實對話
      const messages = rawMessages.filter(m => !isAITriggerPrompt(m));
      const message_count = messages.length;
      const firstUserMsg = messages.find(m => m.role === 'user');
      const first_user_message_preview = firstUserMsg
        ? firstUserMsg.content.slice(0, 100)
        : '';

      return {
        id: row.id,
        user_id: row.user_id,
        user_email: userObj?.email || '',
        user_name: userObj?.name || null,
        journey_id: row.journey_id,
        day_number: row.day_number,
        context_type: row.context_type,
        topic_title: row.topic_title,
        message_count,
        first_user_message_preview,
        created_at: row.created_at,
        archived_at: row.archived_at,
      };
    });

    const next_cursor = hasMore && slicedRows.length > 0
      ? slicedRows[slicedRows.length - 1].created_at
      : null;

    return NextResponse.json<ApiResponse>({
      data: {
        conversations,
        next_cursor,
        has_more: hasMore,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Conversations list error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}