import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '羽升幸福養成學苑 | 21天幸福關係練習',
  description: 'AI 陪伴教練，21天幸福關係練習系統',
  manifest: '/manifest.json',
  // iOS Safari 進入 standalone 仍然只認 apple-mobile-web-app-capable，所以保留；
  // Chrome 已把它標為棄用、改看 mobile-web-app-capable，兩個都送才兩邊都乾淨
  // （只留其一：拿掉 apple 版 iOS 不再全螢幕，只留 apple 版 Chrome 繼續跳警告）。
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '小羽 AI',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#5b4fff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm">
          {children}
        </div>
      </body>
    </html>
  );
}
