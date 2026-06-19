import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  children: React.ReactNode;
};

export function SettingsCard({ colors, children }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', minWidth: 0, overflow: 'hidden', borderRadius: 12, padding: 16, borderWidth: 1 },
});
