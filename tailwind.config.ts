import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0B0A08',
        abyss: '#131109',
        holo: {
          DEFAULT: 'rgb(var(--holo-rgb) / <alpha-value>)',
          dim: 'var(--holo-dim)',
        },
        alert: '#E5484D',
        ice: '#EFE8D8',
        steel: '#9A8F78',
        faint: '#5E574A',
      },
      fontFamily: {
        display: ['Marcellus', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        holo: '0 0 24px -6px var(--holo-glow)',
        'holo-sm': '0 0 12px -4px var(--holo-glow)',
        alert: '0 0 20px -6px rgba(255,51,102,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        scan: 'scan 8s linear infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
