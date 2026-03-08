/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#080b12',
          secondary: '#0d1117',
          card:      '#111827',
          hover:     '#161f30',
          border:    '#1f2d45',
          subtle:    '#1a2235',
        },
        accent: {
          blue:   '#4f8ef7',
          cyan:   '#06c8e8',
          purple: '#9b6dff',
          indigo: '#6366f1',
          green:  '#10d98a',
        },
        text: {
          primary:   '#f1f5f9',
          secondary: '#94a3b8',
          muted:     '#475569',
        },
        success: '#10d98a',
        warning: '#f59e0b',
        danger:  '#f43f5e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-blue':    'linear-gradient(135deg, #4f8ef7, #06c8e8)',
        'gradient-purple':  'linear-gradient(135deg, #9b6dff, #4f8ef7)',
        'gradient-dark':    'linear-gradient(135deg, #111827, #0d1117)',
      },
      boxShadow: {
        'glow-blue':   '0 0 24px rgba(79,142,247,0.18)',
        'glow-cyan':   '0 0 24px rgba(6,200,232,0.15)',
        'glow-purple': '0 0 24px rgba(155,109,255,0.18)',
        'card':        '0 4px 24px rgba(0,0,0,0.35)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.45)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
