/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Key,
  LogIn,
  Moon,
  RefreshCw,
  Server,
  Shield,
  Sliders,
  Sun,
  Trash2,
  Wrench,
} from 'lucide-react';
import { SystemSelfCheck } from './SystemSelfCheck';

interface SettingsProps {
  visualMode: 'cabinet' | 'un';
  onSetVisualMode: (mode: 'cabinet' | 'un') => void;
  theme: 'light' | 'dark';
  onSetTheme: (theme: 'light' | 'dark') => void;
  language: 'zh' | 'en';
  onSetLanguage: (lang: 'zh' | 'en') => void;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  onSetFontSize: (size: 'sm' | 'md' | 'lg' | 'xl') => void;
  onBack: () => void;
}

type ProviderStatus = 'idle' | 'testing' | 'success' | 'failed';

interface ApiConfigItem {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  status: ProviderStatus;
  configured: boolean;
  message?: string;
}

type WebAIStatus = 'open_only' | 'login_required' | 'logged_in' | 'callable' | 'error';
type WebsiteRoleId = 'chief' | 'code' | 'review' | 'summary' | 'translation';

interface AIWebsite {
  id: string;
  name: string;
  provider: string;
  website: string;
  apiWebsite?: string;
  freeTier?: boolean;
  loginRequired?: boolean;
  authMode?: string;
  roles?: string[];
  webAI?: {
    siteId: string;
    status: WebAIStatus;
    loginStatus: string;
    callable: boolean;
    hasAdapter: boolean;
    canOpen: boolean;
    canDetectLogin: boolean;
    canSendPrompt: boolean;
    message: string;
    limitations: string[];
  };
}

interface WebsiteLoginForm {
  username: string;
  passwordEnvName: string;
}

const defaultApiConfigs: ApiConfigItem[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    status: 'idle',
    configured: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
    status: 'idle',
    configured: false,
  },
  {
    id: 'anthropic',
    name: 'Claude',
    endpoint: 'https://api.anthropic.com/v1',
    apiKey: '',
    model: 'claude-3-5-sonnet-latest',
    status: 'idle',
    configured: false,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    model: 'gemini-1.5-flash',
    status: 'idle',
    configured: false,
  },
  {
    id: 'qwen',
    name: 'Qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-plus',
    status: 'idle',
    configured: false,
  },
  {
    id: 'ccswitch',
    name: 'CC Switch',
    endpoint: 'http://127.0.0.1:15721/v1',
    apiKey: '',
    model: 'gpt-5.5',
    status: 'idle',
    configured: false,
  },
];

const parseApiConfigs = (): ApiConfigItem[] => {
  const saved = localStorage.getItem('cabinet_api_configs');
  if (!saved) return defaultApiConfigs;

  try {
    const parsed = JSON.parse(saved) as Partial<ApiConfigItem>[];
    const result = [...defaultApiConfigs];
    // Merge saved defaults
    for (let i = 0; i < result.length; i++) {
      const existing = parsed.find((p) => p.id === result[i].id);
      if (existing) {
        result[i] = {
          ...result[i],
          ...existing,
          apiKey: existing.apiKey ?? '',
          status: existing.status === 'success' ? 'idle' : (existing.status ?? 'idle'),
          configured: Boolean(existing.apiKey),
        };
      }
    }
    // Append custom items (not in defaults)
    for (const item of parsed) {
      if (!result.find((r) => r.id === item.id)) {
        result.push({
          id: item.id || '',
          name: item.name || '',
          endpoint: item.endpoint || '',
          apiKey: item.apiKey || '',
          model: item.model || '',
          status: 'idle',
          configured: Boolean(item.apiKey),
          message: '',
        } as ApiConfigItem);
      }
    }
    return result;
  } catch {
    return defaultApiConfigs;
  }
};

