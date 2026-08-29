// 放置路徑：src/app/admin/users/[id]/page.tsx
//
// Week 2 Session 2C：學員詳情頁（含編輯 + 停權 + 復原功能）
//
// Updates from Session 2B:
//   - 串接 EditUserModal（點「編輯」開 modal）
//   - 停權 / 復原 按鈕真實接 PATCH API
//   - 防自鎖：admin 不可停權 / 刪除自己
//   - 操作後自動 refresh 詳情

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import EditUserModal from '@/components/admin/EditUserModal';
import { MARKET_FIELD_HEADER_STYLE } from '@/lib/admin/marketField';

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  mbti_self: string | null;
  mbti_confidence: string | null;
  mbti_set_at: string | null;
  is_admin: boolean;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  /** 公版 users.id。null = 這筆還沒跟公版綁定 */
  nuwa_user_id: string | null;
}

/** 公版來的帳號資料（唯讀）。查不到 / 未綁定為 null */
interface MarketInfo {
  id: string;
  email: string | null;
  nickname: string | null;
  phone: string | null;
  currentPlan: string | null;
}

interface Journey {
  id: string;
  partner_nickname: string | null;
  mbti_partner: string | null;
  relationship_type: string;
  round_label: string | null;
  round_number: number | null;
  current_day: number;
  is_active: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  context_type: 'practice' | 'consultant';
  day_number: number | null;
  topic_title: string | null;
  source: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_conversations: number;
  total_journeys: number;
  first_activity: string | null;
  last_activity: string | null;
}

