// 放置路徑：src/app/admin/spec/page.tsx
//
// Week 5 Session 5D：規格文件 viewer
// 渲染 docs/v2.1-course-spec.md、左側 TOC 可跳轉、Trade Secret banner。

'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TradeSecretBanner from '@/components/admin/TradeSecretBanner';

interface TocItem {
  level: 2 | 3;
  text: string;
  anchor: string;
  lineNumber: number;
}

interface SpecData {
  file_id: string;
  relative_path: string;
  type: 'markdown';
  content: string;
  toc: TocItem[] | null;
  line_count: number;
  char_count: number;
}

export default function AdminSpecPage() {
  const [data, setData] = useState<SpecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpec() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/docs/spec');
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || '讀取失敗');
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '讀取失敗');
      } finally {
        setLoading(false);
      }
    }
    fetchSpec();
  }, []);

  if (loading) return <div className="p-6 lg:p-8 text-gray-400">載入中⋯</div>;

  if (error || !data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          ⚠️ {error || '找不到規格文件'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">📜 規格文件</h1>
        <p className="text-xs text-gray-500 mt-1 font-mono">
          {data.relative_path} · {data.line_count.toLocaleString()} 行 · {data.char_count.toLocaleString()} 字元
        </p>
      </div>

      <TradeSecretBanner pageType="spec" />

      <div className="flex gap-6">
        {/* TOC sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">目錄</h2>
          {data.toc && data.toc.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {data.toc.map((item, i) => (
                <li
                  key={i}
                  className={item.level === 3 ? 'pl-3' : ''}
                >
                  <a
                    href={`#${item.anchor}`}
                    className="text-gray-600 hover:text-primary-700 hover:underline block py-0.5 text-xs leading-tight"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-gray-400">無目錄</div>
          )}
        </aside>

        {/* Content */}
        <article className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg p-6 lg:p-8 prose prose-sm max-w-none">
          <MarkdownRenderer content={data.content} />
        </article>
      </div>
    </div>
  );
}

// ---------------------------------------------------
// Markdown renderer with Tailwind-friendly styling
// ---------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getChildText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getChildText).join('');
  return '';
}

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => {
          const id = slugify(getChildText(children));
          return <h1 id={id} className="text-2xl font-bold text-gray-800 mt-6 mb-4 pb-2 border-b border-gray-200 scroll-mt-4">{children}</h1>;
        },
        h2: ({ children }) => {
          const id = slugify(getChildText(children));
          return <h2 id={id} className="text-xl font-bold text-gray-800 mt-8 mb-3 scroll-mt-4">{children}</h2>;
        },
        h3: ({ children }) => {
          const id = slugify(getChildText(children));
          return <h3 id={id} className="text-base font-semibold text-gray-700 mt-5 mb-2 scroll-mt-4">{children}</h3>;
        },
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-sm text-gray-700 list-disc list-inside mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-gray-700 list-decimal list-inside mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary-200 bg-primary-50/40 pl-4 py-2 my-3 text-sm text-gray-700 italic">{children}</blockquote>
        ),
        code: ({ children, className }) => {
          // Inline code（無 className）
          if (!className) {
            return <code className="bg-gray-100 text-rose-700 px-1.5 py-0.5 rounded text-[0.85em] font-mono">{children}</code>;
          }
          return <code className={className}>{children}</code>;
        },
        pre: ({ children }) => (
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs mb-3 leading-snug">{children}</pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
        th: ({ children }) => (
          <th className="border border-gray-300 px-2 py-1.5 text-left font-medium text-gray-700">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-2 py-1.5 text-gray-700 align-top">{children}</td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="text-primary-600 hover:underline"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-6 border-gray-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
