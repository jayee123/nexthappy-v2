// 放置路徑：src/app/admin/conversations/[id]/page.tsx
//
// Week 4 Session 4B：對話詳情頁
//
// 內容：
//   - Header：context badge、Day、主題、archived 狀態
//   - Context card：user / journey / 時間 / 訊息數
//   - 動作按鈕：跳 user / journey 詳情
//   - Message thread：chat bubble 渲染、user 右、AI 左
//   - mini markdown 處理 **bold**
//
// v1.4.x (Issue 2)：admin 也過濾掉「注入為 user role 的 system trigger prompt」、
//   跟前台 /chat、PDF export 一致、不顯示 implementation plumbing。
//   要 debug trigger prompt 內容請看 src/app/chat/page.tsx triggerPracticeOpening()。

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  role: string;
  content: string;
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

const CONTEXT_BADGE: Record<string, { label: string; cls: string }> = {
  morning: { label: '🌅 晨間練習', cls: 'bg-orange-50 text-orange-700' },
  evening: { label: '🌙 晚間回顧', cls: 'bg-indigo-50 text-indigo-700' },
  consultant: { label: '💬 Mode B 諮詢', cls: 'bg-purple-50 text-purple-700' },
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  couple: '伴侶',
  parent_child: '親子',
  workplace: '職場',
};

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// v1.4.x (Issue 2)：偵測 AI trigger prompt（與 chat/page.tsx + export/conversation 一致）
//   Day 0 trigger 開頭到「請」約 50 字、{0,200} 涵蓋所有 Day 0/1/2+ trigger 變體
function isAITriggerPrompt(msg: Message): boolean {
  if (msg.role !== 'user') return false;
  const content = msg.content || '';
  return /^今天是.{0,200}請/.test(content);
}

// Mini markdown: 處理 **bold**
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AdminConversationDetailPage() {
  const params = useParams();
  const convId = params.id as string;

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/conversations/${convId}`);
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '查詢失敗');
        setDetail(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '查詢失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [convId]);

  if (loading) {
    return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/admin/conversations" className="text-sm text-primary-600 hover:underline">
          ← 回對話歷史
        </Link>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '找不到此對話'}
        </div>
      </div>
    );
  }

  const badge = detail.context_type ? CONTEXT_BADGE[detail.context_type] : null;
  const isMultiDay = detail.updated_at && detail.created_at &&
    detail.updated_at.slice(0, 10) !== detail.created_at.slice(0, 10);

  // v1.4.x (Issue 2)：過濾掉注入的 system trigger prompt、admin 視角跟 user 一致
  const visibleMessages = detail.messages.filter(m => !isAITriggerPrompt(m));

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <Link href="/admin/conversations" className="text-sm text-primary-600 hover:underline">
        ← 回對話歷史
      </Link>

      {/* Header */}
      <div className="mt-4 mb-5">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          {badge && (
            <span className={`inline-flex items-center px-3 py-1 rounded text-sm ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          <span className="text-gray-700 text-sm font-medium">Day {detail.day_number}</span>
          {detail.archived_at && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
              已歸檔 {formatFullTime(detail.archived_at)}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-800">
          {detail.topic_title || `Day ${detail.day_number} 對話`}
        </h1>
      </div>

      {/* Context Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="text-xs text-gray-400 mb-1">User</div>
          <div className="text-gray-800">
            {detail.user_name || detail.user_email.split('@')[0]}
            {detail.user_mbti_self && (
              <span className="ml-2 text-xs text-gray-400 font-mono">({detail.user_mbti_self})</span>
            )}
          </div>
          <div className="text-xs text-gray-400">{detail.user_email}</div>
        </div>
        {detail.journey_id ? (
          <div>
            <div className="text-xs text-gray-400 mb-1">Journey 脈絡</div>
            <div className="text-gray-700">
              {detail.journey_relationship_type && RELATIONSHIP_LABEL[detail.journey_relationship_type]}
              {detail.journey_round_number && <span className="text-xs text-gray-400 ml-2">第 {detail.journey_round_number} 輪</span>}
              {detail.journey_partner_nickname && (
                <span className="ml-2">· {detail.journey_partner_nickname}</span>
              )}
              {detail.journey_mbti_partner && (
                <span className="ml-1 text-xs text-gray-400 font-mono">({detail.journey_mbti_partner})</span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-400 mb-1">Journey 脈絡</div>
            <div className="text-gray-500 text-xs">無綁定 journey（自由對話）</div>
          </div>
        )}
        <div>
          <div className="text-xs text-gray-400 mb-1">建立時間</div>
          <div className="text-gray-700">{formatFullTime(detail.created_at)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">最後更新</div>
          <div className="text-gray-700">
            {detail.updated_at ? formatFullTime(detail.updated_at) : '—'}
            {isMultiDay && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700">
                跨日對話
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action links */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href={`/admin/users/${detail.user_id}`}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
        >
          查看用戶資料 →
        </Link>
        {detail.journey_id && (
          <Link
            href={`/admin/journeys/${detail.journey_id}`}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
          >
            查看 Journey 詳情 →
          </Link>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">
          共 {visibleMessages.length} 則訊息
        </span>
      </div>

      {/* Message thread */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6 space-y-5">
        {visibleMessages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">無訊息</div>
        ) : (
          visibleMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  <div className="text-xs text-gray-400 mb-1 px-1">
                    {isUser ? '👤 User' : '🌟 AI Tutor'}
                  </div>
                  <div
                    className={`px-4 py-3 rounded-lg whitespace-pre-wrap text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary-50 text-gray-800 border border-primary-100'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}