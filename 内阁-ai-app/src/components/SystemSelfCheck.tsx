/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

type CheckState = {
  ok?: boolean;
  [key: string]: unknown;
};

type ReadinessState = {
  coreReady?: boolean;
  apiReady?: boolean;
  webAIReady?: boolean;
  fullReady?: boolean;
  mode?: string;
  blockers?: string[];
  actions?: ReadinessAction[];
};

type ReadinessAction = {
  id: string;
  kind: 'http' | 'manual';
  label: string;
  description?: string;
  method?: 'GET' | 'POST' | 'PATCH';
  endpoint?: string;
  refreshAfter?: boolean;
};

type SelfCheckResult = {
  ok: boolean;
  overall_ok?: boolean;
  readiness?: ReadinessState;
  checks?: Record<string, CheckState>;
  backend?: CheckState;
  frontend?: CheckState;
  desktop?: CheckState;
  providers?: CheckState & {
    profile_count?: number;
    configured_count?: number;
  };
  localTools?: CheckState & {
    total?: number;
    callable?: number;
  };
  fileReader?: CheckState;
  mockCouncil?: CheckState & {
    opinion_count?: number;
  };
  apiDebate?: CheckState;
  apiFinalize?: CheckState;
  aiMembers?: CheckState;
  webAI?: CheckState & {
    browser_available?: boolean;
    supported_count?: number;
    callable_count?: number;
  };
  ccSwitch?: CheckState & {
    health?: boolean;
    routeReady?: boolean;
    message?: string;
  };
  utilityFeatures?: CheckState;
  warnings?: string[];
};

interface SystemSelfCheckProps {
  backendUrl: string;
  language: 'zh' | 'en';
  isLight: boolean;
}

