import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // v1.5.x：primary 從藍紫 (#5b4fff) → Pearl 粉橘系（一步全站粉橘化、對齊 Pearl 設計）
        // Pearl 官方指定色（GUIDELINE §5）：
        //   --orange: #dc7440       → primary-600（主 CTA）
        //   --orange-deep: #b95a37  → primary-700（hover / 深色）
        //   --orange-soft: #f6bf8e  → primary-300（淡色 accent）
        // 其餘 50-200、400-500、800-950 按邏輯漸層補完
        //
        // 原藍紫值保留於 git history、可 revert
        primary: {
          50:  '#fff7ed',  // 超淡背景
          100: '#ffedd5',  // chip 底、卡片淡底
          200: '#fed7aa',  // 邊框、subtle accent
          300: '#f6bf8e',  // Pearl orange-soft（淡橘）
          400: '#f2a160',  // 淡橘與主色之間
          500: '#e78b54',  // 三色橘漸層中段、hover-lighter
          600: '#dc7440',  // ⭐ Pearl orange 主 CTA
          700: '#b95a37',  // Pearl orange-deep（hover / active）
          800: '#9a4523',  // 深咖啡橘
          900: '#7c3517',  // 最深咖啡橘
          950: '#4a1c0b',  // 極深、文字強調
        },
        accent: {
          orange: '#F97316',
          coral: '#FF6B6B',
        },
      },
      fontFamily: {
        sans: ['var(--font-noto)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 1.5s infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
