import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  children: React.ReactNode;
  // Optional built-in header so callers don't repeat the label/sub markup.
  title?: string;
  subtitle?: string;
  // Emphasized card for the most important settings (model, connection mode).
  highlight?: boolean;
};

export function SettingsCard({ colors, children, title, subtitle, highlight }: Props) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: highlight ? colors.accent : colors.border },
        highlight && styles.highlight,
      ]}
    >
      {!!title && (
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  highlight: { borderWidth: 1.5 },
  header: { marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
