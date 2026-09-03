// 放置路徑：src/app/admin/roadmap/[slug]/page.tsx
//
// 未來規劃提案文件的檢視頁。文件本身是獨立設計的靜態 HTML
// （public/roadmap/<slug>.html，有自己的字體/配色/深淺色主題），
// 用 iframe 嵌入而不是轉成 React 元件——避免跟後台自己的 Tailwind
// 樣式互相污染，也讓文件保留原本完整的排版與圖表。
//
// notFound() 白名單只放目前存在的提案，避免 iframe 對到不存在的檔案。

import { notFound } from 'next/navigation';
import Link from 'next/link';

const KNOWN_SLUGS: Record<string, { title: string; file: string }> = {
  i18n: { title: '多語言處理', file: 'i18n-plan.html' },
  pricing: { title: '差異化定價', file: 'pricing-plan.html' },
};

export default function RoadmapDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const entry = KNOWN_SLUGS[slug];
  if (!entry) notFound();

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 lg:px-8 py-3 border-b border-gray-200 bg-white flex items-center gap-3 shrink-0">
        <Link href="/admin/roadmap" className="text-sm text-gray-500 hover:text-gray-700">
          ← 未來規劃
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-800">{entry.title}</span>
      </div>
      <iframe
        src={`/roadmap/${entry.file}`}
        title={entry.title}
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
