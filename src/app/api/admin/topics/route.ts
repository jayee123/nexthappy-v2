// 放置路徑：src/app/api/admin/topics/route.ts
//
// 諮詢主題 API：聚合 Mode B 對話成 topics、抽取 Top 50 keywords
//
// 設計決策：
//   - topic 聚合：exact match topic_title
//   - keyword extraction：split by 、，, 後計次（AI 一律用 、分隔概念）

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

interface MessageItem { role: string; content: string; }

interface TopicItem {
  topic_title: string;
  conversation_count: number;
  unique_user_count: number;
  total_messages: number;
  first_conv_id: string;
  first_user_email: string;
  first_user_name: string | null;
  first_at: string;
  last_at: string;
  archived_count: number;
}

interface KeywordItem {
  keyword: string;
  count: number;
}

interface TopicsResponse {
  total_conversations: number;
  total_unique_topics: number;
  topics: TopicItem[];
  top_keywords: KeywordItem[];
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, topic_title, messages, created_at, archived_at, users!inner(email, name)')
      .eq('context_type', 'consultant')
      .not('topic_title', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[topics] fetch error:', error);
      throw error;
    }

    const rows = data || [];

    // Group by topic_title (exact match)
    interface TopicAgg {
      uniqueUsers: Set<string>;
      totalMessages: number;
      firstAt: string;
      lastAt: string;
      firstConvId: string;
      firstUserEmail: string;
      firstUserName: string | null;
      conversationCount: number;
      archivedCount: number;
    }

    const topicMap = new Map<string, TopicAgg>();

    for (const row of rows) {
      const title = row.topic_title!;
      const msgs = (row.messages as MessageItem[]) || [];
      const userRaw = row.users as unknown;
      const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
      const userObj = user as { email?: string; name?: string | null } | undefined;

      let agg = topicMap.get(title);
      if (!agg) {
        agg = {
          uniqueUsers: new Set(),
          totalMessages: 0,
          firstAt: row.created_at,
          lastAt: row.created_at,
          firstConvId: row.id,
          firstUserEmail: userObj?.email || '',
          firstUserName: userObj?.name || null,
          conversationCount: 0,
          archivedCount: 0,
        };
        topicMap.set(title, agg);
      }

      agg.conversationCount++;
      agg.uniqueUsers.add(row.user_id);
      agg.totalMessages += msgs.length;
      if (row.created_at < agg.firstAt) agg.firstAt = row.created_at;
      if (row.created_at > agg.lastAt) agg.lastAt = row.created_at;
      if (row.archived_at) agg.archivedCount++;
    }

    const topics: TopicItem[] = Array.from(topicMap.entries())
      .map(([title, agg]) => ({
        topic_title: title,
        conversation_count: agg.conversationCount,
        unique_user_count: agg.uniqueUsers.size,
        total_messages: agg.totalMessages,
        first_conv_id: agg.firstConvId,
        first_user_email: agg.firstUserEmail,
        first_user_name: agg.firstUserName,
        first_at: agg.firstAt,
        last_at: agg.lastAt,
        archived_count: agg.archivedCount,
      }))
      .sort((a, b) => b.last_at.localeCompare(a.last_at));

    // Keyword extraction: split by 、 ， ,
    const keywordCount = new Map<string, number>();
    for (const row of rows) {
      const segments = (row.topic_title || '')
        .split(/[、，,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length >= 2);
      for (const seg of segments) {
        keywordCount.set(seg, (keywordCount.get(seg) || 0) + 1);
      }
    }

    const top_keywords: KeywordItem[] = Array.from(keywordCount.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const response: TopicsResponse = {
      total_conversations: rows.length,
      total_unique_topics: topics.length,
      topics,
      top_keywords,
    };

    return NextResponse.json<ApiResponse>({
      data: response,
      error: null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Topics API error:', err);
    return NextResponse.json<ApiResponse>({
      data: null,
      error: err instanceof Error ? err.message : '查詢失敗',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}