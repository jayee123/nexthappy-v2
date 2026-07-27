// 放置路徑：src/components/MarkdownMessage.tsx
//
// v1.5.x 2026-07-26：AI 訊息的 markdown 渲染器（chat + PDF export 共用）
//
// 起因（內部封測發現）：
//   Pearl 以為 `**` 是「要填空」（因為密碼被碼掉也是用 ***），
//   Jessie 以為 `***` 是「消失的特殊字」，反覆看很多次才理解。
//   Root cause：聊天泡泡原本用 <p whitespace-pre-wrap>{content}</p> 純文字輸出，
//   但 buildContext.ts 的 prompt 本身是 markdown 寫的（425 處 **），
//   AI 自然模仿該風格 → markdown 語法裸露給用戶看。
//
// 解法：渲染 markdown，讓 ** 真的變粗體、> 真的變引言區塊。
//   採用已安裝的 react-markdown + remark-gfm（admin spec viewer 也在用、不新增依賴）。
//
// 樣式對齊 Pearl design system：
//   - blockquote：左邊 3px 橘線 + 淡橘底（#EF9F27）
//   - strong：font-weight 600
//   - 條列：標準 bullet / 數字
//
// ⚠️ 只用在 AI 訊息。User 自己打的字不渲染 markdown（用戶不會寫 markdown，
//    渲染反而可能把他打的 * 或 # 吃掉）。

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
  /** print 模式（PDF export）：拿掉背景色，只留左邊線，避免瀏覽器列印時被濾掉背景 */
  print?: boolean;
  className?: string;
}

/**
 * markdown 規格裡，段落內的單一換行會被吃掉變成空格。
 * 但 AI 輸出常用單換行分行（尤其條列前後），直接渲染會黏成一坨。
 * 這裡把「單獨的 \n」轉成 markdown 硬換行（行尾兩個空格 + \n），保留原本的視覺節奏。
 */
function preserveSingleLineBreaks(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, '$1  \n');
}

/**
 * 把 markdown 語法去掉、只留純文字。
 *
 * 用途：需要 `line-clamp` 截斷的地方（例如收合狀態的課程知識卡片）。
 * markdown 渲染會產生多個 block 元素、`line-clamp` 依賴 -webkit-box 會失效，
 * 所以收合時顯示乾淨純文字、展開才用 <MarkdownMessage> 渲染。
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // 標題 #
    .replace(/^>\s?/gm, '')             // 引言 >
    .replace(/^[-*+]\s+/gm, '')         // 條列符號
    .replace(/^\d+\.\s+/gm, '')         // 數字條列
    .replace(/\*\*(.+?)\*\*/g, '$1')    // 粗體
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1') // 斜體
    .replace(/`(.+?)`/g, '$1')          // 行內 code
    .replace(/^---+$/gm, '')            // 分隔線
    .trim();
}

export default function MarkdownMessage({ content, print = false, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`markdown-message text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>
          ),

          strong: ({ children }) => (
            <strong className="font-semibold text-[#38261e]">{children}</strong>
          ),

          em: ({ children }) => <em className="italic">{children}</em>,

          // 引言區塊 — Pearl 橘色左邊線（Steve 7/26 拍板的 look）
          blockquote: ({ children }) => (
            <blockquote
              className={`my-3 border-l-[3px] border-[#EF9F27] px-3.5 py-2.5 font-medium text-[#38261e] ${
                print ? '' : 'bg-[#EF9F27]/[0.08]'
              }`}
            >
              {children}
            </blockquote>
          ),

          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-base font-bold text-[#38261e] first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 text-[15px] font-bold text-[#38261e] first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-3 text-sm font-bold text-[#38261e] first:mt-0">{children}</h3>
          ),

          hr: () => <hr className="my-3 border-t border-[#38261e]/10" />,

          code: ({ children }) => (
            <code className="rounded bg-[#38261e]/[0.06] px-1 py-0.5 font-mono text-[0.9em]">
              {children}
            </code>
          ),

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#dc7440] underline underline-offset-2"
            >
              {children}
            </a>
          ),

          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[#38261e]/12 bg-[#fbfaf8] px-2 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[#38261e]/12 px-2 py-1.5 align-top">{children}</td>
          ),
        }}
      >
        {preserveSingleLineBreaks(content)}
      </ReactMarkdown>
    </div>
  );
}
