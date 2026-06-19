import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

interface Props {
  code: string;
  language?: string;
  onCopy?: () => void;
}

export function CodeBlock({ code, language, onCopy }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{language || 'code'}</Text>
        <Pressable onPress={onCopy} style={styles.copyBtn}>
          <Text style={styles.copyText}>复制</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeArea}>
          {code.split('\n').map((line, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineNum}>{i + 1}</Text>
              <Text style={styles.codeLine}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1e1e1e', borderRadius: 8, marginVertical: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2d2d2d' },
  language: { fontSize: 12, color: '#8e8e93' },
  copyBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#3a3a3c' },
  copyText: { fontSize: 12, color: '#0a84ff' },
  codeArea: { padding: 12 },
  lineRow: { flexDirection: 'row', minHeight: 20 },
  lineNum: { width: 32, fontSize: 13, color: '#636366', fontFamily: 'monospace' },
  codeLine: { fontSize: 13, color: '#d4d4d4', fontFamily: 'monospace', flexShrink: 1 },
});
