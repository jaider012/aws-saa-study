/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every colour is a CSS variable declared in index.css, so light/dark
        // swap in one place and components never carry `dark:` variants.
        plane: 'var(--plane)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        rule: 'var(--rule)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-ink': 'var(--accent-ink)',
        good: 'var(--good)',
        'good-soft': 'var(--good-soft)',
        'good-ink': 'var(--good-ink)',
        critical: 'var(--critical)',
        'critical-soft': 'var(--critical-soft)',
        'critical-ink': 'var(--critical-ink)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        'warning-ink': 'var(--warning-ink)',
        track: 'var(--track)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      maxWidth: { reading: '68ch' },
    },
  },
  plugins: [],
}
