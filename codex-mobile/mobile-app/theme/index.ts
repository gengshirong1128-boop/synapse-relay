/**
 * Theme barrel. The app's real theming lives in colors.ts (Codex/Claude ×
 * light/dark) and tokens.ts (spacing/radius/type). Import from here.
 *
 * Note: the previous single iOS-blue Theme here was dead code (only the unused
 * useTheme hook referenced it) and was removed — colors.ts is the source of truth.
 */
export * from './colors';
export * from './tokens';
