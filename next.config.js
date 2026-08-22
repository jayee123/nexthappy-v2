/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // berth 是自架 standalone docker、未裝 sharp，next/image 最佳化會 500 導致破圖。
  // unoptimized 讓 <Image> 直接輸出原圖（不經 /_next/image 最佳化），穩定顯示。
  images: { unoptimized: true },
  // 把 Vercel 的 VERCEL_ENV 橋接到 client side（用來決定 dev 測試按鈕是否顯示）
  // - preview deploy  → 'preview'
  // - production deploy → 'production'
  // - local dev → 'development'
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || 'development',
  },
  // v1.4.x Session 5D: 強制把 docs/*.md + buildContext.ts 打進 admin docs API 的 serverless function bundle
  // 否則 Vercel 預設只 bundle「明顯 import」的檔案、fs.readFile 在 runtime 抓不到 docs/
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/docs/**/*': [
        './docs/v2.1-course-spec.md',
        './src/lib/ai/buildContext.ts',
      ],
    },
    // 紅陽支付頁完成後以 POST 導回轉導網址（跨網域），
    // Next.js Server Actions 安全機制會擋掉 origin 不符的 POST → 500。
    // 允許紅陽測試/正式網域，避免導回頁 500。
    serverActions: {
      allowedOrigins: [
        'nexthappy.sakilu-dev.uk',
        'testtrade.sunpay.com.tw',
        'trade.sunpay.com.tw',
      ],
    },
  },
  async headers() {
    return [
      // PWA
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      // 安全標頭。
      //
      // 這幾條原本寫在 vercel.json，但私版跑在 berth 的 Docker 容器、不是 Vercel，
      // 那個檔案從來沒有生效過（實測正式站一個安全標頭都沒回傳）。
      // 移到這裡由 Next.js 自己送出，才不受部署平台影響。
      {
        source: '/:path*',
        headers: [
          // 禁止被嵌進 iframe，防點擊劫持
          { key: 'X-Frame-Options', value: 'DENY' },
          // 禁止瀏覽器自行猜測 MIME type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 跨站導向時不外洩完整路徑（SSO token 會出現在網址上）
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
