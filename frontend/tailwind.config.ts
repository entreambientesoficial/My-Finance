import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#031632' },
        emerald: { finance: '#006c49' },
        /* Tokens semânticos via CSS vars */
        page:  'rgb(var(--c-bg) / <alpha-value>)',
        card:  'rgb(var(--c-card) / <alpha-value>)',
        'card-hover': 'rgb(var(--c-card-hover) / <alpha-value>)',
        subtle: 'rgb(var(--c-subtle) / <alpha-value>)',
        'border-base': 'rgb(var(--c-border) / <alpha-value>)',
        'border-md': 'rgb(var(--c-border-md) / <alpha-value>)',
        'c-text':   'rgb(var(--c-text) / <alpha-value>)',
        'c-muted':  'rgb(var(--c-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
