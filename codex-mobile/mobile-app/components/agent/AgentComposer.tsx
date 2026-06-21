import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';
import { border, fontSize, fontWeight, radius, spacing } from '../../theme/tokens';

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
        <ComposerIconButton
          colors={colors}
          onPress={onAttach}
          disabled={!!disabledReason}
          accessibilityLabel="添加图片附件"
          icon={<AttachIcon color={disabledReason ? colors.textTertiary : colors.textSecondary} />}
        />
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
          <ComposerIconButton
            colors={colors}
            onPress={onStop}
            accessibilityLabel="停止运行"
            backgroundColor={colors.danger}
            icon={<StopIcon color={colors.dangerText} />}
          />
        ) : (
          <ComposerIconButton
            colors={colors}
            onPress={onSend}
            disabled={!canSend}
            accessibilityLabel="发送消息"
            accessibilityState={{ disabled: !canSend }}
            backgroundColor={canSend ? colors.accent : colors.surfaceAlt}
            icon={<SendIcon color={canSend ? colors.bg : colors.textTertiary} />}
          />
        )}
      </View>
    </View>
  );
}

function ComposerIconButton({
  colors,
  icon,
  accessibilityLabel,
  accessibilityState,
  backgroundColor,
  disabled,
  onPress,
}: {
  colors: ThemeColors;
  icon: React.ReactNode;
  accessibilityLabel: string;
  accessibilityState?: { disabled?: boolean };
  backgroundColor?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: backgroundColor || colors.surfaceAlt,
          opacity: disabled ? 0.48 : pressed ? 0.6 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState || { disabled: !!disabled }}
    >
      {icon}
    </Pressable>
  );
}

function AttachIcon({ color }: { color: string }) {
  return (
    <View style={styles.attachIcon}>
      <View style={[styles.attachRing, { borderColor: color }]} />
      <View style={[styles.attachStem, { backgroundColor: color }]} />
    </View>
  );
}

function SendIcon({ color }: { color: string }) {
  return (
    <View style={styles.sendIcon}>
      <View style={[styles.sendStem, { backgroundColor: color }]} />
      <View style={[styles.sendWingLeft, { backgroundColor: color }]} />
      <View style={[styles.sendWingRight, { backgroundColor: color }]} />
    </View>
  );
}

function StopIcon({ color }: { color: string }) {
  return <View style={[styles.stopIcon, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  disabledText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  iconButton: {
    width: spacing.xxl + spacing.lg,
    height: spacing.xxl + spacing.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.bodyLg,
    lineHeight: fontSize.bodyLg + spacing.sm,
    maxHeight: spacing.xxl * spacing.xs + spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attachIcon: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachRing: {
    width: spacing.md,
    height: spacing.lg,
    borderWidth: border.thin,
    borderRadius: radius.md,
    transform: [{ rotate: '36deg' }],
  },
  attachStem: {
    position: 'absolute',
    width: border.thin,
    height: spacing.md,
    borderRadius: radius.sm,
    transform: [{ rotate: '36deg' }],
  },
  sendIcon: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendStem: {
    position: 'absolute',
    width: border.thin,
    height: spacing.lg,
    borderRadius: radius.sm,
  },
  sendWingLeft: {
    position: 'absolute',
    width: border.thin,
    height: spacing.md,
    borderRadius: radius.sm,
    transform: [{ translateX: -spacing.xs }, { translateY: -spacing.xs }, { rotate: '45deg' }],
  },
  sendWingRight: {
    position: 'absolute',
    width: border.thin,
    height: spacing.md,
    borderRadius: radius.sm,
    transform: [{ translateX: spacing.xs }, { translateY: -spacing.xs }, { rotate: '-45deg' }],
  },
  stopIcon: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.sm,
  },
});
