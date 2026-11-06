/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        panel: 'var(--panel)',
        'panel-2': 'var(--panel-2)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        ink: 'var(--text)',
        'ink-soft': 'var(--text-soft)',
        'ink-mute': 'var(--text-mute)',
        brand: 'var(--accent)',
        'brand-soft': 'var(--accent-soft)',
        primary: 'var(--primary)',
        'primary-soft': 'var(--primary-soft)',
        good: 'var(--success)',
        warn: 'var(--warn)',
        bad: 'var(--danger)',
      },
      borderRadius: {
        xl: 'var(--radius)',
        '2xl': 'calc(var(--radius) * 1.4)',
      },
      boxShadow: {
        soft: 'var(--shadow-sm)',
        card: 'var(--shadow)',
        pop: 'var(--shadow-lg)',
        glow: 'var(--glow)',
      },
      fontFamily: {
        sans: [
          '"Inter var"',
          'Inter',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        drift: {
          '0%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(14px,-10px)' },
          '100%': { transform: 'translate(0,0)' },
        },
        twinkle: {
          '0%,100%': { opacity: '.25' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up .28s cubic-bezier(.22,1,.36,1) both',
        'scale-in': 'scale-in .2s cubic-bezier(.22,1,.36,1) both',
        drift: 'drift 22s ease-in-out infinite',
        twinkle: 'twinkle 3.4s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
}
