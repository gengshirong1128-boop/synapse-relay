import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Pressable, ScrollView, StyleSheet } from 'react-native';
import { EffortLevel, PermissionMode, ResponseSpeed, TransportMode, useAppStore } from '../../store';
import { useRouter } from 'expo-router';
import { BackendBrand, getTheme } from '../../theme/colors';
import { getLocale, setLocale, t, Locale } from '../../i18n';
import { SettingsCard } from '../../components/settings/SettingsCard';
import { AgentSelector } from '../../components/settings/AgentSelector';
import { OptionChips } from '../../components/settings/OptionChips';
import { WorkspaceSelector } from '../../components/settings/WorkspaceSelector';
import { relayClient } from '../../services/websocket';

export default function SettingsScreen() {
  const {
    serverUrl,
    theme,
    activeBackend,
    claudeModel,
    codexModel,
    claudeModels,
    codexModels,
    effortLevel,
    permissionMode,
    claudeTransportMode,
    codexTransportMode,
    codexResponseSpeed,
    agentCapabilities,
    workspacePath,
    availableWorkspaces,
    availableTools,
    setServerUrl,
    setTheme,
    setActiveBackend,
    setClaudeModel,
    setCodexModel,
    setEffortLevel,
    setPermissionMode,
    setClaudeTransportMode,
    setCodexTransportMode,
    setCodexResponseSpeed,
    setWorkspacePath,
  } = useAppStore();

  const router = useRouter();
  const [localUrl, setLocalUrl] = useState(serverUrl);
  const [lang, setLang] = useState<Locale>(getLocale());
  const brand: BackendBrand = activeBackend === 'codex' ? 'codex' : 'claude';
  const colors = getTheme(brand, theme);
  const model = activeBackend === 'codex' ? codexModel : claudeModel;
  const setModel = activeBackend === 'codex' ? setCodexModel : setClaudeModel;
  const selectedTransportMode = activeBackend === 'codex' ? codexTransportMode : claudeTransportMode;
  const setSelectedTransportMode = activeBackend === 'codex' ? setCodexTransportMode : setClaudeTransportMode;
  const modelSource = activeBackend === 'codex' ? codexModels : claudeModels;
  const modelOptions = dedupeOptions([
    { id: '', label: '电脑端默认' },
    ...modelSource.map(m => ({ id: m, label: m })),
  ]);
  const officialRemoteAvailable = activeBackend === 'codex'
    ? agentCapabilities.codexAppServerAvailable
    : agentCapabilities.claudeRemoteControlAvailable;
  const officialRemoteWired = activeBackend === 'codex' && agentCapabilities.codexAppServerAvailable;

  useEffect(() => {
    relayClient.send({ type: 'list_workspaces', payload: {} });
    relayClient.send({ type: 'agent_info', payload: { backend: activeBackend } });
  }, [activeBackend]);

  const saveConnection = () => setServerUrl(localUrl);
  const refreshWorkspaces = () => relayClient.send({ type: 'list_workspaces', payload: {} });
  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLocale(next);
    setLang(next);
  };

  return (
    <View style={[st.container, { backgroundColor: colors.bg }]}>
      <ScrollView style={st.scroller} contentContainerStyle={st.content}>
        <Text style={[st.section, { color: colors.textTertiary }]}>{t('settings').toUpperCase()}</Text>

        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>Agent 工具</Text>
          <AgentSelector activeBackend={activeBackend} colors={colors} onChange={setActiveBackend} />
          <Text style={[st.sub, { color: colors.textTertiary }]}>
            切换的是电脑端真实 agent，连接模式在下面单独选择。
          </Text>
        </SettingsCard>

        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>连接模式</Text>
          <OptionChips
            colors={colors}
            value={selectedTransportMode}
            options={[
              {
                id: 'official-remote',
                label: `${activeBackend === 'codex' ? 'Codex' : 'Claude Code'} Desktop`,
                description: activeBackend === 'codex' ? '官方 app-server，同步 thread 和审批' : 'remote-control，当前仅探测状态',
              },
              {
                id: 'bridge',
                label: `${activeBackend === 'codex' ? 'Codex' : 'Claude Code'} CLI`,
                description: activeBackend === 'codex' ? 'codex exec --json 一次性运行' : 'claude --print stream-json',
              },
            ]}
            onChange={(value) => setSelectedTransportMode(value as TransportMode)}
          />
          <View style={st.statusRow}>
            <Text style={[st.statusValue, { color: colors.text }]}>
              {selectedTransportMode === 'official-remote' ? 'Desktop' : 'CLI'}
            </Text>
            <Text style={[st.statusPill, { color: officialRemoteWired ? colors.accent : colors.textTertiary, borderColor: colors.border }]}>
              {selectedTransportMode === 'bridge'
                ? 'CLI 可用'
                : officialRemoteWired
                  ? 'Desktop 已接入'
                  : officialRemoteAvailable
                    ? 'Desktop 待接入'
                    : 'Desktop 未探测到'}
            </Text>
          </View>
          <Text style={[st.sub, { color: colors.textTertiary }]}>
            Codex Desktop 连接电脑端 app-server；Codex CLI 使用本机 `codex exec`。Claude Code Desktop 入口已保留，发消息仍需等 remote-control 协议接入。
          </Text>
        </SettingsCard>

        <SettingsCard colors={colors}>
          <WorkspaceSelector
            colors={colors}
            value={workspacePath}
            workspaces={availableWorkspaces}
            onChange={setWorkspacePath}
            onRefresh={refreshWorkspaces}
          />
        </SettingsCard>

        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>模型</Text>
          <OptionChips colors={colors} value={model} options={modelOptions} onChange={setModel} />
          <Text style={[st.sub, { color: colors.textTertiary }]}>
            列表来自电脑端 agent 配置或缓存；选择“电脑端默认”时不传 model 参数。
          </Text>
        </SettingsCard>

        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>思考深度</Text>
          <OptionChips
            colors={colors}
            value={effortLevel}
            options={[
              { id: 'low', label: '快速' },
              { id: 'medium', label: '标准' },
              { id: 'high', label: '深度' },
            ]}
            onChange={(value) => setEffortLevel(value as EffortLevel)}
          />
          <Text style={[st.sub, { color: colors.textTertiary }]}>
            {activeBackend === 'codex' ? '写入 Codex model_reasoning_effort。' : '传给 Claude Code --effort。'}
          </Text>
        </SettingsCard>

        {activeBackend === 'codex' && (
          <SettingsCard colors={colors}>
            <Text style={[st.label, { color: colors.text }]}>回复速度</Text>
            <OptionChips
              colors={colors}
              value={codexResponseSpeed}
              options={[
                { id: 'standard', label: '标准' },
                { id: 'priority', label: '优先' },
              ]}
              onChange={(value) => setCodexResponseSpeed(value as ResponseSpeed)}
            />
          </SettingsCard>
        )}

        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>权限</Text>
          <OptionChips
            colors={colors}
            value={permissionMode}
            options={[
              { id: 'default', label: '默认' },
              { id: 'plan', label: '只读/计划' },
              { id: 'auto', label: '工作区写入' },
              { id: 'bypassPermissions', label: '完全访问' },
            ]}
            onChange={(value) => setPermissionMode(value as PermissionMode)}
          />
          <Text style={[st.sub, { color: colors.textTertiary }]}>
            想在手机上实时点「允许/拒绝」，需用 Codex Desktop（app-server）模式；
            CLI 模式下权限按上面的选择预先授权，不会中途弹审批。
          </Text>
        </SettingsCard>

        {!!availableTools.length && (
          <SettingsCard colors={colors}>
            <Text style={[st.label, { color: colors.text }]}>本机工具</Text>
            <Text style={[st.sub, { color: colors.textSecondary }]} numberOfLines={4}>
              {availableTools.join(', ')}
            </Text>
          </SettingsCard>
        )}

        <Text style={[st.section, { color: colors.textTertiary }]}>连接</Text>
        <SettingsCard colors={colors}>
          <Text style={[st.label, { color: colors.text }]}>{t('serverAddress')}</Text>
          <TextInput
            style={[st.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
            value={localUrl}
            onChangeText={setLocalUrl}
            placeholder="ws://192.168.x.x:8765"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={[st.btn, { backgroundColor: colors.accent }]} onPress={saveConnection}>
            <Text style={[st.btnText, { color: colors.bg }]}>保存</Text>
          </Pressable>
          <Pressable style={st.link} onPress={() => router.push('/connect')}>
            <Text style={[st.linkText, { color: colors.accent }]}>{t('pairConnect')}</Text>
          </Pressable>
        </SettingsCard>

        <Text style={[st.section, { color: colors.textTertiary }]}>外观</Text>
        <SettingsCard colors={colors}>
          <View style={st.row}>
            <Text style={[st.rowLabel, { color: colors.text }]}>{t('darkMode')}</Text>
            <Switch value={theme === 'dark'} onValueChange={(v) => setTheme(v ? 'dark' : 'light')} trackColor={{ true: colors.accent, false: colors.border }} />
          </View>
          <View style={[st.divider, { backgroundColor: colors.border }]} />
          <View style={st.row}>
            <Text style={[st.rowLabel, { color: colors.text }]}>{t('language')}</Text>
            <Pressable onPress={toggleLang} style={[st.langBtn, { borderColor: colors.border }]}>
              <Text style={[st.langText, { color: colors.text }]}>{lang === 'zh' ? '中文' : 'EN'}</Text>
            </Pressable>
          </View>
        </SettingsCard>

        <Text style={[st.section, { color: colors.textTertiary }]}>关于</Text>
        <SettingsCard colors={colors}>
          <Text style={[st.rowLabel, { color: colors.text }]}>CodexMobile v1.0.0</Text>
          <Text style={[st.sub, { color: colors.textSecondary }]}>Remote Claude Code / Codex CLI</Text>
        </SettingsCard>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  scroller: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },
  section: { fontSize: 12, fontWeight: '700', marginTop: 20, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  label: { fontSize: 14, marginBottom: 6, fontWeight: '700' },
  input: { alignSelf: 'stretch', minWidth: 0, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12, borderWidth: 1 },
  btn: { alignSelf: 'stretch', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnText: { fontSize: 15, fontWeight: '700' },
  link: { marginTop: 12, alignItems: 'center' },
  linkText: { fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontSize: 15 },
  divider: { height: 1, marginVertical: 12 },
  langBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  langText: { fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusValue: { fontSize: 16, fontWeight: '800' },
  statusPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
});

function dedupeOptions(options: { id: string; label: string }[]) {
  const seen = new Set<string>();
  return options.filter(option => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}
