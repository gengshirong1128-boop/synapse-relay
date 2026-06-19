import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

export type OptionChip = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  colors: ThemeColors;
  value: string;
  options: OptionChip[];
  onChange: (value: string) => void;
};

export function OptionChips({ colors, value, options, onChange }: Props) {
  return (
    <View style={styles.list}>
      {options.map(option => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            style={[
              styles.item,
              { borderColor: colors.border },
              active && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
            ]}
            onPress={() => onChange(option.id)}
          >
            <Text style={[styles.label, { color: active ? colors.accent : colors.text }]}>{option.label}</Text>
            {option.description && (
              <Text style={[styles.description, { color: colors.textTertiary }]}>{option.description}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  item: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  label: { fontSize: 13, fontWeight: '700' },
  description: { fontSize: 11, marginTop: 2 },
});
