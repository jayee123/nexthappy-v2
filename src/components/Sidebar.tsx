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

// v1.5.x: 練習 tab 顯示所有 rounds 用（Pearl 7/16 事件之後補的 UX）
export interface JourneySummary {
  id: string;
  round_label: string | null;
  round_number: number | null;
  partner_nickname: string | null;
  relationship_type: string | null;
  current_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  /** v1.3.3d：點 Day grid / arrow 切換。v1.5.x 加 journeyId — 有值代表切到歷史輪次的某天 */
  onSwitchDay?: (day: number, journeyId?: string) => void;
  /** v1.5.x：目前正在看哪一輪（null = 當前 active journey）、用來決定 Day grid 的 highlight */
  viewingJourneyId?: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  refreshKey: number;
}

/** v1.5.x：手風琴展開狀態用的特殊 key，代表「當前 active 任務」 */
const CURRENT_JOURNEY_KEY = '__current__';

export default function Sidebar(props: SidebarProps) {
  const {
    activeTab, hasJourney, journey, currentDay, viewingDay, currentTopicId,
    onSwitchTopic, onNewTopic, onSwitchDay, collapsed, onToggleCollapse,
    refreshKey, viewingJourneyId,
  } = props;

  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [archivedTopics, setArchivedTopics] = useState<TopicSummary[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // v1.5.x: 練習 tab 所有 rounds 列表（含歷史已完成）
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(false);
  // v1.5.x 7/26：手風琴——同時只展開一個任務的 Day grid。
  //   預設展開「當前任務」（Steve 7/26 拍板）；點歷史任務會自動收合當前的。
  const [expandedJourneyId, setExpandedJourneyId] = useState<string | null>(CURRENT_JOURNEY_KEY);

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

  // v1.5.x: 練習 tab 展開時、載入 all journeys
  const loadJourneys = useCallback(async () => {
    if (activeTab !== 'practice') return;
    setLoadingJourneys(true);
    try {
      const res = await fetch('/api/journey/list');
      const json = await res.json();
      if (json.data?.journeys) {
        setJourneys(json.data.journeys);
      }
    } catch (err) {
      console.error('[Sidebar.loadJourneys]', err);
    } finally {
      setLoadingJourneys(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadJourneys();
  }, [loadJourneys, refreshKey]);

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
    // v1.5.x: 無論有無 active journey、都列出所有 journeys（含歷史）
    // Pearl 事件的核心 fix：Day 21 完成 is_active=false 後、仍要能看歷史

    const activeJourney = journeys.find(j => j.is_active) || journey;
    const pastJourneys = journeys.filter(j => !j.is_active);

    if (!activeJourney && pastJourneys.length === 0) {
      return (
        <div className="p-4 text-sm text-gray-400 text-center">
          還沒開始第 1 輪 21 天練習
          <br />
          <span className="text-xs text-gray-300 mt-1 block">
            點頂部「+」按鈕開始
          </span>
        </div>
      );
    }

    // 沒 active 但有歷史 → 引導開新輪次
    if (!activeJourney && pastJourneys.length > 0) {
      return (
        <div className="p-4 space-y-4">
          <div className="text-sm text-[#5a4530] leading-relaxed">
            🎉 上一輪已完成、點頂部「<span className="text-primary-600 font-bold">+</span>」開始下一輪練習
          </div>
          {renderPastJourneysList(pastJourneys)}
        </div>
      );
    }

    const taskName = activeJourney?.round_label || `跟 ${activeJourney?.partner_nickname || '對方'} 第 ${activeJourney?.round_number || 1} 輪`;
    const dayN = currentDay ?? 0;
    const currentExpanded = expandedJourneyId === CURRENT_JOURNEY_KEY;

    return (
      <div className="p-4 space-y-4">
        {/* 當前任務 — 可收合（預設展開）*/}
        <div>
          <div className="text-xs text-gray-500 mb-1">任務</div>
          <button
            onClick={() => setExpandedJourneyId(currentExpanded ? null : CURRENT_JOURNEY_KEY)}
            className="w-full flex items-start justify-between gap-2 text-left group"
            title={currentExpanded ? '收合每日進度' : '展開每日進度'}
          >
            <span className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-primary-700">
              {taskName}
            </span>
            <span
              className={`text-primary-600 text-[10px] shrink-0 mt-1 transition-transform ${
                currentExpanded ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
          </button>
        </div>

        {currentExpanded && (
          <>
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
              {renderDayGrid(dayN, null)}
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                點任一 Day 看完整對話、點當前 Day 回練習模式
              </p>
            </div>
          </>
        )}

        {/* v1.5.x: 歷史 rounds 列表（有的話）*/}
        {pastJourneys.length > 0 && renderPastJourneysList(pastJourneys)}
      </div>
    );
  }

  /**
   * v1.5.x 7/26：Day grid（當前輪次與歷史輪次共用）
   * @param maxDay      該輪次進行到第幾天（可點的上限）
   * @param journeyId   null = 當前 active journey；有值 = 歷史輪次
   */
  function renderDayGrid(maxDay: number, journeyId: string | null) {
    const isViewingThisJourney = journeyId
      ? viewingJourneyId === journeyId
      : !viewingJourneyId;

    return (
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 22 }, (_, i) => i).map(d => {
          const isCurrentDay = d === maxDay;
          const isPast = d < maxDay;
          const isFuture = d > maxDay;
          // 只有「正在看的那一輪」才顯示 highlight、避免兩輪同時亮起
          const isViewing =
            isViewingThisJourney &&
            (viewingDay !== null && viewingDay !== undefined ? d === viewingDay : isCurrentDay);
          const clickable = (isPast || isCurrentDay) && !!onSwitchDay;
          return (
            <button
              key={d}
              disabled={isFuture || !clickable}
              onClick={() => clickable && onSwitchDay?.(d, journeyId ?? undefined)}
              className={`text-xs py-1.5 rounded font-medium transition-all ${
                isViewing
                  ? 'bg-primary-600 text-white shadow-sm'
                  : isPast || isCurrentDay
                    ? 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700 cursor-pointer'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
              title={
                isViewing ? `正在看 Day ${d}` :
                isPast ? `點看 Day ${d} 對話` :
                isCurrentDay ? (journeyId ? `看 Day ${d}` : `回到當前 Day ${d}`) :
                `Day ${d}（未開始）`
              }
            >
              {d}
            </button>
          );
        })}
      </div>
    );
  }

  // v1.5.x: 歷史 rounds 列表 sub-render
  function renderPastJourneysList(pastJourneys: JourneySummary[]) {
    return (
      <div className="pt-2 border-t border-[#f6bf8e]/30">
        <div className="text-xs text-gray-500 mb-2">歷史任務</div>
        <div className="space-y-1.5">
          {pastJourneys.map(pj => {
            const name = pj.round_label || `跟 ${pj.partner_nickname || '對方'} 第 ${pj.round_number || 1} 輪`;
            const relLabel = pj.relationship_type === 'couple' ? '情侶' :
                             pj.relationship_type === 'parent_child' ? '親子' :
                             pj.relationship_type === 'workplace' ? '職場' : '';
            const isExpanded = expandedJourneyId === pj.id;
            return (
              <div
                key={pj.id}
                className={`rounded-lg border transition-colors ${
                  isExpanded
                    ? 'border-primary-300 bg-primary-50/40'
                    : 'border-[#f6bf8e]/25 bg-white'
                }`}
              >
                {/* 任務標題列 — 點擊展開 / 收合該輪次的 Day grid */}
                <button
                  onClick={() => setExpandedJourneyId(isExpanded ? null : pj.id)}
                  className="w-full text-left px-3 py-2 group flex items-start justify-between gap-2"
                  title={isExpanded ? '收合' : `展開「${name}」的每日進度`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#38261e] group-hover:text-primary-700 truncate">
                      {name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                      {relLabel && <span>{relLabel}</span>}
                      <span>Day {pj.current_day}/21</span>
                      <span className="text-primary-600 font-medium">✓ 已完成</span>
                    </span>
                  </span>
                  <span
                    className={`text-primary-600 text-[10px] shrink-0 mt-1 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {/* 展開後：該輪次的 Day grid、點任一 Day 回溯當天對話 */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    {renderDayGrid(pj.current_day, pj.id)}
                    <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
                      點任一 Day 看這輪當天的完整對話
                    </p>
                  </div>
                )}
              </div>
            );
          })}
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
              // v1.5.x 7/26：IME 組字中按 Enter 是「確認選字」、不該送出（同 chat input fix）
              const composing = e.nativeEvent.isComposing || e.keyCode === 229;
              if (e.key === 'Enter' && !composing) onSubmitRename?.();
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
