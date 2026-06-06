/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Font scale utilities driven by CSS variable --app-font-size.
 * Apply .app-scaled to root, then all children inherit.
 */

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '13px',
  md: '14px',
  lg: '16px',
  xl: '18px',
};

export function getAppFontSize(size: FontSize): string {
  return FONT_SIZE_MAP[size] || FONT_SIZE_MAP.md;
}

export function getFontScaleClass(size: FontSize): string {
  switch (size) {
    case 'sm': return 'text-[13px]';
    case 'md': return 'text-[14px]';
    case 'lg': return 'text-[16px]';
    case 'xl': return 'text-[18px]';
  }
}

export function getReadableTextClass(size: FontSize): string {
  switch (size) {
    case 'sm': return 'text-[12px] leading-relaxed';
    case 'md': return 'text-[13.5px] leading-relaxed';
    case 'lg': return 'text-[15px] leading-[1.75]';
    case 'xl': return 'text-[17px] leading-[1.8]';
  }
}

export function getButtonTextClass(size: FontSize): string {
  switch (size) {
    case 'sm': return 'text-[11px]';
    case 'md': return 'text-xs';
    case 'lg': return 'text-[13px]';
    case 'xl': return 'text-sm';
  }
}

/** CSS variable style object for root container */
export function fontScaleRootStyle(size: FontSize): Record<string, string> {
  return { '--app-font-size': FONT_SIZE_MAP[size] };
}
