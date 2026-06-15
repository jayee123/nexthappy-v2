// 放置路徑：src/components/Sidebar.tsx
//
// v1.3.7 重寫：純 overlay sidebar（不再有 inline w-12 icon column）
//
// Layout pattern：
//   - collapsed 狀態：完全不渲染（不佔任何 layout 空間）
//   - 展開狀態：fixed positioned panel + backdrop overlay 蓋在 main 上
//   - sidebar toggle / 新主題 button 由 chat header 提供（不再 self-host）
//
// Mode A「21 天練習」：任務 title + Day X / 21 + 進度條 + Day grid（v1.3.3d 補 click 載歷史）
// Mode B「我卡住，幫我拆」：列 topics + 新主題 + archive folder + rename / archive 互動

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Journey } from '@/types';

type ActiveTab = 'practice' | 'consultant';

export interface TopicSummary {
  id: string;
  topic_title: string;
  topic_started_at: string;
  archived_at: string | null;
  message_count: number;
  last_updated_at: string;
}

interface SidebarProps {
  activeTab: ActiveTab;
  hasJourney: boolean;
  journey?: Journey | null;
  currentDay?: number | null;
  viewingDay?: number | null;       // v1.3.3d：當前 sidebar/main 在看的 Day（null = 當前 currentDay）
  currentTopicId: string | null;
  onSwitchTopic: (topicId: string) => void;
  onNewTopic: () => void;
  onSwitchDay?: (day: number) => void;  // v1.3.3d：點 Day grid / arrow 切換
  collapsed: boolean;
  onToggleCollapse: () => void;
  refreshKey: number;
}