export const SystemSelfCheck: React.FC<SystemSelfCheckProps> = ({ backendUrl, language, isLight }) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'warning' | 'failed'>('idle');
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [message, setMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const isEn = language === 'en';

  const labels = {
    title: isEn ? 'System self-check' : '系统自检',
    run: isEn ? 'Run check' : '开始自检',
    idle: isEn ? 'Not checked' : '未检查',
    checking: isEn ? 'Checking' : '检查中',
    ok: isEn ? 'Ready' : '可用',
    warning: isEn ? 'Warnings' : '有警告',
    failed: isEn ? 'Failed' : '失败',
    backend: isEn ? 'Backend' : '后端',
    frontend: isEn ? 'Frontend build' : '前端构建',
    desktop: isEn ? 'Desktop shell' : '桌面壳',
    providers: isEn ? 'Providers' : '模型配置',
    localTools: isEn ? 'Local tools' : '本地工具',
    fileReader: isEn ? 'File reader' : '文件读取',
    mockCouncil: isEn ? 'Mock council' : '模拟会审',
    noWarnings: isEn ? 'No warnings.' : '暂无警告。',
    backendError: isEn ? 'Cannot reach backend self-check endpoint.' : '无法访问后端自检接口。',
    apiDebate: isEn ? 'API Debate' : 'API 辩论',
    apiFinalize: isEn ? 'API Finalize' : 'API 定案',
    aiMembers: isEn ? 'AI Members' : 'AI 成员',
    profiles: isEn ? 'profiles' : '配置',
    configured: isEn ? 'configured' : '已配置',
    callable: isEn ? 'callable' : '可调用',
    opinions: isEn ? 'opinions' : '意见',
  };

  const readinessLabels = {
    title: isEn ? 'Readiness' : '\u5c31\u7eea\u72b6\u6001',
    core: isEn ? 'Core' : '\u6838\u5fc3',
    api: 'API',
    webAI: isEn ? 'Web AI' : '\u7f51\u9875 AI',
    full: isEn ? 'Full' : '\u5b8c\u6574',
    mode: isEn ? 'mode' : '\u6a21\u5f0f',
    blockers: isEn ? 'Blockers' : '\u963b\u585e\u9879',
    actions: isEn ? 'Actions' : '\u53ef\u6267\u884c\u64cd\u4f5c',
    runAction: isEn ? 'Run' : '\u6267\u884c',
    manualAction: isEn ? 'Manual' : '\u624b\u52a8',
    actionDone: isEn ? 'Action completed.' : '\u64cd\u4f5c\u5df2\u5b8c\u6210\u3002',
    actionFailed: isEn ? 'Action failed.' : '\u64cd\u4f5c\u5931\u8d25\u3002',
  };

  const checkItems = [
    { key: 'backend', label: labels.backend, detail: '' },
    { key: 'frontend', label: labels.frontend, detail: '' },
    { key: 'desktop', label: labels.desktop, detail: '' },
    {
      key: 'providers',
      label: labels.providers,
      detail: result?.providers
        ? `${result.providers.profile_count ?? 0} ${labels.profiles} / ${result.providers.configured_count ?? 0} ${labels.configured}`
        : '',
    },
    {
      key: 'localTools',
      label: labels.localTools,
      detail: result?.localTools ? `${result.localTools.callable ?? 0}/${result.localTools.total ?? 0} ${labels.callable}` : '',
    },
    { key: 'fileReader', label: labels.fileReader, detail: '' },
    {
      key: 'mockCouncil',
      label: labels.mockCouncil,
      detail: result?.mockCouncil ? `${result.mockCouncil.opinion_count ?? 0} ${labels.opinions}` : '',
    },
    { key: 'apiDebate', label: labels.apiDebate, detail: '' },
    { key: 'apiFinalize', label: labels.apiFinalize, detail: '' },
    { key: 'aiMembers', label: labels.aiMembers, detail: '' },
    {
      key: 'webAI',
      label: isEn ? 'Web AI' : '网页 AI',
      detail: result?.webAI ? `${result.webAI.callable_count ?? 0}/${result.webAI.supported_count ?? 0} ${labels.callable}` : '',
    },
    {
      key: 'ccSwitch',
      label: 'CC Switch',
      detail: result?.ccSwitch?.routeReady ? 'route ready' : String(result?.ccSwitch?.message || ''),
    },
    { key: 'utilityFeatures', label: isEn ? 'Issue & image tools' : '问题反馈与图像创作', detail: '' },
  ] as const;

  const runSelfCheck = async () => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) {
      setStatus('failed');
      setMessage(labels.backendError);
      return;
    }

    setStatus('checking');
    setMessage('');

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(`${base}/system/self-check`, { signal: controller.signal });
      window.clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = (await resp.json()) as SelfCheckResult;
      const warnings = data.warnings || [];
      setResult(data);
      const isOk = data.overall_ok ?? data.ok;
      const fullReady = data.readiness?.fullReady ?? isOk;
      setStatus(isOk ? (warnings.length > 0 || !fullReady ? 'warning' : 'ok') : 'failed');
    } catch {
      setResult(null);
      setStatus('failed');
      setMessage(labels.backendError);
    }
  };

  useEffect(() => {
    void runSelfCheck();
  }, [backendUrl]);

  const runReadinessAction = async (action: ReadinessAction) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    setActionMessage('');
    if (action.kind !== 'http' || !action.endpoint) {
      setActionMessage(action.description || readinessLabels.manualAction);
      return;
    }
    if (!base || !action.endpoint.startsWith('/')) {
      setActionMessage(labels.backendError);
      return;
    }

    setActionBusyId(action.id);
    try {
      const resp = await fetch(`${base}${action.endpoint}`, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setActionMessage(action.description || readinessLabels.actionDone);
      if (action.refreshAfter) {
        await runSelfCheck();
      }
    } catch {
      setActionMessage(readinessLabels.actionFailed);
    } finally {
      setActionBusyId(null);
    }
  };

  const statusText = status === 'checking'
    ? labels.checking
    : status === 'ok'
      ? labels.ok
      : status === 'warning'
        ? labels.warning
        : status === 'failed'
          ? labels.failed
          : labels.idle;

  const statusClass = status === 'ok'
    ? 'text-emerald-500 border-emerald-500/25 bg-emerald-500/10'
    : status === 'warning'
      ? 'text-amber-500 border-amber-500/25 bg-amber-500/10'
      : status === 'failed'
        ? 'text-rose-500 border-rose-500/25 bg-rose-500/10'
        : isLight ? 'text-stone-500 border-stone-200 bg-stone-50' : 'text-stone-400 border-stone-800 bg-stone-950';

  const panelClass = isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/60 border-stone-800';
  const mutedClass = isLight ? 'text-stone-500' : 'text-stone-400';
  const readinessItems = result?.readiness ? [
    { key: 'coreReady', label: readinessLabels.core, ok: Boolean(result.readiness.coreReady) },
    { key: 'apiReady', label: readinessLabels.api, ok: Boolean(result.readiness.apiReady) },
    { key: 'webAIReady', label: readinessLabels.webAI, ok: Boolean(result.readiness.webAIReady) },
    { key: 'fullReady', label: readinessLabels.full, ok: Boolean(result.readiness.fullReady) },
  ] : [];

  return (
    <section className={`p-4 border rounded-xl space-y-3 ${panelClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold text-sm">{labels.title}</div>
        <span className={`text-[10px] border rounded-full px-2 py-1 ${statusClass}`}>{statusText}</span>
      </div>

      <button
        type="button"
        onClick={runSelfCheck}
        className="px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-stone-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
        {labels.run}
      </button>

      {message && <p className="text-[11px] text-rose-500">{message}</p>}

      {result && (
        <>
          {result.readiness && (
            <div className={`rounded-lg border px-3 py-2 text-xs ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="font-bold">{readinessLabels.title}</div>
                <span className={`text-[10px] rounded-full border px-2 py-0.5 ${statusClass}`}>
                  {readinessLabels.mode}: {result.readiness.mode || 'unknown'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {readinessItems.map((item) => (
                  <div key={item.key} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
                    <span className="font-semibold truncate">{item.label}</span>
                    {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                  </div>
                ))}
              </div>
              {(result.readiness.blockers || []).length > 0 && (
                <div className={`mt-2 text-[11px] ${mutedClass}`}>
                  <span className="font-semibold">{readinessLabels.blockers}: </span>
                  {(result.readiness.blockers || []).join(' / ')}
                </div>
              )}
              {(result.readiness.actions || []).length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="font-bold text-[11px]">{readinessLabels.actions}</div>
                  <div className="flex flex-wrap gap-2">
                    {(result.readiness.actions || []).map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => void runReadinessAction(action)}
                        disabled={actionBusyId === action.id}
                        className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition ${action.kind === 'http' ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-stone-950' : isLight ? 'border-stone-200 text-stone-600 bg-stone-50' : 'border-stone-800 text-stone-300 bg-stone-950'}`}
                        title={action.description || action.label}
                      >
                        {actionBusyId === action.id ? readinessLabels.runAction : action.label}
                      </button>
                    ))}
                  </div>
                  {actionMessage && <div className={`text-[11px] ${mutedClass}`}>{actionMessage}</div>}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checkItems.map((item) => {
              const check = result[item.key] as CheckState | undefined;
              const ok = Boolean(check?.ok);
              return (
                <div key={item.key} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{item.label}</div>
                    {item.detail && <div className={`text-[10px] ${mutedClass}`}>{item.detail}</div>}
                  </div>
                  {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                </div>
              );
            })}
          </div>

          <div className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              {labels.warning}
            </div>
            {(result.warnings || []).length > 0 ? (
              <ul className="space-y-1">
                {(result.warnings || []).map((warning, index) => (
                  <li key={`${warning}-${index}`} className={mutedClass}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className={mutedClass}>{labels.noWarnings}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};
