import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { fontSize, fontWeight, radius, spacing } from '../../theme/tokens';

// Container card. surface bg + hairline border + lg radius. highlight uses the
// accent border for the most important cards (model / connection).
export function Card({
  colors,
  children,
  highlight,
  style,
}: {
  colors: ThemeColors;
  children: React.ReactNode;
  highlight?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: highlight ? colors.accent : colors.border },
        highlight && styles.highlight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Small status pill (e.g. session running/idle). tone picks the color role.
export function Badge({
  colors,
  label,
  tone = 'neutral',
}: {
  colors: ThemeColors;
  label: string;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  const fg = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.textSecondary;
  return (
    <View style={[styles.badge, { borderColor: colors.border }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// Uppercase section label with tracking, for grouping lists/settings.
export function SectionHeader({ colors, label }: { colors: ThemeColors; label: string }) {
  return <Text style={[styles.section, { color: colors.textTertiary }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  highlight: { borderWidth: 1.5 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  badgeText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  section: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
});
