/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#000000',
          secondary: '#09090b',
          tertiary: '#121215',
          panel: '#09090b',
        },
        border: {
          DEFAULT: '#27272a',
          light: '#3f3f46',
          dark: '#18181b',
        },
        text: {
          DEFAULT: '#ffffff',
          secondary: '#a1a1aa',
          muted: '#71717a',
          dim: '#3f3f46',
        },
        bull: { DEFAULT: '#ffffff', dim: 'rgba(255, 255, 255, 0.08)' },
        bear: { DEFAULT: '#a1a1aa', dim: 'rgba(161, 161, 170, 0.08)' },
        accent: { DEFAULT: '#ffffff', dim: 'rgba(255, 255, 255, 0.08)' },
        warning: { DEFAULT: '#e4e4e7', dim: 'rgba(228, 228, 231, 0.08)' },
        stoch: { k: '#ffffff', d: '#71717a' },
        ema: { DEFAULT: '#e4e4e7' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '3xs': ['0.6875rem', { lineHeight: '0.9rem' }], // 11px
        '2xs': ['0.75rem', { lineHeight: '1.05rem' }],   // 12px (was 10px)
        'xs':  ['0.8125rem', { lineHeight: '1.2rem' }],  // 13px (was 12px)
        'sm':  ['0.9375rem', { lineHeight: '1.35rem' }], // 15px (was 14px)
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
      },
    },
  },
  plugins: [],
}
