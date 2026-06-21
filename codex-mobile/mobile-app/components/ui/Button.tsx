import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { fontSize, fontWeight, radius, spacing } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

type Props = {
  colors: ThemeColors;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

// One button to rule them all — variant + size + token-driven, works in both
// themes, with a consistent pressed feedback. Replaces the scattered ad-hoc
// Pressable+Text button styles across screens.
export function Button({
  colors,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  fullWidth,
  accessibilityLabel,
}: Props) {
  const v = resolveVariant(variant, colors);
  const pad = size === 'sm'
    ? { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }
    : { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        pad,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.borderWidth,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

function resolveVariant(variant: ButtonVariant, colors: ThemeColors) {
  switch (variant) {
    case 'secondary':
      return { bg: 'transparent', fg: colors.text, border: colors.border, borderWidth: StyleSheet.hairlineWidth };
    case 'danger':
      return { bg: colors.danger, fg: colors.dangerText, border: 'transparent', borderWidth: 0 };
    case 'ghost':
      return { bg: 'transparent', fg: colors.accent, border: 'transparent', borderWidth: 0 };
    case 'primary':
    default:
      return { bg: colors.accent, fg: colors.bg, border: 'transparent', borderWidth: 0 };
  }
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  label: { fontSize: fontSize.bodyLg, fontWeight: fontWeight.bold },
  labelSm: { fontSize: fontSize.body },
});