interface DetailResponse {
  user: UserDetail;
  market: MarketInfo | null;
  journeys: Journey[];
  recent_conversations: Conversation[];
  stats: Stats;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  couple: '伴侶',
  parent_child: '親子',
  workplace: '職場',
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: '不太確定',
  medium: '中等',
  high: '很有把握',
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 當前 admin 是誰（判斷是否是看自己、防自鎖）
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  // Modal / suspend loading state
  const [showEditModal, setShowEditModal] = useState(false);
  const [suspending, setSuspending] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // 抓當前 admin id（從 /api/user/me）
  useEffect(() => {
    async function loadCurrentAdmin() {
      try {
        const res = await fetch('/api/user/me');
        const json = await res.json();
        if (res.ok && json.data?.user?.id) {
          setCurrentAdminId(json.data.user.id);
        }
      } catch {
        // ignore
      }
    }
    loadCurrentAdmin();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${params.id}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '載入失敗');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) loadData();
  }, [params.id, loadData]);

  async function handleSuspend() {
    if (!data) return;
    if (!confirm(`確定要停權 ${data.user.email}？\n\n停權後 user 不能登入、但資料保留、可隨時復原。`)) return;

    setSuspending(true);
    try {
      const res = await fetch(`/api/admin/users/${data.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended_at: new Date().toISOString() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '停權失敗');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '停權失敗');
    } finally {
      setSuspending(false);
    }
  }

  async function handleUnsuspend() {
    if (!data) return;
    if (!confirm(`確定要解除 ${data.user.email} 的停權？\n\n解除後 user 可以重新登入。`)) return;

    setSuspending(true);
    try {
      const res = await fetch(`/api/admin/users/${data.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended_at: null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '解除停權失敗');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '解除停權失敗');
    } finally {
      setSuspending(false);
    }
  }

  
  async function handleDelete() {
    if (!data) return;

    // 第 1 次 confirm：基本確認
    const firstConfirm = confirm(
      `⚠️ 確定要刪除 ${data.user.email}？\n\n` +
      `下一步會問你「再次確認」、按是才真的刪。`
    );
    if (!firstConfirm) return;

    // 第 2 次 confirm：嚴重警告
    const secondConfirm = confirm(
      `🚨 最終確認：\n\n` +
      `刪除 ${data.user.email} 會**連帶永久消失**：\n` +
      `- ${data.stats.total_conversations} 筆對話紀錄\n` +
      `- ${data.stats.total_journeys} 個 21 天 Journey\n\n` +
      `**無法復原**。確定？`
    );
    if (!secondConfirm) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${data.user.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || '刪除失敗');
      }
      alert(`✅ 已刪除 ${data.user.email}`);
      router.push('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除失敗');
      setDeleting(false);
    }
  }


  if (loading) {
    return <div className="p-6 lg:p-8 text-center text-gray-400 py-12">載入中⋯</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/admin/users" className="text-primary-600 text-sm hover:underline">
          ← 返回學員列表
        </Link>
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          ⚠️ {error || '找不到 user'}
        </div>
      </div>
    );
  }

  const { user, market, journeys, recent_conversations, stats } = data;
  const displayName = user.name || user.email.split('@')[0];
  const isSelf = currentAdminId === user.id; // 是否看自己

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <Link href="/admin/users" className="text-primary-600 text-sm hover:underline">
        ← 返回學員列表
      </Link>

      <div className="mt-3 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex flex-wrap items-center gap-2">
            <span>{displayName}</span>
            {user.is_admin && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700">Admin</span>
            )}
            {user.suspended_at && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">已停權</span>
            )}
            {isSelf && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">這是你</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowEditModal(true)}
            disabled={suspending}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-40"
          >
            ✏️ 編輯
          </button>

          {user.suspended_at ? (
            <button
              onClick={handleUnsuspend}
              disabled={suspending}
              className="px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suspending ? '處理中⋯' : '✅ 復原'}
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={suspending || isSelf}
              title={isSelf ? 'admin 不可停權自己' : '停權'}
              className="px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suspending ? '處理中⋯' : '🚫 停權'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isSelf || suspending || deleting || user.is_admin}
            title={
              isSelf ? 'admin 不可刪除自己'
              : user.is_admin ? '不可刪除其他 admin、請先降為一般 user'
              : '永久刪除（cascade）'
            }
            className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? '刪除中⋯' : '🗑 刪除'}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: profile + stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* 用戶資料 —— 來源是公版（唯一身分來源），私版唯讀。
              要改這些欄位得去公版後台，所以整張卡用標示色跟下面那張分開。
              只標卡片標題，卡內不逐欄標 —— 整張卡同一個來源，逐欄標反而讓人
              以為沒標的欄位不是公版的。（列表頁需要逐欄標，是因為公私版欄位
              混在同一列。） */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-base font-semibold rounded px-2 py-0.5" style={MARKET_FIELD_HEADER_STYLE}>
                用戶資料
              </h2>
              <span className="text-xs text-gray-400">公版帳號 · 唯讀</span>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-gray-400">NUWA ID</dt>
                <dd className="text-gray-600 font-mono text-xs break-all">
                  {user.nuwa_user_id || <span className="text-amber-600 font-sans">尚未綁定公版</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Email</dt>
                <dd className="text-gray-800">
                  {market?.email ?? user.email}
                  {!market?.email && (
                    <span className="ml-2 text-xs text-amber-600">（公版查無，顯示私版快照）</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">手機</dt>
                <dd className="text-gray-800">{market?.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">用戶名稱</dt>
                <dd className="text-gray-800">{market?.nickname || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">方案</dt>
                <dd className="text-gray-800">{market?.currentPlan || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* 學員資料 —— 私版自己的，可寫 */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-3">學員資料</h2>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-gray-400">學員 ID</dt>
                <dd className="text-gray-600 font-mono text-xs break-all">{user.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">學員暱稱</dt>
                <dd className="text-gray-800">{user.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">MBTI</dt>
                <dd className="text-gray-800 font-mono">
                  {user.mbti_self || '—'}
                  {user.mbti_confidence && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({CONFIDENCE_LABEL[user.mbti_confidence] || user.mbti_confidence})
                    </span>
                  )}
                </dd>
                {user.mbti_set_at && (
                  <p className="text-xs text-gray-400 mt-0.5">設定於 {formatDate(user.mbti_set_at)}</p>
                )}
              </div>
              <div>
                <dt className="text-xs text-gray-400">註冊時間</dt>
                <dd className="text-gray-600 text-xs">{formatDateTime(user.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">最後更新</dt>
                <dd className="text-gray-600 text-xs">{formatDateTime(user.updated_at)}</dd>
              </div>
              {user.suspended_at && (
                <div>
                  <dt className="text-xs text-red-500">停權時間</dt>
                  <dd className="text-red-700 text-xs">{formatDateTime(user.suspended_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Stats */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-3">活動統計</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-bold text-gray-800 tabular-nums">{stats.total_conversations}</div>
                <div className="text-xs text-gray-500">總對話數</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 tabular-nums">{stats.total_journeys}</div>
                <div className="text-xs text-gray-500">Journey 數</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
              <div>首次活動：{formatDateTime(stats.first_activity)}</div>
              <div>最後活動：{formatDateTime(stats.last_activity)}</div>
            </div>
          </div>
        </div>

        {/* Right: journeys + conversations */}
        <div className="lg:col-span-2 space-y-4">

          {/* Journeys */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-700">21 天 Journey 紀錄（{journeys.length}）</h2>
            </div>
            {journeys.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">這個 user 還沒啟動 21 天練習</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Round</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">對方</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">關係</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">進度</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">狀態</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">建立</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map(j => (
                      <tr key={j.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">第 {j.round_number || '?'} 輪</td>
                        <td className="px-4 py-2 text-gray-800">
                          {j.partner_nickname || '—'}
                          {j.mbti_partner && <span className="ml-1 text-xs text-gray-500 font-mono">({j.mbti_partner})</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{RELATIONSHIP_LABEL[j.relationship_type] || j.relationship_type}</td>
                        <td className="px-4 py-2 text-gray-700 tabular-nums whitespace-nowrap">Day {j.current_day} / 21</td>
                        <td className="px-4 py-2">
                          {j.is_active ? (
                            <span className="text-xs text-green-700">進行中</span>
                          ) : (
                            <span className="text-xs text-gray-400">已結束</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{formatDate(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent conversations */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-700">最近對話（{recent_conversations.length}）</h2>
              <p className="text-xs text-gray-500 mt-0.5">總共 {stats.total_conversations} 筆、顯示最近 20 筆</p>
            </div>
            {recent_conversations.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">這個 user 還沒任何對話</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Mode</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Day / Topic</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">來源</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">訊息數</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">最後更新</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">動作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_conversations.map(c => (
                      <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          {c.context_type === 'practice' ? (
                            <span className="text-xs text-primary-700">🌱 21 天</span>
                          ) : (
                            <span className="text-xs text-amber-700">🤝 我卡住</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-800 text-xs">
                          {c.context_type === 'practice'
                            ? `Day ${c.day_number ?? '?'}`
                            : (c.topic_title || '（未命名）')}
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">
                          {c.source === 'voice' ? '🎙 voice' : '💬 text'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 tabular-nums">{c.message_count}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">{formatDate(c.updated_at)}</td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-xs text-gray-400" title="Week 4 對話歷史模組會建詳情頁">
                            查看（Week 4）
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <EditUserModal
          user={user}
          isSelfAdmin={isSelf}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            loadData(); // refresh detail
          }}
        />
      )}
    </div>
  );
}