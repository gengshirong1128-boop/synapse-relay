import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  children: React.ReactNode;
  // Optional built-in header so callers don't repeat the label/sub markup.
  title?: string;
  subtitle?: string;
  icon?: string;
  // Emphasized card for the most important settings (model, connection mode).
  highlight?: boolean;
};

export function SettingsCard({ colors, children, title, subtitle, icon, highlight }: Props) {
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
          {!!icon && <Text style={[styles.icon, { color: colors.accent }]}>{icon}</Text>}
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
          </View>
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  icon: { fontSize: 17, marginTop: 1 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
