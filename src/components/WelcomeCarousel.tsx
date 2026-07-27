/**
 * WelcomeCarousel.tsx
 *
 * 新用戶第一次進 app 的導引頁、6 頁 carousel（Cover + 5 內容頁）。
 *
 * UX 策略：
 * - 註冊完強制顯示一次
 * - 可隨時「跳過」（右上角 ✕）
 * - 看完最後一頁按「開始使用」
 * - 看過後 Settings 仍可回看
 *
 * 元件無 router 邏輯、透過 onComplete callback 通知父層。
 * 父層（/welcome/page.tsx）負責標記 has_seen_intro + redirect。
 *
 * 視覺：對齊 docs/user-guide-v2-mockup.html、改用 Tailwind + 少量 custom color。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface WelcomeCarouselProps {
  /** 用戶按「開始使用」CTA 時呼叫（Page 5 最後一頁）*/
  onComplete: () => void;
  /** 用戶按「跳過 ✕」時呼叫（右上角、可選）— 不傳則 fallback 用 onComplete */
  onSkip?: () => void;
  /** 用戶按「已有帳號？登入」時呼叫（Page 5 small link、可選）— 不傳則不顯示連結 */
  onLogin?: () => void;
  /** 是否顯示「跳過 ✕」按鈕（從 Settings 進來回看時可關掉）*/
  showSkip?: boolean;
  /** 自訂封面圖路徑（預設 /images/welcome/cover.png）*/
  coverImageSrc?: string;
}

const TOTAL_PAGES = 6; // Cover + Page 1-5

