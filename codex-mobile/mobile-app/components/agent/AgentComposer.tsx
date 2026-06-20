import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  value: string;
  placeholder: string;
  colors: ThemeColors;
  isStreaming?: boolean;
  disabledReason?: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onAttach?: () => void;
};

export function AgentComposer({ value, placeholder, colors, isStreaming, disabledReason, onChange, onSend, onStop, onAttach }: Props) {
  const canSend = !!value.trim() && !disabledReason;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
      {!!disabledReason && (
        <Text style={[styles.disabledText, { color: colors.textTertiary }]} numberOfLines={1}>
          {disabledReason}
        </Text>
      )}
      <View style={styles.composer}>
        <Pressable style={styles.attachBtn} onPress={onAttach} disabled={!!disabledReason} accessibilityRole="button" accessibilityLabel="添加图片附件">
          <Text style={[styles.attachIcon, { color: disabledReason ? colors.textTertiary : colors.textSecondary }]}>+</Text>
        </Pressable>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
          value={value}
          onChangeText={onChange}
          placeholder={disabledReason || placeholder}
          placeholderTextColor={colors.placeholder}
          editable={!disabledReason}
          multiline
          returnKeyType="send"
          onSubmitEditing={canSend ? onSend : undefined}
        />
        {isStreaming ? (
          <Pressable style={[styles.stopBtn, { backgroundColor: colors.danger }]} onPress={onStop} accessibilityRole="button" accessibilityLabel="停止运行">
            <Text style={[styles.stopIcon, { color: colors.dangerText }]}>■</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendBtn, { backgroundColor: canSend ? colors.accent : colors.surfaceAlt }]}
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="发送消息"
            accessibilityState={{ disabled: !canSend }}
          >
            <Text style={[styles.sendIcon, { color: canSend ? colors.bg : colors.textTertiary }]}>↑</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 14 },
  disabledText: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 2 },
  attachBtn: { width: 40, height: 46, justifyContent: 'center', alignItems: 'center' },
  attachIcon: { fontSize: 24, fontWeight: '500' },
  input: { flex: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, maxHeight: 120, borderWidth: StyleSheet.hairlineWidth },
  sendBtn: { marginLeft: 8, width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { fontSize: 22, fontWeight: '800' },
  stopBtn: { marginLeft: 8, width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  stopIcon: { fontSize: 18, fontWeight: '800' },
});
