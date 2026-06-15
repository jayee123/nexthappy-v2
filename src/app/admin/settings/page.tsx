// 放置路徑：src/app/admin/settings/page.tsx
//
// Week 5 Session 5C：系統設定（Module 7）
//
// Tab 1 - Admin 列表：grant / revoke admin、含自我保護 + 數量保護
// Tab 2 - Audit Log：列出最近 admin 動作、可篩選 action / admin、含 expandable changes JSON
//
// 對應 spec admin-dashboard-spec-v0.1.md §3.7

'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

// ============================================================
// Types
// ============================================================

interface AdminListItem {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  is_self: boolean;
}

interface AuditLogListItem {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// 已知 action 列表（filter dropdown）；未來新 action 加進來
const KNOWN_ACTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'user.grant_admin', label: '升 admin' },
  { value: 'user.revoke_admin', label: '撤 admin' },
  { value: 'user.suspend', label: '停權 user' },
  { value: 'user.unsuspend', label: '解除停權' },
  { value: 'user.update_mbti', label: '改 MBTI' },
  { value: 'user.update', label: '更新 user 資料' },
  { value: 'user.delete', label: '刪除 user' },
  { value: 'course.edit_day', label: '編輯課程內容' },
  { value: 'conversation.view', label: '查看對話' },
  { value: 'invite.create_batch', label: '批次建立邀請碼' },
  { value: 'invite.revoke', label: '停用邀請碼' },
  { value: 'spec.view', label: '查看規格文件' },
  { value: 'prompts.view', label: '查看 AI Prompt 程式碼' },
];

const ACTION_LABEL = new Map(KNOWN_ACTIONS.map(a => [a.value, a.label]));

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ============================================================
// Main component
// ============================================================

