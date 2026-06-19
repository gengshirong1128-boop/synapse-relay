export interface Theme {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  success: string;
  error: string;
  border: string;
  userBubble: string;
  aiBubble: string;
  inputBackground: string;
}

export const darkTheme: Theme = {
  background: '#000000',
  surface: '#1c1c1e',
  surfaceSecondary: '#2c2c2e',
  text: '#e5e5e7',
  textSecondary: '#8e8e93',
  textTertiary: '#636366',
  accent: '#0a84ff',
  success: '#30d158',
  error: '#ff453a',
  border: '#2c2c2e',
  userBubble: '#0a84ff',
  aiBubble: '#2c2c2e',
  inputBackground: '#2c2c2e',
};

export const lightTheme: Theme = {
  background: '#f2f2f7',
  surface: '#ffffff',
  surfaceSecondary: '#e5e5ea',
  text: '#1c1c1e',
  textSecondary: '#6c6c70',
  textTertiary: '#aeaeb2',
  accent: '#007aff',
  success: '#34c759',
  error: '#ff3b30',
  border: '#d1d1d6',
  userBubble: '#007aff',
  aiBubble: '#e5e5ea',
  inputBackground: '#e5e5ea',
};

export function getTheme(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
