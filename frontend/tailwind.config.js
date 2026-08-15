import colors from 'tailwindcss/colors'

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
        // DIQQAT: bu yerga 'muted' yoki 'body' deb nom qo'shmang!
        // index.css da .text-muted va .text-body komponent class'lari bor;
        // xuddi shu nomdagi rang kaliti Tailwind'da .text-muted / .text-body
        // utility'sini yaratadi va u komponent qatlamini bosib ketadi —
        // natijada matn fon rangiga aylanib, oq fonda ko'rinmay qoladi.
        // Fon uchun bg-surface-2 / bg-app ishlatilsin.
        app: 'var(--bg)',
        // text-foreground 23 joyda ishlatilgan, lekin e'lon qilinmagani uchun
        // CSS umuman chiqmasdi — matn ota-elementdan rang olib, oq fonda
        // ko'rinmay qolardi (xizmatlar ro'yxatidagi ma'lumot qatori).
        foreground: 'var(--text)',
        'surface-1': 'var(--surface)',
        'gold-dim': 'var(--gold-dim)',
        'gold-glow': 'var(--gold-glow)',
        // DEFAULT qo'shiladi, lekin raqamli shkala (bg-cyan-500 va h.k.)
        // buzilmasligi uchun asl ranglar yoyib beriladi.
        cyan: { ...colors.cyan, DEFAULT: 'var(--color-cyan)' },
        emerald: { ...colors.emerald, DEFAULT: 'var(--color-emerald)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
