// 放置路徑：src/app/admin/roadmap/page.tsx
//
// 未來規劃：尚未開發的功能提案列表。
// 每個提案是一份獨立文件（存在 public/roadmap/*.html），管理者可以點進去
// 看完整的架構選項、資料流程、後台介面草稿，選擇題直接嵌在文件裡。
// 這裡先放「多語言處理」一項，之後有新提案（差異化定價、商家範本等）
// 用同樣的模式加卡片即可。

import Link from 'next/link';

interface RoadmapItem {
  slug: string;
  title: string;
  summary: string;
  status: '待決策' | '規劃中' | '開發中';
  icon: string;
}

const ITEMS: RoadmapItem[] = [
  {
    slug: 'i18n',
    title: '多語言處理',
    summary:
      '公版／私版後台支援多語系介面與課程教材翻譯，管理者可自行編輯專有名詞。內含架構選項、翻譯資料流程、後台介面草稿與待決策的選擇題。',
    status: '待決策',
    icon: '🌐',
  },
  {
    slug: 'pricing',
    title: '差異化定價',
    summary:
      '基礎定價、成本權重（語音／圖片消耗）、特殊功能加值三個維度，加上統一／個別調漲調降機制。內含可勾選欄位、即時看到後台介面的互動模擬器。',
    status: '待決策',
    icon: '💰',
  },
];

const STATUS_STYLE: Record<RoadmapItem['status'], string> = {
  待決策: 'bg-amber-50 text-amber-700 border-amber-200',
  規劃中: 'bg-blue-50 text-blue-700 border-blue-200',
  開發中: 'bg-primary-50 text-primary-700 border-primary-200',
};

export default function AdminRoadmapPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🗓 未來規劃</h1>
        <p className="text-sm text-gray-500 mt-1">
          尚未開發的功能提案。每份文件都寫清楚了架構選項與後果，看完可以直接決定，不用再開會來回討論。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <Link
            key={item.slug}
            href={`/admin/roadmap/${item.slug}`}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-2xl">{item.icon}</div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[item.status]}`}
              >
                {item.status}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">{item.title}</h2>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{item.summary}</p>
            <div className="text-xs text-primary-600 mt-3 font-medium">看提案文件 →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
