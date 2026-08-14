/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0A0F1E',
        gold: '#D4AF37',
        'gold-dark': '#B8962E',
        // Theme-aware tokens. These were used throughout the app
        // (border-border, bg-surface-hover, bg-card, bg-muted…) but were
        // never declared here, so Tailwind emitted no CSS for them and
        // borders silently fell back to its default light grey — wrong in
        // dark mode. Mapping them to the CSS variables makes every existing
        // usage follow the active theme.
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-sunken': 'var(--surface-sunken)',
        'surface-hover': 'var(--surface-hover)',
        card: 'var(--surface)',
        muted: 'var(--surface-2)',
        'muted-foreground': 'var(--text-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
