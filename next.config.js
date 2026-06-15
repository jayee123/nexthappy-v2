/** @type {import('next').NextConfig} */
const nextConfig = {
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
