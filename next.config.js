/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
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
  // PWA headers
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