export default function WelcomeCarousel({
  onComplete,
  onSkip,
  onLogin,
  showSkip = true,
  // 暫時用 Angel 版 cover.png（完整視覺）、等 Pearl 給文字版 PNG/HTML 再更新
  coverImageSrc = '/images/welcome/cover.png',
}: WelcomeCarouselProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // 「跳過 ✕」實際行為：有 onSkip 用 onSkip、沒有則 fallback 用 onComplete
  const handleSkipAction = onSkip ?? onComplete;

  const goToPage = (idx: number) => {
    setCurrentPage(Math.max(0, Math.min(TOTAL_PAGES - 1, idx)));
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
      if (e.key === 'ArrowRight') goToPage(currentPage + 1);
      if (e.key === 'Escape' && showSkip) handleSkipAction();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPage, handleSkipAction, showSkip]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Only count horizontal swipe (not vertical scroll)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    }
    touchStartRef.current = null;
  };

  const isLastPage = currentPage === TOTAL_PAGES - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-0 sm:p-5">
      <div
        className="phone-frame relative w-full max-w-[430px] overflow-hidden sm:rounded-[40px] sm:shadow-2xl"
        style={{
          aspectRatio: '9 / 19.5',
          background: 'linear-gradient(180deg, #fef4e8 0%, #fde2c8 50%, #fed9b8 100%)',
        }}
      >
        {/* Skip button (top-right) — 用 onSkip（有的話）或 fallback onComplete */}
        {showSkip && (
          <button
            onClick={handleSkipAction}
            aria-label="跳過導引"
            className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-lg text-orange-700 shadow-md transition hover:bg-white"
          >
            ✕
          </button>
        )}

        {/* Decorative elements (visible on all pages except Cover) */}
        {currentPage !== 0 && (
          <>
            <span className="pointer-events-none absolute left-[7%] top-[8%] text-sm text-rose-300/70">♥</span>
            <span className="pointer-events-none absolute right-[14%] top-[12%] text-base text-orange-300/70">♥</span>
            <span className="pointer-events-none absolute bottom-[14%] left-[5%] text-xs text-rose-300/70">♥</span>
            <span className="pointer-events-none absolute bottom-[10%] right-[8%] text-xs text-orange-300/70">♥</span>
            <span className="pointer-events-none absolute left-[14%] top-[6%] text-sm text-amber-300/70">✦</span>
            <span className="pointer-events-none absolute right-[18%] top-[11%] text-sm">🌿</span>
          </>
        )}

        {/* Carousel pages container */}
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Page 0: Cover — 純圖顯示（等 Pearl 給文字版 PNG / HTML 再更新 coverImageSrc） */}
          <div className="relative h-full w-full flex-shrink-0">
            <div className="relative h-full w-full">
              <Image
                src={coverImageSrc}
                alt="羽升幸福養成學苑封面"
                fill
                priority
                sizes="(max-width: 430px) 100vw, 430px"
                style={{ objectFit: 'cover' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Fallback placeholder if image missing */}
              <div className="absolute inset-0 -z-10 flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200 p-8 text-center text-orange-800">
                <div>
                  <div className="mb-4 text-3xl font-bold">羽升幸福養成學苑</div>
                  <div className="text-sm opacity-70">
                    （封面圖待上傳）
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 1: 歡迎 + 兩個模式 */}
          <PageContent>
            <div className="mb-3 mt-2 text-center text-[1.15em] font-bold text-orange-700">
              嗨，很高興你來了 ☺️
            </div>
            <p>
              不管是某段關係讓你有點累、有點氣、有點難開口，
              或只是想讓現在的關係，再靠近一點點——
            </p>
            <p className="mt-3">
              歡迎你來這裡，慢慢練。
              <br />
              不急、不勉強、也不需要「
              <span className="font-bold text-orange-700">先變得夠好</span>
              」才開始。
            </p>

            <H2>🌸 這個 app 是什麼？</H2>
            <p>
              讓你跟 AI 教練「<Accent>小羽老師</Accent>」一起，
              用 21 天，慢慢練好一段關係——
              不論是伴侶、親子、還是職場，
              這裡都可以是你的練習場。
            </p>

            <H2>💡 兩個你可以用的方式</H2>
            <ModeCard
              title="🌱 21 天練習"
              who="給「想穩穩練的你」"
              desc="固定主題、固定對象、循序漸進"
            />
            <ModeCard
              title="🤝 我卡住、幫我拆"
              who="給「當下需要被接住的你」"
              desc="臨時狀況、小羽老師即時診斷"
            />
          </PageContent>

          {/* Page 2: 我卡住、幫我拆 */}
          <PageContent>
            <PageTitle title="🤝 我卡住、幫我拆" subtitle="（諮詢模式）" />
            <SubNote>第一次使用 app、註冊完會自動進入這個模式</SubNote>

            <H2>＊什麼時候用？</H2>
            <p>
              當你「<Accent>急需處理一個當下卡住的問題</Accent>」、
              不一定跟 21 天的主題或對象有關。
            </p>

            <Scenario>老闆突然在會議上罵我、不知道怎麼回應</Scenario>
            <Scenario>老婆今天說了一句話、我不知道該不該回</Scenario>
            <Scenario>兒子昨天考試成績下滑、我該不該開口問</Scenario>
            <Scenario>同事一直推工作給我、要怎麼劃界線</Scenario>

            <H2>＊怎麼用？</H2>
            <Steps
              items={[
                '點上方「🤝 我卡住、幫我拆」',
                '開新主題（可開多個、每個獨立）',
                '描述：對方是誰、發生什麼、你的反應、你想要什麼',
                '小羽老師會幫你拆解、給你具體做法',
              ]}
            />
          </PageContent>

          {/* Page 3: 21 天練習 */}
          <PageContent>
            <PageTitle title="🌱 21 天練習" subtitle="（練習模式）" />

            <H2>＊什麼時候用？</H2>
            <p>
              想針對「<Accent>一段特定關係</Accent>」、做有節奏的深度練習——
              不是急著解決今天的事、而是慢慢長出新的相處方式。
            </p>

            <Scenario>🟢 想跟伴侶多點理解、少點誤會</Scenario>
            <Scenario>🟢 想跟青春期孩子重新連上線</Scenario>
            <Scenario>🟢 想跟某位同事 / 老闆相處更順</Scenario>

            <H2>＊一天大概像這樣</H2>
            <p>
              🌅 早上：拿到「今天要練的一件事」
              <br />
              🎯 白天：在真實生活裡試試看
              <br />
              🌙 晚上：跟小羽老師聊聊心得
            </p>

            <H2>＊21 天會走過 3 個階段</H2>
            <p>
              <Accent>Week 1</Accent>：看見「對方」
              <br />
              <Accent>Week 2</Accent>：看見「自己」
              <br />
              <Accent>Week 3</Accent>：在真實情境裡整合應用
            </p>

            <ImportantTip>
              <strong>💡 一個重要提醒</strong>
              <br />
              選定一個對象、一件事、練滿 21 天、效果最好。
              中途換對象、會等於從頭開始喔。
            </ImportantTip>
          </PageContent>

          {/* Page 4: 訂閱方案 */}
          <PageContent>
            <PageTitle title="💎 訂閱方案" />

            <ImportantTip>
              <div className="text-center">
                🟢 <strong>內測中、所有功能免費開放</strong>
                <br />
                <span className="text-[0.88em]">以下是正式上線後的方案、給你參考</span>
              </div>
            </ImportantTip>

            <H2>＊三種正式方案</H2>
            <PlanCard
              name="🌱 Basic 啟動｜NT$299 / 月"
              meta="給「剛開始接觸的你」｜80 則對話"
            />
            <PlanCard
              name="🌿 Advanced 深化｜NT$699 / 月"
              meta="給「想穩穩練的你」｜200 則對話"
            />
            <PlanCard
              name="🌳 Premium 整合｜NT$1,888 / 月"
              meta="給「想真正用在人生裡的你」｜500 則對話"
            />

            <H2>＊免費試用</H2>
            <p>
              🎁 首次註冊送 <Accent>7 天 Premium 體驗</Accent>
              <br />
              最多 100 則對話、體驗完再決定。
            </p>

            <H2>＊「一則對話」是什麼？</H2>
            <p className="text-center">
              你說一句 + 小羽老師回一句 = <Accent>1 則</Accent>
            </p>
          </PageContent>

          {/* Page 5: 邀請碼 */}
          <PageContent>
            <PageTitle title="🎁 邀請碼怎麼用？" />

            <H2>＊為什麼需要邀請碼？</H2>
            <p>
              目前是內測階段、希望給早期用戶最好的陪伴 💛
              所以採邀請制註冊。
            </p>

            <H2>＊邀請碼長什麼樣？</H2>
            <div className="my-2 rounded-lg border-2 border-dashed border-orange-600 bg-orange-600/10 p-3 text-center font-mono text-lg font-bold tracking-wider text-orange-700">
              NUWA-XXXX-XXX
            </div>
            <p className="-mt-1 text-center text-[0.82em] text-amber-800/70">
              （例：NUWA-A123-001）
            </p>

            <H2>＊在哪裡拿？</H2>
            <p className="text-center text-[1em]">
              🌟 <strong>加入 LINE 內測群組</strong> 索取
            </p>

            <H2>＊使用步驟</H2>
            <Steps items={['點「註冊新帳號」', '輸入你拿到的邀請碼', '完成基本資料']} />
            <p className="mt-2 text-center font-bold text-orange-700">
              → 立刻獲得 7 天 Premium 免費體驗 🎁
            </p>

            <H2>＊有問題？</H2>
            <p className="text-center">
              💬 <strong>到 LINE 內測群組</strong> 找我們
            </p>

            {/* CTA button - 開始使用 → /auth/register */}
            <button
              onClick={onComplete}
              className="mx-auto mt-6 block rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3 text-base font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-orange-700 active:scale-95"
            >
              開始使用 ✨
            </button>

            {/* Login link (for returning users) — only show if onLogin is provided */}
            {onLogin && (
              <div className="mt-4 text-center text-[0.88em] text-amber-800/70">
                已有帳號？
                <button
                  onClick={onLogin}
                  className="ml-1 font-bold text-orange-700 underline-offset-2 hover:underline"
                >
                  直接登入
                </button>
              </div>
            )}
          </PageContent>
        </div>

        {/* Bottom dots */}
        <div className="absolute bottom-[2.5%] left-0 right-0 z-10 flex justify-center gap-2">
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              aria-label={`跳到第 ${i + 1} 頁`}
              className={`h-2 rounded-full transition-all ${
                i === currentPage
                  ? 'w-6 bg-orange-700'
                  : 'w-2 bg-amber-800/40 hover:bg-amber-800/60'
              }`}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        {currentPage > 0 && (
          <button
            onClick={() => goToPage(currentPage - 1)}
            aria-label="上一頁"
            className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-2xl font-bold text-orange-700 shadow-md transition hover:bg-white"
          >
            ‹
          </button>
        )}
        {!isLastPage && (
          <button
            onClick={() => goToPage(currentPage + 1)}
            aria-label="下一頁"
            className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-2xl font-bold text-orange-700 shadow-md transition hover:bg-white"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components for content pages (reuse pattern from mockup HTML)
// ─────────────────────────────────────────────────────────────────

function PageContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex-shrink-0 overflow-y-auto px-7 pb-12 pt-9 text-[0.92em] leading-[1.7] text-amber-950">
      {children}
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <h1 className="mb-2 text-center text-[1.45em] font-black leading-tight text-orange-700">
      {title}
      {subtitle && (
        <span className="mt-1 block text-[0.55em] font-medium text-amber-800/70">
          {subtitle}
        </span>
      )}
    </h1>
  );
}

function SubNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-center text-[0.85em] italic text-amber-800/70">{children}</p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-4 text-[1em] font-bold text-orange-800">{children}</h2>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-orange-700">{children}</span>;
}

function ModeCard({ title, who, desc }: { title: string; who: string; desc: string }) {
  return (
    <div className="my-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
      <div className="text-[0.95em] font-bold text-orange-800">{title}</div>
      <div className="my-0.5 text-[0.82em] text-amber-800/70">{who}</div>
      <div className="text-[0.88em] text-amber-950">{desc}</div>
    </div>
  );
}

function Scenario({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1.5 rounded-xl bg-white/60 px-4 py-2 text-[0.88em] text-amber-950">
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <div className="my-2">
      <ol className="space-y-1.5">
        {items.map((text, i) => (
          <li key={i} className="relative pl-7 text-[0.9em]">
            <span className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-[11px] font-bold text-white">
              {i + 1}
            </span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ImportantTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-lg border-l-[3px] border-orange-400 bg-gradient-to-br from-amber-50 to-amber-100 px-4 py-3 text-[0.9em] leading-[1.65]">
      {children}
    </div>
  );
}

function PlanCard({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="my-2 rounded-xl border-l-[3px] border-orange-400 bg-white/70 px-4 py-3">
      <div className="text-[0.95em] font-bold text-orange-800">{name}</div>
      <div className="mt-0.5 text-[0.82em] text-amber-800/80">{meta}</div>
    </div>
  );
}
