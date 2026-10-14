/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
          800: '#065F46', 900: '#064E3B', 950: '#022C22',
        },
        ink: { DEFAULT: '#0B1F17', soft: '#1C332A', muted: '#3D5A4F' },
        mist: { DEFAULT: '#F2F7F4', deep: '#E8F0EB' },
        line: '#DFEAE3',
        // Legacy aliases — keep existing pages working, values follow the new system
        'solar-yellow': '#059669', 'canyon-orange': '#E84826', 'forest-green': '#059669',
        'sky-blue': '#0E9F8A', 'slate-blue': '#7A8B83',
        graphite: '#0B1F17', 'pure-black': '#06120E', concrete: '#DFEAE3',
        ash: '#C4D4CB', fog: '#7A8B83', steel: '#5B6B64',
        paper: '#FFFFFF', chalk: '#F2F7F4', charcoal: '#1C332A',
        success: { DEFAULT: '#059669', light: '#D1FAE5', dark: '#047857' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', dark: '#B45309' },
        danger: { DEFAULT: '#DC2626', light: '#FEE2E2', dark: '#B91C1C' },
        dark: {
          bg: '#07120E', surface: '#0B1F17', card: '#10261D',
          elevated: '#183629', border: '#1E4234', separator: '#265442',
        },
        neutral: {
          50: '#F6F8F7', 100: '#EDF2EF', 200: '#DFEAE3', 300: '#C4D4CB', 400: '#8AA398',
          500: '#5B6B64', 600: '#47584F', 700: '#33473D', 800: '#1C332A', 900: '#0B1F17', 950: '#06120E',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        adventure: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.75rem', nav: '10px', card: '16px', chip: '999px',
        icon: '10px', pill: '9999px', image: '16px', input: '12px', button: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(6,40,28,0.05), 0 8px 24px -12px rgba(6,40,28,0.12)',
        lift: '0 2px 4px rgba(6,40,28,0.06), 0 16px 32px -16px rgba(6,40,28,0.18)',
        pop: '0 12px 32px -8px rgba(4,80,55,0.25)',
      },
      letterSpacing: { tightest: '-0.045em', 'tighter-2': '-0.036em', 'tighter-3': '-0.025em', 'tight-4': '-0.020em', 'tight-5': '-0.014em', 'tight-6': '-0.010em' },
      maxWidth: { page: '1440px' },
    },
  },
  plugins: [],
};
