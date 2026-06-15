// 放置路徑：src/app/admin/prompts/page.tsx
//
// Week 5 Session 5D：AI Prompt 程式碼 viewer
//
// 顯示 src/lib/ai/buildContext.ts 解析後的 BLOC sections。
// 三層篩選：全部 / Mode A / Mode B / 共用。
// 每個 BLOC 預設摺疊、點 title 展開看完整內容。
// Trade Secret banner 強制顯示。

'use client';

import { useEffect, useMemo, useState } from 'react';
import TradeSecretBanner from '@/components/admin/TradeSecretBanner';

type SectionKind = 'modeA' | 'modeB' | 'shared' | 'function' | 'comment';

interface ParsedSection {
  id: string;
  name: string;
  kind: SectionKind;
  startLine: number;
  endLine: number;
  preview: string;
  content: string;
  rawContent: string;
}

interface PromptsData {
  file_id: string;
  relative_path: string;
  type: 'typescript';
  content: string;
  sections: ParsedSection[];
  line_count: number;
  char_count: number;
}

type FilterMode = 'all' | 'modeA' | 'modeB' | 'shared';

const KIND_LABEL: Record<SectionKind, { label: string; cls: string }> = {
  modeA: { label: 'Mode A', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  modeB: { label: 'Mode B', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  shared: { label: '共用', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  function: { label: 'Function', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  comment: { label: 'Comment', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function AdminPromptsPage() {
  const [data, setData] = useState<PromptsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFullFile, setShowFullFile] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/docs/build-context');
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '讀取失敗');
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '讀取失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredSections = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.sections;
    return data.sections.filter(s => s.kind === filter);
  }, [data, filter]);

  if (loading) return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;

  if (error || !data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '找不到 prompt 程式碼'}
        </div>
      </div>
    );
  }

  // 統計
  const counts = data.sections.reduce(
    (acc, s) => {
      if (s.kind === 'modeA') acc.modeA++;
      else if (s.kind === 'modeB') acc.modeB++;
      else if (s.kind === 'shared') acc.shared++;
      return acc;
    },
    { modeA: 0, modeB: 0, shared: 0 }
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">🤖 AI Prompt 程式碼</h1>
        <p className="text-xs text-gray-500 mt-1 font-mono">
          {data.relative_path} · {data.line_count.toLocaleString()} 行 · {data.sections.length} BLOC
        </p>
      </div>

      <TradeSecretBanner pageType="prompts" />

      {/* Info card */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        💡 <strong>使用提示</strong>：每個 BLOC 是一段獨立的 AI prompt template、會在不同情境注入到 system prompt。點 BLOC title 展開看完整內容。
        要編輯請改 source code（buildContext.ts）、本頁是唯讀檢視器。
      </div>

      {/* Filter tabs */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">篩選：</span>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 ({data.sections.length})
        </FilterButton>
        <FilterButton active={filter === 'modeA'} onClick={() => setFilter('modeA')}>
          Mode A ({counts.modeA})
        </FilterButton>
        <FilterButton active={filter === 'modeB'} onClick={() => setFilter('modeB')}>
          Mode B ({counts.modeB})
        </FilterButton>
        <FilterButton active={filter === 'shared'} onClick={() => setFilter('shared')}>
          共用 ({counts.shared})
        </FilterButton>
        <span className="ml-auto">
          <button
            onClick={() => setShowFullFile(v => !v)}
            className="text-xs text-primary-600 hover:underline"
          >
            {showFullFile ? '← 回 BLOC 列表' : '查看完整原始檔 →'}
          </button>
        </span>
      </div>

      {/* Section list 或 full file */}
      {showFullFile ? (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
          <pre className="text-[11px] font-mono leading-relaxed">{data.content}</pre>
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
          此分類無 BLOC
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSections.map(section => {
            const expanded = expandedId === section.id;
            const kindInfo = KIND_LABEL[section.kind];
            return (
              <div key={section.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Section header (clickable to toggle) */}
                <button
                  onClick={() => setExpandedId(expanded ? null : section.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-400 text-xs shrink-0">
                    {expanded ? '▼' : '▶'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border shrink-0 ${kindInfo.cls}`}>
                    {kindInfo.label}
                  </span>
                  <code className="text-sm font-mono text-gray-800 shrink-0">{section.name}</code>
                  <span className="text-xs text-gray-400 shrink-0 ml-auto font-mono">
                    L{section.startLine}-{section.endLine}
                  </span>
                </button>

                {/* Preview line（折疊時也顯示） */}
                {!expanded && (
                  <div className="px-4 pb-3 text-xs text-gray-500 truncate font-mono">
                    {section.preview || <span className="italic">（無預覽）</span>}
                  </div>
                )}

                {/* Full content（展開時） */}
                {expanded && (
                  <div className="border-t border-gray-200 bg-gray-900">
                    <pre className="text-[11px] text-gray-100 font-mono leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap">
                      {section.content}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterButton({
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
      className={`px-3 py-1 text-xs rounded-md transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
