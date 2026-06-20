import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { pairAndSave } from '../services/auth';
import { getTheme } from '../theme/colors';

export default function ConnectScreen() {
  const router = useRouter();
  const { serverUrl, activeBackend, theme, scannedPairing, setScannedPairing } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const [url, setUrl] = useState(serverUrl || 'ws://');
  const [code, setCode] = useState('');
  const [connecting, setConnecting] = useState(false);

  // When the scanner returns a {url, code} payload, prefill the form and clear
  // it from the store so it doesn't re-apply on a later visit.
  useEffect(() => {
    if (scannedPairing) {
      if (scannedPairing.url) setUrl(scannedPairing.url);
      if (scannedPairing.code) setCode(scannedPairing.code);
      setScannedPairing(null);
    }
  }, [scannedPairing, setScannedPairing]);

  const handleConnect = async () => {
    if (!url.trim()) return;
    if (code.trim().length !== 6) {
      Alert.alert('配对码无效', '请输入 6 位配对码');
      return;
    }
    setConnecting(true);
    const ok = await pairAndSave(url.trim(), code.trim());
    setConnecting(false);
    if (ok) {
      Alert.alert('连接成功', '已连接到中继服务', [
        { text: '开始使用', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('认证失败', '配对码错误或已过期');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>连接到中继服务</Text>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>在 Windows 终端运行中继服务后，扫描终端显示的二维码，或手动输入地址和配对码</Text>

      <Pressable
        style={[styles.scanBtn, { backgroundColor: colors.accent }]}
        onPress={() => router.push('/scan')}
      >
        <Text style={styles.scanBtnText}>扫描二维码连接</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.inputBorder }]} />
        <Text style={[styles.dividerText, { color: colors.textTertiary }]}>或手动输入</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.inputBorder }]} />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>服务器地址</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
        value={url}
        onChangeText={setUrl}
        placeholder="ws://192.168.1.100:8765"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>配对码（6位数字）</Text>
      <TextInput
        style={[styles.input, styles.codeInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
        value={code}
        onChangeText={setCode}
        placeholder="000000"
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
        maxLength={6}
      />

      <Pressable
        style={[styles.connectBtn, { backgroundColor: colors.accent }, connecting && styles.connectBtnDisabled]}
        onPress={handleConnect}
        disabled={connecting}
      >
        <Text style={styles.connectBtnText}>{connecting ? '连接中...' : '连接'}</Text>
      </Pressable>

      <View style={[styles.helpSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.helpTitle, { color: colors.text }]}>使用说明</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>1. 在 Windows 上双击 relay-server/start.bat 启动中继服务</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>2. 终端会显示 6 位配对码和连接地址</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>3. 同一 WiFi 下用局域网地址；不同网络用 Tunnel 地址</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>4. 扫码自动填入，或手动输入上面两项</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 20 },
  hint: { fontSize: 14, marginTop: 8, marginBottom: 24 },
  scanBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  scanBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, marginHorizontal: 12 },
  label: { fontSize: 14, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  connectBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  helpSection: { marginTop: 40, padding: 16, borderRadius: 12 },
  helpTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  helpText: { fontSize: 13, lineHeight: 22 },
});
