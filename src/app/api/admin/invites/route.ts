// 放置路徑：src/app/api/admin/invites/route.ts
//
// Week 5 Session 5E：邀請碼管理 API
//
// GET  /api/admin/invites   → 列出邀請碼（含 status filter + search + cursor pagination + counts）
// POST /api/admin/invites   → 批次生成邀請碼（prefix + count + expires_in_days）
//
// Status 邏輯：
//   - available（未使用、未過期）：used_by IS NULL AND (expires_at IS NULL OR expires_at > NOW())
//   - used（已使用）：used_by IS NOT NULL
//   - expired（未使用、已過期）：used_by IS NULL AND expires_at IS NOT NULL AND expires_at < NOW()

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
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
// POST：批次生成邀請碼
// ============================================================

interface CreateBatchBody {
  prefix?: unknown;
  count?: unknown;
  expires_in_days?: unknown; // null = 永不過期、number = 從現在算 N 天後
}

export async function POST(request: NextRequest) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;

  let body: CreateBatchBody;
  try {
    body = (await request.json()) as CreateBatchBody;
  } catch {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '請求 body 不是有效 JSON', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────
  // Validate prefix
  // ─────────────────────────────────────────
  if (typeof body.prefix !== 'string') {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'prefix 為必填字串', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
  const prefix = body.prefix.trim().toUpperCase();
  if (prefix.length < 3 || prefix.length > 30) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'prefix 長度需在 3-30 字之間', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
  if (!/^[A-Z0-9-]+$/.test(prefix)) {
    return NextResponse.json<ApiResponse>(
      {
        data: null,
        error: 'prefix 只允許英文字母、數字、橫線 -',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────
  // Validate count
  // ─────────────────────────────────────────
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: 'count 必須是 1-100 的整數', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────
  // Validate expires_in_days
  // ─────────────────────────────────────────
  let expiresAt: string | null = null;
  if (body.expires_in_days !== null && body.expires_in_days !== undefined) {
    const days = Number(body.expires_in_days);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return NextResponse.json<ApiResponse>(
        {
          data: null,
          error: 'expires_in_days 必須是 1-3650 之間（或 null 表示永不過期）',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
    const exp = new Date();
    exp.setDate(exp.getDate() + days);
    expiresAt = exp.toISOString();
  }

  try {
    // ─────────────────────────────────────────
    // 找這個 prefix 的下一個流水號 + 偵測既有 padding 寬度
    //
    // 規則：
    //   - 既有 codes 有 3 位數 → 新生繼承 3 位數（NUWA-TEST-001 → ...-006）
    //   - 既有 codes 有 2 位數 → 新生繼承 2 位數
    //   - 既有 codes 是混合 → 取最大寬度（避免 padding 太短溢出）
    //   - 沒既有 codes（新 prefix）→ 預設 3 位數
    //   - 數字超過 padding 容量 → 自動加位數（譬如 3 位數既有、新號到 1000 → 4 位數）
    // ─────────────────────────────────────────
    const { data: allExisting } = await supabaseAdmin
      .from('invite_codes')
      .select('code')
      .ilike('code', `${prefix}-%`);

    let maxNum = 0;
    let detectedPadding = 3; // 新 prefix 預設 3 位

    if (allExisting && allExisting.length > 0) {
      let maxSuffixLen = 0;
      for (const row of allExisting) {
        const code = row.code as string;
        const suffix = code.slice(prefix.length + 1); // 拿掉 "PREFIX-"
        const num = parseInt(suffix, 10);
        if (Number.isInteger(num) && num > maxNum) maxNum = num;
        if (suffix.length > maxSuffixLen) maxSuffixLen = suffix.length;
      }
      if (maxSuffixLen > 0) detectedPadding = maxSuffixLen;
    }

    const startNum = maxNum + 1;

    // 產生 codes（按偵測到的 padding 寬度補齊；若數字超出寬度則自然展開）
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      const numStr = num.toString();
      const padded = numStr.length > detectedPadding ? numStr : numStr.padStart(detectedPadding, '0');
      codes.push(`${prefix}-${padded}`);
    }

    // ─────────────────────────────────────────
    // 批次 INSERT
    // ─────────────────────────────────────────
    const rows = codes.map(code => ({
      code,
      expires_at: expiresAt,
    }));

    const { error: insertError } = await supabaseAdmin.from('invite_codes').insert(rows);

    if (insertError) {
      console.error('[POST /api/admin/invites] insert failed:', insertError);
      return NextResponse.json<ApiResponse>(
        { data: null, error: '生成失敗：' + insertError.message, timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────
    // Audit log
    // ─────────────────────────────────────────
    if (adminUser) {
      await logAdminAction({
        request,
        adminUserId: adminUser.id,
        action: 'invite.create_batch',
        targetType: 'invite_batch',
        targetId: prefix,
        after: {
          prefix,
          count,
          first_code: codes[0],
          last_code: codes[codes.length - 1],
          expires_at: expiresAt,
        },
      });
    }

    return NextResponse.json<ApiResponse>({
      data: {
        created: count,
        codes,
        expires_at: expiresAt,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[POST /api/admin/invites] unexpected error:', err);
    return NextResponse.json<ApiResponse>(
      { data: null, error: '伺服器錯誤', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
