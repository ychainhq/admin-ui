---
name: Precision Ledger
colors:
  surface: '#0c1324'
  surface-dim: '#0c1324'
  surface-bright: '#33394c'
  surface-container-lowest: '#070d1f'
  surface-container-low: '#151b2d'
  surface-container: '#191f31'
  surface-container-high: '#23293c'
  surface-container-highest: '#2e3447'
  on-surface: '#dce1fb'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#dce1fb'
  inverse-on-surface: '#2a3043'
  outline: '#8f9097'
  outline-variant: '#45474c'
  surface-tint: '#bcc7de'
  primary: '#bcc7de'
  on-primary: '#263143'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#545f73'
  secondary: '#ffb874'
  on-secondary: '#4b2800'
  secondary-container: '#e78603'
  on-secondary-container: '#522c00'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00301e'
  on-tertiary-container: '#00a472'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#ffdcbf'
  secondary-fixed-dim: '#ffb874'
  on-secondary-fixed: '#2d1600'
  on-secondary-fixed-variant: '#6b3b00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0c1324'
  on-background: '#dce1fb'
  surface-variant: '#2e3447'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
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
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for high-fidelity financial environments where clarity, security, and technical precision are paramount. It targets a sophisticated user base—institutional investors and high-net-worth individuals—who require real-time data visualization without cognitive overload.

The aesthetic blends **Modern Corporate** reliability with **Glassmorphism** accents. By utilizing semi-transparent surfaces and ultra-fine "hairline" borders, the system achieves a sense of depth and layered information architecture. The emotional response is one of controlled power: the UI feels like a high-performance instrument—cold, sharp, and unfailingly accurate.

## Colors

The palette is anchored in a deep, nocturnal foundation. The background (#020617) provides a "true black" canvas that allows glass effects to pop. 

- **Primary (Indigo/Navy):** Used for structural elements, sidebars, and deep-layered containers.
- **Secondary (Bitcoin Gold):** Reserved for high-value actions, wealth indicators, and critical growth metrics.
- **Tertiary (Emerald Green):** Dedicated strictly to positive movement, profit indicators, and "Success" system states.
- **Surface Layering:** Use semi-transparent variants of the primary color for card backgrounds to enable the glassmorphism effect, ensuring a `backdrop-filter: blur(20px)` is applied to maintain legibility.

## Typography

This design system utilizes a dual-font strategy. **Geist** is employed for headlines, labels, and all numerical data to leverage its technical, monospaced-adjacent character. **Inter** is used for long-form body text and descriptions to ensure maximum readability.

Numerical data should always utilize tabular figures (`tnum`) to ensure that columns of numbers align perfectly in tables and dashboard widgets. Use `label-md` for secondary metadata and table headers to create a clear structural hierarchy.

## Layout & Spacing

The system follows a strict **8px linear scale** to maintain mathematical harmony. 

- **Grid:** A 12-column fluid grid is used for desktop (breakpoint 1440px+). 
- **Dashboards:** Utilize a "fixed-sidebar, fluid-content" model. The sidebar remains at 280px, while the main stage expands.
- **Containers:** Content is grouped into logical modules (cards) separated by `24px` gutters. 
- **Density:** The layout is "comfortable-dense"—high information density is balanced by generous outer margins (`32px`) to prevent visual claustrophobia.

## Elevation & Depth

Depth is communicated through **Z-axis transparency** rather than heavy shadows. 

1.  **Level 0 (Base):** The dark slate background (#020617).
2.  **Level 1 (Surface):** Glassmorphic cards with `rgba(30, 41, 59, 0.5)` background, a `20px` backdrop-blur, and a `1px` solid border at `rgba(255, 255, 255, 0.1)`.
3.  **Level 2 (Popovers/Modals):** Increased opacity and a subtle ambient shadow (0px 20px 40px rgba(0,0,0,0.4)) to suggest they are floating closer to the user.

Use an inner "glow" (a 1px top-border with 20% white opacity) on primary cards to simulate light hitting the edge of a glass pane.

## Shapes

The shape language is refined and professional. 
- **Standard UI Elements:** (Inputs, Buttons, Cards) use a **0.5rem (8px)** corner radius.
- **Small Elements:** (Badges, Tags) use a **full pill shape** to distinguish them from actionable buttons.
- **Micro-charts:** Lines should be slightly smoothed (Bezier curve) but avoid excessive rounding to maintain the "technical" feel of the data.

## Components

### Buttons
Primary buttons use the Bitcoin Gold (#F7931A) with black text for maximum contrast. Secondary buttons utilize a ghost style with the subtle border and backdrop blur.

### Stats Cards
These are the core of the dashboard. Each card includes:
- A Geist `headline-sm` for the value.
- A Geist `label-md` for the title.
- A micro-chart (sparkline) using Emerald Green for positive trends or a muted red for negative. Sparklines should be simplified, showing only the trend line without axes.

### Data Tables
Tables are borderless between rows, using a `1px` bottom divider in `rgba(255, 255, 255, 0.05)`. Header rows use `label-md` in a muted grey. Hover states should trigger a slight brightening of the background glass.

### Status Badges
High-contrast pill shapes. Positive statuses use Emerald Green text on a 10% opacity green background. Alert statuses use Gold on 10% Gold.

### Tabs
Underline style tabs. The active state is indicated by a 2px Bitcoin Gold bottom border and a white text color; inactive tabs are muted grey with no border.