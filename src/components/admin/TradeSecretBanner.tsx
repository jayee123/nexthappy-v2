// 放置路徑：src/components/admin/TradeSecretBanner.tsx
//
// Trade Secret 警告 banner、用於 /admin/spec + /admin/prompts 兩個敏感頁面。
// 不可 dismiss、每次進頁都顯示。

'use client';

interface TradeSecretBannerProps {
  pageType: 'spec' | 'prompts';
}

export default function TradeSecretBanner({ pageType }: TradeSecretBannerProps) {
  const subjectText = pageType === 'spec'
    ? '本頁顯示產品完整規格文件、含 AI 行為設計 / 課程方法論 / 商業邏輯'
    : '本頁顯示 AI prompt 完整原始碼、含 Mode A + Mode B 所有規則邏輯';

  return (
    <div className="mb-5 bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">🔒</span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-red-800 mb-1">商業機密內容（Trade Secret）</h3>
          <p className="text-xs text-red-700 mb-2">{subjectText}、屬營業秘密。</p>
          <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
            <li>❌ <strong>不可截圖外流</strong>、不可分享 / 拷貝至個人裝置</li>
            <li>❌ <strong>不可用於訓練第三方 AI</strong> 或交予外部使用</li>
            <li>📝 所有查看會自動記錄到 audit log（含 admin / IP / 時間）</li>
            <li>⚖️ 違反者依保密協議 + 營業秘密法（台灣）處理</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