type TabId = 'admins' | 'audit';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('admins');

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 系統設定</h1>
        <p className="text-sm text-gray-500 mt-1">Admin 列表管理 + Audit Log 查看</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5 flex gap-1">
        <TabButton active={activeTab === 'admins'} onClick={() => setActiveTab('admins')}>
          👤 Admin 列表
        </TabButton>
        <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')}>
          📝 Audit Log
        </TabButton>
      </div>

      {activeTab === 'admins' ? <AdminsTab /> : <AuditTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
        active
          ? 'border-primary-600 text-primary-700 font-medium bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================
// Tab 1: Admin 列表
// ============================================================

function AdminsTab() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grant form state
  const [grantEmail, setGrantEmail] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantMessage, setGrantMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Revoke confirm state
  const [revokeTarget, setRevokeTarget] = useState<AdminListItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/admins');
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
      setAdmins(json.data.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!grantEmail.trim() || granting) return;
    setGranting(true);
    setGrantMessage(null);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: grantEmail.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '升 admin 失敗');
      if (json.data?.already_admin) {
        setGrantMessage({ type: 'success', text: `${grantEmail} 已經是 admin 了` });
      } else {
        setGrantMessage({ type: 'success', text: `已將 ${grantEmail} 升為 admin` });
      }
      setGrantEmail('');
      fetchAdmins();
    } catch (err) {
      setGrantMessage({ type: 'error', text: err instanceof Error ? err.message : '升 admin 失敗' });
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/admins/${revokeTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '撤銷失敗');
      setRevokeTarget(null);
      fetchAdmins();
    } catch (err) {
      alert((err instanceof Error ? err.message : '撤銷失敗'));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Grant form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-2">+ 升 admin</h2>
        <p className="text-xs text-gray-500 mb-3">
          輸入該 user 的 email、必須是已註冊的帳號。
        </p>
        <form onSubmit={handleGrant} className="flex gap-2">
          <input
            type="email"
            value={grantEmail}
            onChange={e => setGrantEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={granting}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-500 outline-none disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={granting || grantEmail.trim() === ''}
            className="text-sm px-4 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {granting ? '處理中⋯' : '升 admin'}
          </button>
        </form>
        {grantMessage && (
          <div
            className={`mt-3 text-xs px-3 py-2 rounded ${
              grantMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {grantMessage.type === 'success' ? '✅' : '⚠️'} {grantMessage.text}
          </div>
        )}
      </div>

      {/* Admin list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            目前 admin 名單（{admins.length}）
          </h2>
          <button
            onClick={fetchAdmins}
            disabled={loading}
            className="text-xs text-primary-600 hover:underline disabled:opacity-50"
          >
            重新整理
          </button>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">載入中⋯</div>
        ) : error ? (
          <div className="px-4 py-4 bg-red-50 text-red-700 text-sm">⚠️ {error}</div>
        ) : admins.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">尚無 admin（不可能、至少要有你）</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-40">加入時間</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-32">動作</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">
                    {a.email}
                    {a.is_self && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700">
                        你
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.name || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatFullTime(a.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {a.is_self ? (
                      <span className="text-xs text-gray-400">（不可撤自己）</span>
                    ) : (
                      <button
                        onClick={() => setRevokeTarget(a)}
                        className="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded"
                      >
                        撤銷
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revoke confirm dialog */}
      {revokeTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !revoking && setRevokeTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-800 mb-2">
              確認撤銷 admin 權限
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              撤銷後、<span className="font-mono">{revokeTarget.email}</span> 將無法登入後台。
              此動作會記錄到 audit log。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRevokeTarget(null)}
                disabled={revoking}
                className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {revoking ? '撤銷中⋯' : '確認撤銷'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 2: Audit Log
// ============================================================

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterAdminId, setFilterAdminId] = useState('');

  // Admin list for filter dropdown
  const [adminList, setAdminList] = useState<AdminListItem[]>([]);

  // Expanded changes row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 載入 admin 名單（filter dropdown 用）
  useEffect(() => {
    fetch('/api/admin/admins')
      .then(r => r.json())
      .then(json => {
        if (json.data?.admins) setAdminList(json.data.admins);
      })
      .catch(() => { /* 失敗就 dropdown 沒選項、不阻塞 */ });
  }, []);

  const fetchLogs = useCallback(async (cursor: string | null = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (filterAdminId) params.set('admin_user_id', filterAdminId);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');

      if (cursor) {
        setLogs(prev => [...prev, ...json.data.logs]);
      } else {
        setLogs(json.data.logs);
      }
      setHasMore(json.data.has_more);
      setNextCursor(json.data.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterAction, filterAdminId]);

  // Filter 變動時重抓
  useEffect(() => {
    fetchLogs(null);
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Action：</span>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            {KNOWN_ACTIONS.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Admin：</span>
          <select
            value={filterAdminId}
            onChange={e => setFilterAdminId(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
          >
            <option value="">全部</option>
            {adminList.map(a => (
              <option key={a.id} value={a.id}>{a.email}</option>
            ))}
          </select>
        </div>
        {(filterAction || filterAdminId) && (
          <button
            onClick={() => { setFilterAction(''); setFilterAdminId(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 ml-2"
          >
            清除篩選
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {logs.length} 筆{hasMore ? '+（還有更多）' : ''}
        </span>
      </div>

      {/* Logs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">載入中⋯</div>
        ) : error ? (
          <div className="px-4 py-4 bg-red-50 text-red-700 text-sm">⚠️ {error}</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">沒有符合條件的紀錄</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-40">時間</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Admin</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-32">動作</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-44">Target</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">變更</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const expanded = expandedId === log.id;
                const hasChanges = log.changes && Object.keys(log.changes).length > 0;
                return (
                  <Fragment key={log.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                        {formatFullTime(log.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        {log.admin_email ? (
                          <>
                            <div className="text-gray-800 text-xs">{log.admin_email}</div>
                            {log.admin_name && (
                              <div className="text-gray-400 text-[10px]">{log.admin_name}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs italic">已刪除 user</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-700 font-mono">
                          {ACTION_LABEL.get(log.action) || log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {log.target_type && log.target_id ? (
                          <>
                            <span className="text-gray-500">{log.target_type}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span className="font-mono text-[11px]" title={log.target_id}>
                              {/* UUID 一律 slice 前 8 字、短字串（譬如 'spec' / 'build-context' / day_number）直接顯示完整 */}
                              {log.target_id.length > 12 ? log.target_id.slice(0, 8) + '…' : log.target_id}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {hasChanges ? (
                          <button
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            {expanded ? '收合' : '展開'}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    {expanded && hasChanges && (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <td colSpan={5} className="px-3 py-3">
                          <pre className="text-[11px] bg-white border border-gray-200 p-3 rounded overflow-x-auto text-gray-700">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                          {(log.ip_address || log.user_agent) && (
                            <div className="mt-2 text-[10px] text-gray-400 flex gap-4">
                              {log.ip_address && <span>IP: {log.ip_address}</span>}
                              {log.user_agent && (
                                <span className="truncate" title={log.user_agent}>
                                  UA: {log.user_agent.slice(0, 80)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => fetchLogs(nextCursor)}
            disabled={loadingMore}
            className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md disabled:opacity-50"
          >
            {loadingMore ? '載入中⋯' : '載入更多'}
          </button>
        </div>
      )}
    </div>
  );
}
