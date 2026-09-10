// 放置路徑：src/app/api/admin/invites/route.ts
//
// Week 5 Session 5E：邀請碼管理 API
//
// GET  /api/admin/invites   → 列出邀請碼（含 status filter + search + cursor pagination + counts）
// POST /api/admin/invites   → 410：批次生成已停用，邀請碼一律由公版發放（2026-09 定案）
//
// Status 邏輯：
//   - available（未使用、未過期）：used_by IS NULL AND (expires_at IS NULL OR expires_at > NOW())
//   - used（已使用）：used_by IS NOT NULL
//   - expired（未使用、已過期）：used_by IS NULL AND expires_at IS NOT NULL AND expires_at < NOW()

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { supabaseAdmin } from '@/lib/supabase';
import type { ApiResponse } from '@/types';

// ============================================================
// Types
// ============================================================

type InviteStatus = 'available' | 'used' | 'expired';

interface InviteRow {
  code: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface InviteListItem {
  code: string;
  status: InviteStatus;
  used_by_user_id: string | null;
  used_by_email: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function deriveStatus(row: InviteRow, now: Date): InviteStatus {
  if (row.used_by) return 'used';
  if (row.expires_at && new Date(row.expires_at) < now) return 'expired';
  return 'available';
}

// ============================================================
// GET：列出邀請碼
// ============================================================

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || 'all'; // available | used | expired | all
    const search = url.searchParams.get('search')?.trim() || '';
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);

    const now = new Date();
    const nowIso = now.toISOString();

    // ─────────────────────────────────────────
    // 統計（給頁面頂部顯示）
    // ─────────────────────────────────────────
    // 三個 count query 並行
    const [availableCountRes, usedCountRes, expiredCountRes, totalCountRes] = await Promise.all([
      supabaseAdmin
        .from('invite_codes')
        .select('code', { count: 'exact', head: true })
        .is('used_by', null)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
      supabaseAdmin
        .from('invite_codes')
        .select('code', { count: 'exact', head: true })
        .not('used_by', 'is', null),
      supabaseAdmin
        .from('invite_codes')
        .select('code', { count: 'exact', head: true })
        .is('used_by', null)
        .lt('expires_at', nowIso),
      supabaseAdmin
        .from('invite_codes')
        .select('code', { count: 'exact', head: true }),
    ]);

    const counts = {
      available: availableCountRes.count ?? 0,
      used: usedCountRes.count ?? 0,
      expired: expiredCountRes.count ?? 0,
      total: totalCountRes.count ?? 0,
    };

    // ─────────────────────────────────────────
    // 主 list query
    // ─────────────────────────────────────────
    let query = supabaseAdmin
      .from('invite_codes')
      .select('code, used_by, used_at, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit + 1); // 多撈 1 筆判斷 hasMore

    if (statusFilter === 'available') {
      query = query.is('used_by', null).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    } else if (statusFilter === 'used') {
      query = query.not('used_by', 'is', null);
    } else if (statusFilter === 'expired') {
      query = query.is('used_by', null).lt('expires_at', nowIso);
    }

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&').toUpperCase();
      query = query.ilike('code', `%${escaped}%`);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: rows, error: queryError } = await query;
    if (queryError) {
      console.error('[GET /api/admin/invites] query failed:', queryError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '查詢邀請碼失敗', timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    const safeRows = (rows || []) as InviteRow[];
    const hasMore = safeRows.length > limit;
    const pageRows = hasMore ? safeRows.slice(0, limit) : safeRows;
    const nextCursor =
      hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].created_at : null;

    // ─────────────────────────────────────────
    // Join user email（給 used_by 顯示）
    // ─────────────────────────────────────────
    const userIds = Array.from(
      new Set(pageRows.map(r => r.used_by).filter((x): x is string => !!x))
    );

    const userEmailMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds);
      (users || []).forEach(u => userEmailMap.set(u.id, u.email));
    }

    const invites: InviteListItem[] = pageRows.map(row => ({
      code: row.code,
      status: deriveStatus(row, now),
      used_by_user_id: row.used_by,
      used_by_email: row.used_by ? userEmailMap.get(row.used_by) || null : null,
      used_at: row.used_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
    }));

    return NextResponse.json<ApiResponse>({
      data: {
        invites,
        counts,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[GET /api/admin/invites] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ============================================================
// POST：批次生成邀請碼（已停用）
// ============================================================

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  // 2026-09：邀請碼一律由公版發放（金流與試用架構定案 §01/§06）。
  // 私版停止生成 —— 留著 handler 回 410 而不是整段刪掉，
  // 是為了讓還開著舊頁面的人得到明確訊息，而非 404 誤判成部署壞了。
  return NextResponse.json<ApiResponse>(
    { data: null, error: '邀請碼已改由公版後台統一發放，此功能已停用', timestamp: new Date().toISOString() },
    { status: 410 }
  );
}

