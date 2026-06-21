/**
 * Design tokens — the single place to tune the app's visual rhythm.
 *
 * Colors live in colors.ts (per-theme). Everything here is theme-agnostic:
 * spacing, radius, type scale, font weights. Components should reference these
 * instead of hardcoding numbers, so a future redesign (e.g. a Stitch spec) can
 * be applied by editing this one file.
 */

// 8pt-ish spacing scale. Use spacing.md as the default gap/padding.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

// Corner radii. card/sheet for containers, pill for chips/buttons, bubble for chat.
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 22,
  bubble: 18,
} as const;

// Type scale (font sizes).
export const fontSize = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLg: 15,
  title: 17,
  heading: 22,
} as const;

// Font weights as RN-friendly string literals.
export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '700',
  heavy: '800',
} as const;

// Hairline-ish border width baseline (components may use StyleSheet.hairlineWidth directly too).
export const border = {
  thin: 1,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
