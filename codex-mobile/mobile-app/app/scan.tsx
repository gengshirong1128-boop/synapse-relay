import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store';
import { getTheme } from '../theme/colors';
import { parsePairingQr } from '../services/pairing';

/**
 * Full-screen QR scanner. The relay-server prints a QR encoding
 * {"url": "wss://...", "code": "123456"}. On a successful scan we stash the
 * payload in the store and return to the connect screen, which prefills it.
 */
export default function ScanScreen() {
  const router = useRouter();
  const { activeBackend, theme, setScannedPairing } = useAppStore();
  const colors = getTheme(activeBackend === 'codex' ? 'codex' : 'claude', theme);
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  const onScanned = ({ data }: { data: string }) => {
    if (handled) return;
    setHandled(true);
    const pairing = parsePairingQr(data);
    if (!pairing) {
      // Surface why the scan was ignored, then allow another attempt instead of
      // silently doing nothing (which looks like the app froze).
      Alert.alert('二维码无法识别', '这不是有效的中继服务二维码，请扫描终端显示的连接二维码。', [
        { text: '重试', onPress: () => setHandled(false) },
      ]);
      return;
    }
    setScannedPairing(pairing);
    router.back();
  };

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.msg, { color: colors.text }]}>需要相机权限来扫描二维码</Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.accent }]} onPress={requestPermission}>
          <Text style={styles.btnText}>授予相机权限</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={[styles.link, { color: colors.textSecondary }]}>返回手动输入</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>将二维码对准取景框</Text>
      </View>
      <Pressable style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>取消</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontSize: 16, marginBottom: 20, textAlign: 'center' },
  btn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { marginTop: 16, padding: 8 },
  link: { fontSize: 14 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 2, borderColor: '#fff', borderRadius: 16, backgroundColor: 'transparent' },
  hint: { color: '#fff', fontSize: 15, marginTop: 20, textShadowColor: '#000', textShadowRadius: 4 },
  cancel: { position: 'absolute', bottom: 48, alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
