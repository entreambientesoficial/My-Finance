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
        // Core semantic page tokens (pre-existing and customized)
        page: 'var(--background)',
        card: 'var(--surface-container-lowest)',
        'card-hover': 'var(--surface-container-low)',
        subtle: 'var(--surface-container-high)',
        'border-base': 'var(--outline-variant)',
        'border-md': 'var(--outline)',
        'c-text': 'var(--on-surface)',
        'c-muted': 'var(--on-surface-variant)',

        // Stitch original design tokens mapped to CSS variables
        "on-primary-fixed-variant": "var(--on-primary-fixed-variant)",
        "error": "var(--error)",
        "on-surface": "var(--on-surface)",
        "on-secondary-container": "var(--on-secondary-container)",
        "outline": "var(--outline)",
        "on-tertiary": "var(--on-tertiary)",
        "on-background": "var(--on-background)",
        "tertiary": "var(--tertiary)",
        "primary-fixed": "var(--primary-fixed)",
        "on-error-container": "var(--on-error-container)",
        "on-primary-container": "var(--on-primary-container)",
        "on-surface-variant": "var(--on-surface-variant)",
        "secondary-container": "var(--secondary-container)",
        "on-secondary": "var(--on-secondary)",
        "secondary": "var(--secondary)",
        "error-container": "var(--error-container)",
        "on-primary-fixed": "var(--on-primary-fixed)",
        "inverse-surface": "var(--inverse-surface)",
        "background": "var(--background)",
        "surface-container-highest": "var(--surface-container-highest)",
        "tertiary-fixed-dim": "var(--tertiary-fixed-dim)",
        "surface-dim": "var(--surface-dim)",
        "primary": "var(--primary)",
        "inverse-on-surface": "var(--inverse-on-surface)",
        "surface-tint": "var(--surface-tint)",
        "on-tertiary-container": "var(--on-tertiary-container)",
        "on-secondary-fixed": "var(--on-secondary-fixed)",
        "on-secondary-fixed-variant": "var(--on-secondary-fixed-variant)",
        "inverse-primary": "var(--inverse-primary)",
        "surface-bright": "var(--surface-bright)",
        "on-error": "var(--on-error)",
        "on-primary": "var(--on-primary)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container": "var(--surface-container)",
        "primary-container": "var(--primary-container)",
        "tertiary-container": "var(--tertiary-container)",
        "tertiary-fixed": "var(--tertiary-fixed)",
        "surface-container-low": "var(--surface-container-low)",
        "outline-variant": "var(--outline-variant)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface": "var(--surface)",
        "primary-fixed-dim": "var(--primary-fixed-dim)",
        "surface-variant": "var(--surface-variant)",
        "on-tertiary-fixed-variant": "var(--on-tertiary-fixed-variant)",
        "secondary-fixed-dim": "var(--secondary-fixed-dim)",
        "secondary-fixed": "var(--secondary-fixed)",
        "on-tertiary-fixed": "var(--on-tertiary-fixed)"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "12px",
        "xl": "16px",
        "full": "9999px"
      },
      spacing: {
        "md": "16px",
        "xl": "32px",
        "gutter": "24px",
        "sm": "12px",
        "base": "4px",
        "xs": "8px",
        "container-max": "1440px",
        "lg": "24px"
      },
      fontFamily: {
        "headline-md": ["Inter", "sans-serif"],
        "label-sm": ["Inter", "sans-serif"],
        "display-lg": ["Inter", "sans-serif"],
        "display-lg-mobile": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "numeric-data": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"]
      },
      fontSize: {
        "headline-md": ["20px", { "lineHeight": "28px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "label-sm": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "display-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "display-lg-mobile": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "numeric-data": ["14px", { "lineHeight": "20px", "fontWeight": "500" }],
        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }]
      }
    },
  },
  plugins: [],
};

export default config;
