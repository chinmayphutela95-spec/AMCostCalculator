/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // TII theme: purple #6400FF (primary), green #00B989 (secondary), black #000000 (text),
      // on plain white. Token names are kept from the original dark theme so every
      // component picks the new colours up without class changes.
      colors: {
        bg: {
          primary:   '#ffffff',   // page
          secondary: '#ffffff',   // sidebar, inputs, inner panels (separated by borders)
          card:      '#ffffff',
          hover:     '#f4f4f5',
          border:    '#e4e4e7',
          subtle:    '#f4f4f5',   // fills that must stay visible on white: tracks, chips, read-only fields
        },
        accent: {
          blue:   '#6400FF',      // TII purple — actions, selection, links
          cyan:   '#00B989',      // TII green — fills, borders, highlights
          purple: '#6400FF',
          indigo: '#6400FF',
          green:  '#008562',      // TII green, one step darker so text clears 4.5:1 on white
        },
        text: {
          primary:   '#000000',
          secondary: '#3f3f46',
          muted:     '#71717a',
        },
        success: '#008562',
        warning: '#b45309',
        danger:  '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':        '0 1px 2px rgba(0,0,0,0.04)',
        'card-hover':  '0 4px 12px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
