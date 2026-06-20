import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  label: string;
};

// A section divider with a short accent bar, giving the settings list a clear
// visual rhythm instead of a flat run of identical cards.
export function SectionLabel({ colors, label }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: colors.accent }]} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 10 },
  bar: { width: 3, height: 14, borderRadius: 2 },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
});
