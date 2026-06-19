export type ThemeMode = 'light' | 'dark';
export type BackendBrand = 'claude' | 'codex';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  userBg: string;
  userText: string;
  assistantBg: string;
  assistantText: string;
  codeBg: string;
  codeText: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  tabBar: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  headerBg: string;
  headerText: string;
  toolCardBg: string;
  toolCardBorder: string;
  toolAccent: string;
  thinkingBg: string;
  thinkingText: string;
}

const claudeLight: ThemeColors = {
  bg: '#f7f5f0',
  surface: '#ffffff',
  surfaceAlt: '#f2efe8',
  border: '#e5e0d5',
  text: '#2d2418',
  textSecondary: '#6b5e4f',
  textTertiary: '#9c8e7c',
  accent: '#c96442',
  accentSoft: '#c9644215',
  userBg: '#f2efe8',
  userText: '#2d2418',
  assistantBg: 'transparent',
  assistantText: '#2d2418',
  codeBg: '#1e1e1e',
  codeText: '#d4d4d4',
  inputBg: '#ffffff',
  inputBorder: '#e5e0d5',
  inputText: '#2d2418',
  placeholder: '#9c8e7c',
  tabBar: '#f7f5f0',
  tabBarBorder: '#e5e0d5',
  tabActive: '#c96442',
  tabInactive: '#9c8e7c',
  headerBg: '#f7f5f0',
  headerText: '#2d2418',
  toolCardBg: '#f2efe8',
  toolCardBorder: '#e5e0d5',
  toolAccent: '#c96442',
  thinkingBg: '#f2efe8',
  thinkingText: '#6b5e4f',
};

const claudeDark: ThemeColors = {
  bg: '#1a1816',
  surface: '#242220',
  surfaceAlt: '#2e2b28',
  border: '#3d3832',
  text: '#ede8e0',
  textSecondary: '#a89f91',
  textTertiary: '#6b5e4f',
  accent: '#da7756',
  accentSoft: '#da775620',
  userBg: '#2e2b28',
  userText: '#ede8e0',
  assistantBg: 'transparent',
  assistantText: '#ede8e0',
  codeBg: '#0d0d0d',
  codeText: '#d4d4d4',
  inputBg: '#242220',
  inputBorder: '#3d3832',
  inputText: '#ede8e0',
  placeholder: '#6b5e4f',
  tabBar: '#1a1816',
  tabBarBorder: '#3d3832',
  tabActive: '#da7756',
  tabInactive: '#6b5e4f',
  headerBg: '#1a1816',
  headerText: '#ede8e0',
  toolCardBg: '#2e2b28',
  toolCardBorder: '#3d3832',
  toolAccent: '#da7756',
  thinkingBg: '#2e2b28',
  thinkingText: '#a89f91',
};

const codexLight: ThemeColors = {
  bg: '#ffffff',
  surface: '#f9f9f9',
  surfaceAlt: '#f2f2f2',
  border: '#e0e0e0',
  text: '#171717',
  textSecondary: '#5c5c5c',
  textTertiary: '#999999',
  accent: '#171717',
  accentSoft: '#17171710',
  userBg: '#f2f2f2',
  userText: '#171717',
  assistantBg: 'transparent',
  assistantText: '#171717',
  codeBg: '#1e1e1e',
  codeText: '#e0e0e0',
  inputBg: '#ffffff',
  inputBorder: '#e0e0e0',
  inputText: '#171717',
  placeholder: '#999999',
  tabBar: '#ffffff',
  tabBarBorder: '#e0e0e0',
  tabActive: '#171717',
  tabInactive: '#999999',
  headerBg: '#ffffff',
  headerText: '#171717',
  toolCardBg: '#f9f9f9',
  toolCardBorder: '#e0e0e0',
  toolAccent: '#171717',
  thinkingBg: '#f2f2f2',
  thinkingText: '#5c5c5c',
};

const codexDark: ThemeColors = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceAlt: '#1e1e1e',
  border: '#333333',
  text: '#f5f5f5',
  textSecondary: '#b0b0b0',
  textTertiary: '#777777',
  accent: '#f5f5f5',
  accentSoft: '#ffffff14',
  userBg: '#1a1a1a',
  userText: '#f5f5f5',
  assistantBg: 'transparent',
  assistantText: '#f5f5f5',
  codeBg: '#000000',
  codeText: '#e0e0e0',
  inputBg: '#141414',
  inputBorder: '#333333',
  inputText: '#f5f5f5',
  placeholder: '#777777',
  tabBar: '#0a0a0a',
  tabBarBorder: '#222222',
  tabActive: '#f5f5f5',
  tabInactive: '#777777',
  headerBg: '#0a0a0a',
  headerText: '#f5f5f5',
  toolCardBg: '#141414',
  toolCardBorder: '#333333',
  toolAccent: '#f5f5f5',
  thinkingBg: '#141414',
  thinkingText: '#b0b0b0',
};

export function getTheme(brand: BackendBrand, mode: ThemeMode): ThemeColors {
  if (brand === 'claude') return mode === 'dark' ? claudeDark : claudeLight;
  return mode === 'dark' ? codexDark : codexLight;
}
