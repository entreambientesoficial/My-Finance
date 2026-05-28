---
name: Precision Finance
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4e5f7e'
  primary: '#031632'
  on-primary: '#ffffff'
  primary-container: '#1a2b48'
  on-primary-container: '#8293b5'
  inverse-primary: '#b6c7eb'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#370003'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e0008'
  on-tertiary-container: '#ff5754'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#b6c7eb'
  on-primary-fixed: '#081b38'
  on-primary-fixed-variant: '#374765'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

This design system is engineered for high-stakes financial clarity. The brand personality is authoritative yet accessible, prioritizing precision and data-density without sacrificing visual breathing room. 

The design style is **Corporate / Modern** with a strong leaning towards **Minimalism**. It utilizes a systematic approach to information architecture, ensuring that complex data sets are legible and actionable. The aesthetic response should be one of "calm control"—evoking trust through stability, professional polish, and the removal of unnecessary visual noise.

## Colors

The palette is anchored by **Deep Navy (#1A2B48)**, used primarily for structural elements like sidebar navigation and primary headers to establish a foundation of stability. 

Semantic colors are strictly enforced: **Emerald Green (#10B981)** represents growth, income, and positive trends, while **Coral Red (#EF4444)** is reserved for expenses, alerts, and negative movements. The background uses a soft **Slate Grey (#F8FAFC)** to reduce eye strain during long sessions and provide a neutral canvas that allows the high-contrast navy and semantic accents to stand out.

## Typography

The design system utilizes **Inter** exclusively for its exceptional legibility in data-heavy environments. The hierarchy is built on a tight scale to maximize information density while maintaining clarity.

Numeric values must use `tabular lining` figures (tnum) to ensure decimal points and currency symbols align vertically in tables and lists. Labels are set in uppercase with slight tracking to differentiate them from body text and provide clear categorization for data points.

## Layout & Spacing

The layout follows a **Fixed Grid** model on desktop, centered within a 1440px container, and a **Fluid Grid** on mobile and tablet devices. 

A 12-column system is used for dashboard layouts, allowing for flexible card widths (e.g., 3-column stats cards, 8-column charts, 4-column transaction lists). The spacing rhythm is based on a 4px baseline, with 24px gutters providing significant separation between functional modules to prevent the UI from feeling cluttered despite high data density.

## Elevation & Depth

This design system uses **Tonal Layers** combined with **Ambient Shadows** to create a sophisticated sense of depth. 

The primary canvas is the neutral Slate Grey. Interactive modules and data containers sit on a pure white (#FFFFFF) surface. Shadows are extremely subtle: a low-offset, wide-blur shadow with a hint of the primary Navy color (`rgba(26, 43, 72, 0.04)`) is used for cards. This creates a "lifted" effect that defines the interactive area without the heaviness of traditional skeuomorphism.

## Shapes

The shape language is defined by **Rounded (12px)** corners for primary containers and cards. This specific radius strikes a balance between professional rigidity and modern approachability. 

Small interactive elements like buttons and input fields follow the `rounded-md` (8px) convention to feel precise, while notification badges and status tags utilize `rounded-full` (pill-shaped) to distinguish them from structural layout elements.

## Components

- **Cards:** White background, 12px border-radius, 1px subtle border (#E2E8F0), and a soft ambient shadow.
- **Buttons:** Primary buttons use the Deep Navy background with white text. Success actions use Emerald Green. Ghost buttons use a 1px Slate Grey border.
- **Input Fields:** 8px border-radius, white background, 1px border (#CBD5E1). On focus, the border shifts to Deep Navy with a 2px outer glow.
- **Data Tables:** Row-based with thin dividers (#F1F5F9). No vertical borders. Header labels are `label-sm` with a light grey background.
- **Chips/Status Tags:** Low-saturation backgrounds with high-saturation text (e.g., light green background with Emerald Green text) to denote status without overwhelming the view.
- **Charts:** Line and bar charts should use a 2px stroke width. Primary data series in Deep Navy, comparative data in Slate Grey, and trend indicators in Green/Red.