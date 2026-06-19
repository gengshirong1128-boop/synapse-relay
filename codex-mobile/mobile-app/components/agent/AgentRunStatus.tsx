import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors } from '../../theme/colors';

type Props = {
  colors: ThemeColors;
  hasToolUse?: boolean;
  hasThinking?: boolean;
  onStop?: () => void;
};

export function AgentRunStatus({ colors, hasToolUse, hasThinking, onStop }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const label = hasToolUse ? '正在执行工具' : hasThinking ? '正在思考' : '正在连接本机 agent';
  const timeStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;

  return (
    <View style={[styles.status, { backgroundColor: colors.thinkingBg, borderTopColor: colors.border }]}>
      <Animated.View
        style={[
          styles.spinner,
          { borderColor: colors.border, borderTopColor: colors.accent, transform: [{ rotate }] },
        ]}
      />
      <Text style={[styles.text, { color: colors.thinkingText }]}>{label}</Text>
      <Text style={[styles.time, { color: colors.textTertiary }]}>{timeStr}</Text>
      <Pressable onPress={onStop} style={[styles.stopButton, { borderColor: colors.border }]}>
        <Text style={[styles.stopText, { color: colors.text }]}>停止</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  text: { fontSize: 14, fontWeight: '600', flex: 1 },
  time: { fontSize: 12 },
  stopButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stopText: { fontSize: 12, fontWeight: '700' },
});
