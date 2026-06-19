import { useMemo } from 'react';
import { useAppStore } from '../store';
import { getTheme, Theme } from '../theme';

export function useTheme(): Theme {
  const mode = useAppStore((s) => s.theme);
  return useMemo(() => getTheme(mode), [mode]);
}