export const Settings: React.FC<SettingsProps> = ({
  visualMode,
  onSetVisualMode,
  theme,
  onSetTheme,
  language,
  onSetLanguage,
  fontSize,
  onSetFontSize,
  onBack,
}) => {
  const [apiConfigs, setApiConfigs] = useState<ApiConfigItem[]>(parseApiConfigs);
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('cabinet_backend_url') || 'http://127.0.0.1:8000');
  const [backendStatus, setBackendStatus] = useState<ProviderStatus>('idle');
  const [backendMessage, setBackendMessage] = useState('');

  const [aiWebsites, setAiWebsites] = useState<AIWebsite[]>([]);
  const [websiteLoginOpen, setWebsiteLoginOpen] = useState<Record<string, boolean>>({});
  const [websiteLoginForm, setWebsiteLoginForm] = useState<Record<string, WebsiteLoginForm>>({});
  const [websitePromptForm, setWebsitePromptForm] = useState<Record<string, string>>({});
  const [websiteCallResult, setWebsiteCallResult] = useState<Record<string, string>>({});
  const [websiteCalling, setWebsiteCalling] = useState<Record<string, boolean>>({});
  const [websiteRoleForm, setWebsiteRoleForm] = useState<Record<string, WebsiteRoleId>>({});
  const [websiteAssignResult, setWebsiteAssignResult] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadAIWebsites = async () => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) return;
    try {
      const resp = await fetch(`${base}/ai-members/websites`);
      const data = (await resp.json()) as { websites?: AIWebsite[] };
      if (resp.ok && data.websites) setAiWebsites(data.websites);
    } catch {
      // Keep the last loaded website list.
    }
  };

  const mergeWebsite = (site?: AIWebsite) => {
    if (!site) return;
    setAiWebsites((prev) => prev.map((item) => (item.id === site.id ? site : item)));
  };

  useEffect(() => {
    void loadAIWebsites();
  }, [backendUrl]);

  const isEn = language === 'en';
  const isLight = theme === 'light';

  useEffect(() => {
    localStorage.setItem('cabinet_api_configs', JSON.stringify(apiConfigs));
  }, [apiConfigs]);

  useEffect(() => {
    localStorage.setItem('cabinet_backend_url', backendUrl.trim());
  }, [backendUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) return;

    fetch(`${base}/app-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, language, fontSize, visualMode, backendUrl: base }),
      signal: controller.signal,
    }).catch(() => {
      // The UI remains usable when the backend is not running.
    });

    return () => controller.abort();
  }, [backendUrl, fontSize, language, theme, visualMode]);

  const text = {
    title: isEn ? 'Settings' : '系统设置',
    subtitle: isEn ? 'Display, language, backend and model connection settings.' : '管理外观、语言、后端地址和模型连接。',
    done: isEn ? 'Done' : '完成',
    appearance: isEn ? 'Appearance' : '外观',
    theme: isEn ? 'Theme' : '明暗模式',
    dark: isEn ? 'Dark' : '深色',
    light: isEn ? 'Light' : '浅色',
    mode: isEn ? 'View' : '界面风格',
    cabinet: isEn ? 'Cabinet' : '内阁',
    modern: isEn ? 'Modern' : '现代',
    language: isEn ? 'Language' : '语言',
    font: isEn ? 'Font size' : '字体大小',
    backend: isEn ? 'Backend' : '后端',
    backendUrl: isEn ? 'Backend URL' : '后端地址',
    checkBackend: isEn ? 'Check backend' : '检查后端',
    models: isEn ? 'Model providers' : '模型配置',
    endpoint: isEn ? 'Endpoint' : '接口地址',
    model: isEn ? 'Model' : '模型',
    key: isEn ? 'API key' : 'API Key',
    show: isEn ? 'Show' : '显示',
    hide: isEn ? 'Hide' : '隐藏',
    clear: isEn ? 'Clear' : '清空',
    test: isEn ? 'Check' : '检查',
    idle: isEn ? 'Not checked' : '未检查',
    testing: isEn ? 'Checking' : '检查中',
    success: isEn ? 'Ready' : '已配置',
    failed: isEn ? 'Failed' : '失败',
    safety: isEn ? 'Safety' : '安全',
    safetyText: isEn
      ? 'Keys are saved only in localStorage for local development. Do not print or share them. Use the backend proxy for real calls.'
      : '密钥仅保存在本机 localStorage，供本地开发使用。不要打印或分享密钥，真实调用建议走后端代理。',
    aiWebsites: isEn ? 'Free AI Websites' : '免费 AI 网站',
    aiWebsitesDesc: isEn ? 'Open or log in to free AI chat platforms.' : '快速打开或配置免费 AI 对话平台。',
    openWebsite: isEn ? 'Website' : '官网',
    openApi: isEn ? 'API' : 'API 平台',
    loginConfig: isEn ? 'Login' : '登录配置',
    freeTier: isEn ? 'Free' : '免费',
    loginRequired: isEn ? 'Login required' : '需登录',
    noLogin: isEn ? 'No login' : '无需登录',
    saveLogin: isEn ? 'Save' : '保存',
    openLogin: isEn ? 'Open login page' : '打开网页登录',
    username: isEn ? 'Username' : '用户名',
    passwordEnv: isEn ? 'Password Env Name' : '密码环境变量名',
  };

  const cardClass = isLight
    ? 'bg-white border-stone-200 text-stone-800'
    : 'bg-stone-900 border-stone-800 text-stone-100';
  const mutedClass = isLight ? 'text-stone-500' : 'text-stone-400';
  const inputClass = isLight
    ? 'bg-white border-stone-200 text-stone-800 placeholder:text-stone-400'
    : 'bg-stone-950 border-stone-800 text-stone-100 placeholder:text-stone-600';

  const selectButtonClass = (active: boolean) =>
    `px-3 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer ${
      active
        ? 'bg-amber-600 text-stone-950 border-amber-600'
        : isLight
          ? 'bg-stone-50 border-stone-200 text-stone-650 hover:bg-stone-100'
          : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-850'
    }`;

  const updateConfig = (id: string, field: 'endpoint' | 'apiKey' | 'model' | 'name', value: string) => {
    setApiConfigs((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              configured: field === 'apiKey' ? value.trim().length > 0 : item.configured,
              status: 'idle',
              message: '',
            }
          : item,
      ),
    );
  };

  const profileIdForProvider = (id: string) => {
    if (id === 'anthropic') return 'claude_default_profile';
    return `${id}_default_profile`;
  };

  const testProvider = async (id: string) => {
    const target = apiConfigs.find((item) => item.id === id);
    if (!target) return;

    setApiConfigs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'testing', message: '' } : item)),
    );

    const hasKey = target.apiKey.trim().length > 0 || id === 'ccswitch';
    const hasEndpoint = target.endpoint.trim().length > 0;
    const hasModel = target.model.trim().length > 0;
    if (!hasKey || !hasEndpoint || !hasModel) {
      setApiConfigs((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'failed',
                configured: false,
                message: !hasKey
                  ? isEn ? 'Missing API key' : '缺少 API Key'
                  : isEn ? 'Endpoint or model is empty' : '接口地址或模型为空',
              }
            : item,
        ),
      );
      return;
    }

    if (id === 'ccswitch') {
      try {
        const response = await fetch('/api/runtime-check');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const runtime = await response.json();
        const status = runtime.ccSwitch || {};
        const activeTargets = Array.isArray(status.activeTargets) ? status.activeTargets : [];
        const currentProvider = status.provider || 'unknown';
        const lastError = status.lastError || '';
        const serviceReachable = Boolean(status.health || status.ok);
        let routeReady = false;
        let routeMessage = lastError;
        if (serviceReachable) {
          const routeResponse = await fetch('/api/ccswitch/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: target.endpoint, apiKey: target.apiKey, model: target.model }),
          });
          const route = await routeResponse.json();
          routeReady = Boolean(route.routeReady);
          routeMessage = route.message || routeMessage;
          if (routeReady && route.workingModel) {
            target.model = String(route.workingModel);
          }
        }
        const hasProvider = routeReady;
        setApiConfigs((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: hasProvider ? 'success' : 'failed',
                  configured: hasProvider,
                  model: hasProvider ? target.model : item.model,
                  message: hasProvider
                    ? `CC Switch 已连接。Provider: ${currentProvider}；targets: ${activeTargets.length ? activeTargets.join(', ') : 'direct route'}${lastError ? `；last error: ${lastError}` : ''}`
                    : serviceReachable
                      ? `CC Switch 已启动，但路由不可调用。请检查当前 provider 的 base_url、API Key 和模型。${routeMessage ? ` ${routeMessage}` : ''}`
                      : `无法连接 CC Switch。请先启动 CC Switch，并确认本地路由地址为 http://127.0.0.1:15721。${lastError ? ` ${lastError}` : ''}`,
                }
              : item,
          ),
        );
      } catch {
        setApiConfigs((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'failed',
                  configured: false,
                  message: 'Cannot reach CC Switch. Start CC Switch Local Routing on http://127.0.0.1:15721.',
                }
              : item,
          ),
        );
      }
      return;
    }

    // Custom providers use the OpenAI-compatible smoke-test endpoint.
    if (!isDefaultProvider(id)) {
      try {
        const response = await fetch('/api/provider/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: target.endpoint, apiKey: target.apiKey, model: target.model }),
        });
        const data = await response.json();
        setApiConfigs((prev) => prev.map((item) => item.id === id ? {
          ...item,
          status: data.success ? 'success' : 'failed',
          configured: Boolean(data.success),
          message: data.success ? (isEn ? 'Relay test passed' : '中转站真实调用测试通过') : String(data.error || data.detail || '中转站调用失败'),
        } : item));
      } catch (error: any) {
        setApiConfigs((prev) => prev.map((item) => item.id === id ? {
          ...item,
          status: 'failed',
          configured: false,
          message: String(error?.message || '中转站调用失败'),
        } : item));
      }
      return;
    }

    const base = backendUrl.trim().replace(/\/$/, '');
    try {
      const profileId = profileIdForProvider(id);
      const envName = `${id === 'anthropic' ? 'CLAUDE' : id.toUpperCase()}_API_KEY_1`;
      const configureResp = await fetch(`${base}/provider-profiles/${profileId}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: target.endpoint,
          model: target.model,
          apiKey: target.apiKey,
          authEnvName: envName,
        }),
      });
      if (!configureResp.ok) throw new Error(`HTTP ${configureResp.status}`);

      const testResp = await fetch(`${base}/provider-profiles/${profileId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smoke_test: true, model: target.model }),
      });
      const data = await testResp.json();

      setApiConfigs((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: data.success ? 'success' : 'failed',
                configured: data.success,
                message: data.success
                  ? isEn ? 'Backend test passed' : '后端连接测试通过'
                  : String(data.error || data.detail || (isEn ? 'Backend test failed' : '后端连接测试失败')),
              }
            : item,
        ),
      );
    } catch {
      setApiConfigs((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'failed',
                message: isEn ? 'Backend is not reachable' : '无法连接后端',
              }
            : item,
        ),
      );
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void testProvider('ccswitch');
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const clearProvider = (id: string) => {
    setApiConfigs((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              apiKey: '',
              configured: false,
              status: 'idle',
              message: '',
            }
          : item,
      ),
    );
    if (visibleKeyId === id) setVisibleKeyId(null);
  };

  const isDefaultProvider = (id: string) => defaultApiConfigs.some((d) => d.id === id);

  const addCustomProvider = () => {
    const newId = `custom_${Date.now()}`;
    setApiConfigs((prev) => [
      ...prev,
      {
        id: newId,
        name: '',
        endpoint: '',
        apiKey: '',
        model: '',
        status: 'idle',
        configured: false,
        message: '',
      },
    ]);
  };

  const deleteCustomProvider = (id: string) => {
    if (!confirm(isEn ? 'Confirm delete custom config?' : '确认删除自定义配置？')) return;
    setApiConfigs((prev) => prev.filter((item) => item.id !== id));
    if (visibleKeyId === id) setVisibleKeyId(null);
  };

  const checkBackend = async () => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) {
      setBackendStatus('failed');
      setBackendMessage(isEn ? 'Backend URL is empty' : '后端地址为空');
      return;
    }

    setBackendStatus('testing');
    setBackendMessage('');

    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      const resp = await fetch(`${base}/health`, { signal: controller.signal });
      window.clearTimeout(timer);

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setBackendStatus('success');
      setBackendMessage(isEn ? 'Backend is reachable' : '后端可访问');
    } catch {
      setBackendStatus('failed');
      setBackendMessage(isEn ? 'Backend is not reachable' : '无法访问后端');
    }
  };

  const openAIWebsite = async (site: AIWebsite) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (base) {
      try {
        const resp = await fetch(`${base}/ai-members/websites/${site.id}/open`, { method: 'POST' });
        const data = (await resp.json()) as { opened?: boolean; site?: AIWebsite };
        if (resp.ok) mergeWebsite(data.site);
        if (resp.ok && data.opened) return;
      } catch {
        // Fall back to the current window environment below.
      }
    }
    window.open(site.website, '_blank', 'noopener,noreferrer');
  };

  const saveWebsiteLogin = async (siteId: string) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) return;
    const form = websiteLoginForm[siteId] || { username: '', passwordEnvName: '' };
    await fetch(`${base}/ai-members/websites/${siteId}/login`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, passwordEnvName: form.passwordEnvName, loginStatus: 'configured' }),
    }).catch(() => {});
    await fetch(`${base}/ai-members/websites/${siteId}/status`)
      .then((resp) => resp.json())
      .then((data: { site?: AIWebsite }) => mergeWebsite(data.site))
      .catch(() => {});
  };

  const openWebsiteLoginFallback = async (site: AIWebsite) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (base) {
      try {
        const resp = await fetch(`${base}/ai-members/websites/${site.id}/login-fallback`, { method: 'POST' });
        const data = (await resp.json()) as { opened?: boolean; site?: AIWebsite };
        if (resp.ok) mergeWebsite(data.site);
        if (resp.ok && data.opened) return;
      } catch {
        // Fall back to the current window environment below.
      }
    }
    window.open(site.website, '_blank', 'noopener,noreferrer');
  };

  const detectWebsiteLogin = async (siteId: string) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    if (!base) return;
    await fetch(`${base}/ai-members/websites/${siteId}/login-detect`, { method: 'POST' })
      .then((resp) => resp.json())
      .then((data: { site?: AIWebsite }) => mergeWebsite(data.site))
      .catch(() => {});
  };

  const callAIWebsite = async (siteId: string) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    const prompt = (websitePromptForm[siteId] || '').trim();
    if (!base || !prompt) return;
    setWebsiteCalling((prev) => ({ ...prev, [siteId]: true }));
    setWebsiteCallResult((prev) => ({ ...prev, [siteId]: '' }));
    try {
      const resp = await fetch(`${base}/ai-members/websites/${siteId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await resp.json();
      const payload = resp.ok ? data : data.detail;
      mergeWebsite(payload?.site);
      setWebsiteCallResult((prev) => ({
        ...prev,
        [siteId]: payload?.responseText || payload?.message || payload?.error || `HTTP ${resp.status}`,
      }));
    } catch {
      setWebsiteCallResult((prev) => ({ ...prev, [siteId]: isEn ? 'Request failed' : '请求失败' }));
    } finally {
      setWebsiteCalling((prev) => ({ ...prev, [siteId]: false }));
    }
  };

  const assignWebsiteRole = async (siteId: string) => {
    const base = backendUrl.trim().replace(/\/$/, '');
    const role = websiteRoleForm[siteId] || 'summary';
    if (!base) return;
    try {
      const resp = await fetch(`${base}/ai-members/roles/${role}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId: siteId }),
      });
      const data = await resp.json();
      setWebsiteAssignResult((prev) => ({
        ...prev,
        [siteId]: resp.ok
          ? `${role} -> webai:${siteId}`
          : (data.detail || `HTTP ${resp.status}`),
      }));
    } catch {
      setWebsiteAssignResult((prev) => ({ ...prev, [siteId]: isEn ? 'Assign failed' : '绑定失败' }));
    }
  };

  const statusLabel = (status: ProviderStatus) => {
    if (status === 'testing') return text.testing;
    if (status === 'success') return text.success;
    if (status === 'failed') return text.failed;
    return text.idle;
  };

  const statusClass = (status: ProviderStatus) => {
    if (status === 'success') return 'text-emerald-500 border-emerald-500/25 bg-emerald-500/10';
    if (status === 'failed') return 'text-rose-500 border-rose-500/25 bg-rose-500/10';
    if (status === 'testing') return 'text-amber-500 border-amber-500/25 bg-amber-500/10';
    return isLight ? 'text-stone-500 border-stone-200 bg-stone-50' : 'text-stone-400 border-stone-800 bg-stone-950';
  };

  const webAIStatusLabel = (status?: WebAIStatus) => {
    if (status === 'callable') return isEn ? 'Callable' : '可调用';
    if (status === 'logged_in') return isEn ? 'Logged in' : '已登录';
    if (status === 'login_required') return isEn ? 'Login required' : '需登录';
    if (status === 'error') return isEn ? 'Error' : '错误';
    return isEn ? 'Open only' : '仅打开';
  };

  const webAIStatusClass = (status?: WebAIStatus) => {
    if (status === 'callable') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
    if (status === 'logged_in') return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25';
    if (status === 'login_required') return 'bg-amber-500/10 text-amber-500 border-amber-500/25';
    if (status === 'error') return 'bg-rose-500/10 text-rose-500 border-rose-500/25';
    return isLight ? 'bg-stone-100 text-stone-500 border-stone-200' : 'bg-stone-900 text-stone-400 border-stone-800';
  };

  return (
    <div className={`w-full max-w-5xl mx-auto py-8 px-5 animate-fadeIn space-y-6 font-sans ${isLight ? 'text-stone-800' : 'text-stone-100'}`}>
      <div className={`flex items-center justify-between gap-4 pb-4 border-b ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
        <div>
          <h1 className="text-2xl font-extrabold font-display tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-500" />
            {text.title}
          </h1>
          <p className={`text-xs mt-1 ${mutedClass}`}>{text.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition cursor-pointer"
        >
          {text.done}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={`p-5 border rounded-2xl space-y-5 shadow-sm ${cardClass}`}>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            {text.appearance}
          </h2>

          <div className="space-y-2">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${mutedClass}`}>{text.theme}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onSetTheme('dark')} className={selectButtonClass(theme === 'dark')}>
                <Moon className="w-3.5 h-3.5 inline mr-1" />
                {text.dark}
              </button>
              <button type="button" onClick={() => onSetTheme('light')} className={selectButtonClass(theme === 'light')}>
                <Sun className="w-3.5 h-3.5 inline mr-1" />
                {text.light}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${mutedClass}`}>{text.mode}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onSetVisualMode('cabinet')} className={selectButtonClass(visualMode === 'cabinet')}>
                {text.cabinet}
              </button>
              <button type="button" onClick={() => onSetVisualMode('un')} className={selectButtonClass(visualMode === 'un')}>
                {text.modern}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${mutedClass}`}>{text.language}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onSetLanguage('zh')} className={selectButtonClass(language === 'zh')}>
                中文
              </button>
              <button type="button" onClick={() => onSetLanguage('en')} className={selectButtonClass(language === 'en')}>
                English
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-[11px] font-bold uppercase tracking-wider ${mutedClass}`}>{text.font}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                <button key={size} type="button" onClick={() => onSetFontSize(size)} className={selectButtonClass(fontSize === size)}>
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${isLight ? 'bg-stone-50 border-stone-200 text-stone-600' : 'bg-stone-950 border-stone-800 text-stone-400'}`}>
            <Shield className="w-4 h-4 text-amber-500 inline mr-1.5" />
            {text.safetyText}
          </div>
        </section>

        <section className={`lg:col-span-2 p-5 border rounded-2xl space-y-5 shadow-sm ${cardClass}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              {text.backend}
            </h2>
            <span className={`text-[10px] border rounded-full px-2 py-1 ${statusClass(backendStatus)}`}>
              {statusLabel(backendStatus)}
            </span>
          </div>

          {backendMessage && <p className={`text-[11px] ${backendStatus === 'failed' ? 'text-rose-500' : 'text-emerald-500'}`}>{backendMessage}</p>}

          {/* Advanced settings toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${mutedClass} hover:text-amber-500 transition cursor-pointer`}
          >
            {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Wrench className="w-3 h-3" />
            {isEn ? 'Advanced Settings' : '高级设置'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 animate-fadeIn">
              <input
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                placeholder="http://127.0.0.1:8000"
                className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                aria-label={text.backendUrl}
              />
              <button
                type="button"
                onClick={checkBackend}
                className="px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-stone-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${backendStatus === 'testing' ? 'animate-spin' : ''}`} />
                {text.checkBackend}
              </button>
            </div>
          )}

          <div className={`pt-4 border-t ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-amber-500" />
              {text.models}
            </h2>

            <div className="space-y-3">
              {apiConfigs.map((item) => (
                <div key={item.id} className={`p-4 border rounded-xl space-y-3 ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/60 border-stone-800'}`}>
                  <div className="flex items-center justify-between gap-2">
                    {isDefaultProvider(item.id) ? (
                      <div className="font-bold text-sm">{item.name}</div>
                    ) : (
                      <input
                        value={item.name}
                        onChange={(event) => updateConfig(item.id, 'name', event.target.value)}
                        placeholder={isEn ? 'Provider name' : '配置名称'}
                        className={`font-bold text-sm rounded-lg border px-2 py-0.5 outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                      />
                    )}
                    <span className={`text-[10px] border rounded-full px-2 py-1 ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className={`block text-[10px] font-bold ${mutedClass}`}>{text.endpoint}</span>
                      <input
                        value={item.endpoint}
                        onChange={(event) => updateConfig(item.id, 'endpoint', event.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className={`block text-[10px] font-bold ${mutedClass}`}>{text.model}</span>
                      <input
                        value={item.model}
                        onChange={(event) => updateConfig(item.id, 'model', event.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                      />
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className={`flex items-center justify-between text-[10px] font-bold ${mutedClass}`}>
                        {text.key}
                        <button
                          type="button"
                          onClick={() => setVisibleKeyId((prev) => (prev === item.id ? null : item.id))}
                          className="inline-flex items-center gap-1 hover:text-amber-500"
                        >
                          {visibleKeyId === item.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {visibleKeyId === item.id ? text.hide : text.show}
                        </button>
                      </span>
                      <input
                        type={visibleKeyId === item.id ? 'text' : 'password'}
                        value={item.apiKey}
                        onChange={(event) => updateConfig(item.id, 'apiKey', event.target.value)}
                        placeholder="sk-..."
                        className={`w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                      />
                    </label>
                  </div>

                  {item.message && <p className={`text-[11px] ${item.status === 'failed' ? 'text-rose-500' : 'text-emerald-500'}`}>{item.message}</p>}

                  <div className="flex justify-end gap-2">
                    {isDefaultProvider(item.id) ? (
                      <button
                        type="button"
                        onClick={() => clearProvider(item.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                          isLight ? 'bg-white border-stone-200 text-stone-600 hover:text-rose-600' : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-rose-400'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {text.clear}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteCustomProvider(item.id)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1 hover:text-rose-500 border-rose-500/20 bg-rose-500/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isEn ? 'Delete' : '删除'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => testProvider(item.id)}
                      className="px-4 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-stone-950 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      {item.status === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {text.test}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCustomProvider}
                className="w-full py-2.5 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="text-lg leading-none">+</span>
                {isEn ? 'Add Provider' : '添加模型配置'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* System Self-Check */}
      <SystemSelfCheck backendUrl={backendUrl} language={language} isLight={isLight} />

      {/* AI Websites Section */}
      <section className={`p-5 border rounded-2xl space-y-4 shadow-sm ${cardClass}`}>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-500" />
          {text.aiWebsites}
        </h2>
        <p className={`text-xs ${mutedClass}`}>{text.aiWebsitesDesc}</p>

        {aiWebsites.length === 0 ? (
          <p className={`text-xs ${mutedClass}`}>{isEn ? 'No websites loaded — check backend connection.' : '暂无网站数据，请确认后端连接。'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiWebsites.map((site) => (
              <div key={site.id} className={`p-3 border rounded-xl space-y-2.5 ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950/60 border-stone-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs truncate">{site.name}</span>
                  <div className="flex gap-1 shrink-0">
                    {site.freeTier ? (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-mono">{text.freeTier}</span>
                    ) : null}
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded-full font-mono ${site.loginRequired ? 'bg-amber-500/10 text-amber-500 border-amber-500/25' : 'bg-stone-500/10 text-stone-500 border-stone-500/25'}`}>
                      {site.loginRequired ? text.loginRequired : text.noLogin}
                    </span>
                  </div>
                </div>

                <div className={`rounded-lg border px-2 py-1.5 space-y-1 ${isLight ? 'bg-white border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] uppercase font-bold ${mutedClass}`}>Web AI</span>
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded-full font-mono ${webAIStatusClass(site.webAI?.status)}`}>
                      {webAIStatusLabel(site.webAI?.status)}
                    </span>
                  </div>
                  <p className={`text-[10px] leading-snug ${mutedClass}`}>
                    {site.webAI?.message || (isEn ? 'Automatic web prompt send/read is not ready yet.' : '自动发送和读取尚未接入。')}
                  </p>
                  {site.webAI?.canSendPrompt ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <select
                        value={websiteRoleForm[site.id] || 'summary'}
                        onChange={(e) => setWebsiteRoleForm((prev) => ({ ...prev, [site.id]: e.target.value as WebsiteRoleId }))}
                        className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${inputClass}`}
                      >
                        <option value="chief">chief</option>
                        <option value="code">code</option>
                        <option value="review">review</option>
                        <option value="summary">summary</option>
                        <option value="translation">translation</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => { void assignWebsiteRole(site.id); }}
                        className="px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        {isEn ? 'Assign' : '绑定'}
                      </button>
                    </div>
                  ) : null}
                  {websiteAssignResult[site.id] ? (
                    <p className="text-[10px] text-emerald-500 font-mono">{websiteAssignResult[site.id]}</p>
                  ) : null}
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { void openAIWebsite(site); }}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500 hover:text-stone-950 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {text.openWebsite}
                  </button>
                  {site.apiWebsite ? (
                    <button
                      type="button"
                      onClick={() => window.open(site.apiWebsite, '_blank', 'noopener,noreferrer')}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500 hover:text-stone-950 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Server className="w-3 h-3" />
                      {text.openApi}
                    </button>
                  ) : null}
                </div>

                {site.loginRequired ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setWebsiteLoginOpen((prev) => ({ ...prev, [site.id]: !prev[site.id] }))}
                      className={`w-full px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        websiteLoginOpen[site.id]
                          ? isLight ? 'bg-stone-100 border-stone-300 text-stone-700' : 'bg-stone-800 border-stone-700 text-stone-300'
                          : isLight ? 'bg-white border-stone-200 text-stone-500' : 'bg-stone-900 border-stone-800 text-stone-400'
                      }`}
                    >
                      <LogIn className="w-3 h-3" />
                      {text.loginConfig}
                    </button>

                    {websiteLoginOpen[site.id] ? (
                      <div className={`mt-2 p-3 rounded-lg border space-y-2 ${isLight ? 'bg-white border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                        <label className="space-y-1">
                          <span className={`block text-[9px] font-bold ${mutedClass}`}>{text.username}</span>
                          <input
                            value={websiteLoginForm[site.id]?.username || ''}
                            onChange={(e) => setWebsiteLoginForm((prev) => ({ ...prev, [site.id]: { ...prev[site.id], username: e.target.value } }))}
                            placeholder="user@example.com"
                            className={`w-full rounded-lg border px-2 py-1.5 text-[11px] font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className={`block text-[9px] font-bold ${mutedClass}`}>{text.passwordEnv}</span>
                          <input
                            value={websiteLoginForm[site.id]?.passwordEnvName || ''}
                            onChange={(e) => setWebsiteLoginForm((prev) => ({ ...prev, [site.id]: { ...prev[site.id], passwordEnvName: e.target.value } }))}
                            placeholder="MY_SITE_PASSWORD"
                            className={`w-full rounded-lg border px-2 py-1.5 text-[11px] font-mono outline-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => { void saveWebsiteLogin(site.id); }}
                          className="w-full px-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          {text.saveLogin}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void openWebsiteLoginFallback(site); }}
                          className={`w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                            isLight ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100' : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {text.openLogin}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void detectWebsiteLogin(site.id); }}
                          className={`w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                            isLight ? 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100' : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                          }`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          {isEn ? 'Check login' : '检测登录'}
                        </button>
                        {site.webAI?.canSendPrompt ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={websitePromptForm[site.id] || ''}
                              onChange={(e) => setWebsitePromptForm((prev) => ({ ...prev, [site.id]: e.target.value }))}
                              rows={3}
                              placeholder={isEn ? 'Test prompt' : '测试问题'}
                              className={`w-full rounded-lg border px-2 py-1.5 text-[11px] outline-none resize-none focus:ring-1 focus:ring-amber-500 ${inputClass}`}
                            />
                            <button
                              type="button"
                              disabled={websiteCalling[site.id] || !(websitePromptForm[site.id] || '').trim()}
                              onClick={() => { void callAIWebsite(site.id); }}
                              className={`w-full px-2 py-1.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                                websiteCalling[site.id] || !(websitePromptForm[site.id] || '').trim()
                                  ? isLight ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed' : 'bg-stone-900 border-stone-800 text-stone-600 cursor-not-allowed'
                                  : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 cursor-pointer'
                              }`}
                            >
                              {websiteCalling[site.id] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              {websiteCalling[site.id] ? (isEn ? 'Calling' : '调用中') : (isEn ? 'Test call' : '测试调用')}
                            </button>
                            {websiteCallResult[site.id] ? (
                              <pre className={`max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border p-2 text-[10px] leading-relaxed ${
                                isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-950 border-stone-800 text-stone-300'
                              }`}>
                                {websiteCallResult[site.id]}
                              </pre>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