export default function Sidebar(props: SidebarProps) {
  const {
    activeTab, hasJourney, journey, currentDay, viewingDay, currentTopicId,
    onSwitchTopic, onNewTopic, onSwitchDay, collapsed, onToggleCollapse,
    refreshKey,
  } = props;

  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [archivedTopics, setArchivedTopics] = useState<TopicSummary[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    if (activeTab !== 'consultant') return;
    // v1.3.4：trier 模式（無 journey）也可以列 topics、不再受 hasJourney 限制
    setLoadingTopics(true);
    try {
      const [activeRes, allRes] = await Promise.all([
        fetch('/api/ai/consultant?list=true').then(r => r.json()),
        fetch('/api/ai/consultant?list=true&include_archived=true').then(r => r.json()),
      ]);
      setTopics(activeRes.topics || []);
      const archived = (allRes.topics || []).filter((t: TopicSummary) => t.archived_at);
      setArchivedTopics(archived);
    } catch (err) {
      console.error('[Sidebar.loadTopics]', err);
    } finally {
      setLoadingTopics(false);
    }
  }, [activeTab, hasJourney]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics, refreshKey]);

  async function handleArchive(topicId: string, archive: boolean) {
    try {
      await fetch('/api/ai/consultant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, archive }),
      });
      setMenuOpenId(null);
      loadTopics();
    } catch (err) {
      console.error('[Sidebar.handleArchive]', err);
    }
  }

  async function handleRename(topicId: string) {
    const title = renameText.trim();
    if (!title) {
      setRenameId(null);
      return;
    }
    try {
      await fetch('/api/ai/consultant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, topic_title: title }),
      });
      setRenameId(null);
      loadTopics();
    } catch (err) {
      console.error('[Sidebar.handleRename]', err);
    }
  }

  function startRename(topic: TopicSummary) {
    setRenameId(topic.id);
    setRenameText(topic.topic_title);
    setMenuOpenId(null);
  }

  // ──────────────────────────────────────────────────────────
  // Layout：always icon column + overlay panel when expanded
  // ──────────────────────────────────────────────────────────

  // v1.3.7: collapsed → 完全不渲染、不佔 layout 空間
  if (collapsed) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onToggleCollapse}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-200 z-40 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-800">
            {activeTab === 'practice' ? '🌱 21 天進度' : '🤝 諮詢主題'}
          </span>
          <button
            onClick={onToggleCollapse}
            title="收合"
            className="text-gray-400 hover:text-gray-600 text-lg w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'practice' ? renderPracticeSidebar() : renderConsultantSidebar()}
        </div>
      </div>
    </>
  );

  // ──────────────────────────────────────────────────────────
  // Mode A sidebar：21 天進度 + 任務 + Day grid
  // ──────────────────────────────────────────────────────────
  function renderPracticeSidebar() {
    if (!hasJourney) {
      return (
        <div className="p-4 text-sm text-gray-400 text-center">
          還沒開始第 1 輪 21 天練習
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            從右邊「開始第 1 輪」進去
          </span>
        </div>
      );
    }

    const taskName = journey?.round_label || `跟 ${journey?.partner_nickname || '對方'} 第 ${journey?.round_number || 1} 輪`;
    const dayN = currentDay ?? 0;

    return (
      <div className="p-4 space-y-4">
        {/* 任務 title */}
        <div>
          <div className="text-xs text-gray-500 mb-1">任務</div>
          <div className="text-sm font-semibold text-gray-800 leading-snug">
            {taskName}
          </div>
        </div>

        {/* 當前 Day + progress bar */}
        <div className="bg-primary-50 rounded-xl p-3">
          <div className="text-xs text-primary-600 font-medium">當前</div>
          <div className="text-2xl font-bold text-primary-700 mt-0.5">
            Day {dayN}
            <span className="text-sm font-normal text-primary-400 ml-1">/ 21</span>
          </div>
          <div className="mt-2 bg-white rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((dayN) / 21) * 100)}%` }}
            />
          </div>
        </div>

        {/* Day grid（Day 0-21、v1.3.3d 加 onClick 載歷史） */}
        <div>
          <div className="text-xs text-gray-500 mb-2">每日進度</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 22 }, (_, i) => i).map(d => {
              const isCurrent = d === dayN;
              const isPast = d < dayN;
              const isFuture = d > dayN;
              const isViewing = viewingDay !== null && viewingDay !== undefined ? d === viewingDay : isCurrent;
              const clickable = (isPast || isCurrent) && !!onSwitchDay;
              return (
                <button
                  key={d}
                  disabled={isFuture || !clickable}
                  onClick={() => clickable && onSwitchDay?.(d)}
                  className={`text-xs py-1.5 rounded font-medium transition-all ${
                    isViewing
                      ? 'bg-primary-600 text-white shadow-sm'
                      : isPast || isCurrent
                        ? 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700 cursor-pointer'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                  title={
                    isViewing ? `正在看 Day ${d}` :
                    isPast ? `點看 Day ${d} 歷史對話` :
                    isCurrent ? `回到當前 Day ${d}` :
                    `Day ${d}（未開始）`
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            點任一 Day 看完整對話、點當前 Day 回練習模式
          </p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Mode B sidebar：諮詢主題列表
  // ──────────────────────────────────────────────────────────
  function renderConsultantSidebar() {
    // v1.3.4：trier 模式（無 journey）也可以列 topics、不再顯「不持久化」placeholder
    return (
      <div className="p-3 space-y-3">
        {/* 新主題按鈕 */}
        <button
          onClick={() => { onNewTopic(); setMenuOpenId(null); }}
          className="w-full py-2 px-3 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center justify-center gap-1"
        >
          <span>＋</span>
          <span>新主題</span>
        </button>

        {loadingTopics ? (
          <div className="text-xs text-gray-400 text-center py-3">載入中⋯</div>
        ) : topics.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3 leading-relaxed">
            還沒主題
            <br />
            開始對話、小羽自動幫你命名
          </div>
        ) : (
          <ul className="space-y-1">
            {topics.map(t => (
              <TopicItem
                key={t.id}
                topic={t}
                isActive={t.id === currentTopicId}
                isRenaming={renameId === t.id}
                renameText={renameText}
                onChangeRenameText={setRenameText}
                onSwitch={() => onSwitchTopic(t.id)}
                onStartRename={() => startRename(t)}
                onSubmitRename={() => handleRename(t.id)}
                onCancelRename={() => setRenameId(null)}
                onArchive={() => handleArchive(t.id, true)}
                menuOpen={menuOpenId === t.id}
                onToggleMenu={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
              />
            ))}
          </ul>
        )}

        {archivedTopics.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowArchive(v => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 px-1"
            >
              <span>📁 已封存（{archivedTopics.length}）</span>
              <span>{showArchive ? '▼' : '▶'}</span>
            </button>
            {showArchive && (
              <ul className="space-y-1 mt-2">
                {archivedTopics.map(t => (
                  <TopicItem
                    key={t.id}
                    topic={t}
                    isActive={t.id === currentTopicId}
                    isArchivedView
                    onSwitch={() => onSwitchTopic(t.id)}
                    onRestore={() => handleArchive(t.id, false)}
                    menuOpen={menuOpenId === t.id}
                    onToggleMenu={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }
}

// ──────────────────────────────────────────────────────────
// TopicItem
// ──────────────────────────────────────────────────────────

interface TopicItemProps {
  topic: TopicSummary;
  isActive: boolean;
  isArchivedView?: boolean;
  isRenaming?: boolean;
  renameText?: string;
  menuOpen?: boolean;
  onSwitch: () => void;
  onChangeRenameText?: (s: string) => void;
  onStartRename?: () => void;
  onSubmitRename?: () => void;
  onCancelRename?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onToggleMenu?: () => void;
}

function TopicItem(props: TopicItemProps) {
  const {
    topic, isActive, isArchivedView,
    isRenaming, renameText, menuOpen,
    onSwitch, onChangeRenameText, onStartRename, onSubmitRename, onCancelRename,
    onArchive, onRestore, onToggleMenu,
  } = props;

  return (
    <li
      className={`group relative rounded-lg ${
        isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
      }`}
    >
      {isRenaming ? (
        <div className="flex items-center gap-1 p-2">
          <input
            type="text"
            value={renameText || ''}
            onChange={e => onChangeRenameText?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSubmitRename?.();
              if (e.key === 'Escape') onCancelRename?.();
            }}
            autoFocus
            maxLength={30}
            className="flex-1 text-sm px-2 py-1 border border-primary-300 rounded outline-none"
          />
          <button
            onClick={onSubmitRename}
            className="text-xs text-primary-600 px-1.5 py-1 hover:bg-primary-100 rounded"
            title="儲存（Enter）"
          >
            ✓
          </button>
          <button
            onClick={onCancelRename}
            className="text-xs text-gray-400 px-1.5 py-1 hover:bg-gray-100 rounded"
            title="取消（Esc）"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex items-center px-2 py-1.5">
          <button
            onClick={onSwitch}
            className={`flex-1 text-left text-sm truncate ${
              isActive ? 'text-primary-700 font-medium' : 'text-gray-700'
            }`}
            title={topic.topic_title}
          >
            {topic.topic_title}
            <span className="ml-1 text-[10px] text-gray-400">
              ({topic.message_count})
            </span>
          </button>

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMenu?.(); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded"
              title="更多"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[100px] py-1">
                {isArchivedView ? (
                  <>
                    <button
                      onClick={() => window.open(`/export/conversation/${topic.id}?autoprint=1`, '_blank')}
                      className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    >
                      📄 匯出 PDF
                    </button>
                    <button
                      onClick={onRestore}
                      className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    >
                      🔄 復原
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onStartRename}
                      className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    >
                      ✏️ 重新命名
                    </button>
                    <button
                      onClick={() => window.open(`/export/conversation/${topic.id}?autoprint=1`, '_blank')}
                      className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    >
                      📄 匯出 PDF
                    </button>
                    <button
                      onClick={onArchive}
                      className="w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    >
                      📁 封存
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
