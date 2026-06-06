/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

type RuntimeApiConfig = {
  id: string;
  name?: string;
  endpoint: string;
  apiKey?: string;
  model?: string;
};

type RuntimeMember = {
  id: string;
  name: string;
  nickname?: string;
  role?: string;
  ministry?: string;
  providerId?: string;
  apiProfileId?: string;
  modelId?: string;
  skillPrompt?: string;
};

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log('Gemini API client initialized successfully.');
  } catch (err) {
    console.error('Error initializing Gemini Client:', err);
  }
} else {
  console.log('Using simulated fallback engine as GEMINI_API_KEY is not set.');
}

// Simulated fallback generator for beautiful interactions in offline or non-key modes
function getFallbackResponse(mode: 'cabinet' | 'un', query: string, members: any[]): any[] {
  // Simple NLP checking for custom replies
  const q = query.toLowerCase();
  
  if (mode === 'cabinet') {
    // Cabinet Mode (Ancient court style)
    const activePM = members.find(m => m.role === 'pm') || { name: 'Claude 3.5 Sonnet' };
    const activeWar = members.find(m => m.ministry === 'war') || { name: 'Zuo Zongtang' };
    const activeWorks = members.find(m => m.ministry === 'works') || { name: 'Liang Qichao' };
    const activeRev = members.find(m => m.ministry === 'revenue') || { name: 'System Hub' };
    
    if (q.includes('盐') || q.includes('铁') || q.includes('防') || q.includes('防线')) {
      return [
        {
          id: Math.random().toString(36),
          sender: `首辅大臣 (${activePM.name})`,
          ministerId: activePM.id || 'pm-model',
          content: '陛下恩泽四海。臣以为，盐铁本为国政之基，私售固然可恶，但更在于官差因循守旧、层层盘剥。宜推行“宽刑辟门”，引入民间商贾护送转运，官府抽税而护航治塞。另外，严惩官绅保护伞，流放贪腐，方可清源。',
          roleLabel: '内阁'
        },
        {
          id: Math.random().toString(36),
          sender: `兵部尚书 (${activeWar.name})`,
          ministerId: activeWar.id || 'war-tool',
          content: '臣附议。北境兵连祸结，若官饷不振，边关将士军不安心。物流物流，兵贵神速，工部提出之物流护航案，兵部需征募额外三个营的巡防营兵力以断马贼之扰，恳请户部拨银圣裁。',
          roleLabel: '六部'
        }
      ];
    } else {
      return [
        {
          id: Math.random().toString(36),
          sender: `首辅大臣 (${activePM.name})`,
          ministerId: activePM.id || 'pm-model',
          content: `陛下圣旨，事关重大。关于“${query}”，臣等万死不辞。臣建议当即召集户部、兵部通盘清算，内阁在下月内草拟全局整顿策略呈表。`,
          roleLabel: '内阁'
        },
        {
          id: Math.random().toString(36),
          sender: `刑部尚书 (${activeWorks.name})`,
          ministerId: activeWorks.id || 'tools',
          content: '臣以为法度乃立国之本，一切当行重刑律条，以此慑服不轨之辈，还北关一片昌明。',
          roleLabel: '六部'
        }
      ];
    }
  } else {
    // UN Mode (Technocratic clinical style)
    const activeSG = members.find(m => m.role === 'sg') || { name: 'Secretary General' };
    const activeRes = members.find(m => m.ministry === 'archive' || m.id === 'tool-custom') || { name: 'Dr. Elena Rostova' };
    const activeTool = members.find(m => m.id === 'tool-codex') || { name: 'Marcus Vance' };
    
    if (q.includes('ethic') || q.includes('ai') || q.includes('伦理') || q.includes('可解释')) {
      return [
        {
          id: Math.random().toString(36),
          sender: `秘书长 (${activeSG.name})`,
          ministerId: 'tool-custom',
          content: 'Our core parameter here is systemic alignment coupled with international protocol standardization. We appreciate the engineering feedback, but human rights framework overrides raw latency optimization. The council should set unified auditing standards.',
          roleLabel: 'MODERATOR'
        },
        {
          id: Math.random().toString(36),
          sender: `技术代表 (${activeTool.name})`,
          ministerId: 'tool-codex',
          content: 'Standardizing explainability is pragmatically impossible under the current deep learning stack. Forcing a hard regulatory limit will purely stall open-source innovation, potentially giving monopoly to black-box proprietary giants.',
          roleLabel: 'ENGINEERING'
        }
      ];
    } else {
      return [
        {
          id: Math.random().toString(36),
          sender: `秘书长 (${activeSG.name})`,
          ministerId: 'tool-custom',
          content: `Regarding your query "${query}", we must maintain strict transparency and cross-agency coordination. I request the Research and Execution cells to submit a joint impact report within 48 hours.`,
          roleLabel: 'MODERATOR'
        },
        {
          id: Math.random().toString(36),
          sender: `研究代表 (${activeRes.name})`,
          ministerId: 'tool-custom-res',
          content: 'Our predictive modeling indicates we must proceed with precaution to avoid localized disruptions in our delivery cycles.',
          roleLabel: 'RESEARCH'
        }
      ];
    }
  }
}

function chatCompletionsUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function responsesUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/responses')) return trimmed;
  return `${trimmed}/responses`;
}

function resolveRuntimeConfig(member: RuntimeMember, apiConfigs: RuntimeApiConfig[]): RuntimeApiConfig | undefined {
  const providerId = (member.providerId || '').toLowerCase();
  const profileId = (member.apiProfileId || '').toLowerCase();
  const exact = apiConfigs.find((item) => {
    const id = (item.id || '').toLowerCase();
    return id === providerId || (!!profileId && profileId.includes(id));
  });
  if (exact) return exact;

  const memberNeedsModelRelay = providerId && !['codex', 'claudecode', 'trae', 'local', 'browser'].includes(providerId);
  if (memberNeedsModelRelay) {
    return apiConfigs.find((item) => (item.id || '').toLowerCase() === 'ccswitch');
  }
  return undefined;
}

async function callOpenAICompatible(
  member: RuntimeMember,
  config: RuntimeApiConfig,
  mode: 'cabinet' | 'un',
  query: string,
  history: any[],
  projectBrief?: string,
  projectHandoff?: string,
): Promise<any | null> {
  const isCcSwitch = (config.id || '').toLowerCase() === 'ccswitch';
  const url = isCcSwitch ? responsesUrl(config.endpoint || '') : chatCompletionsUrl(config.endpoint || '');
  if (!url) return null;

  const model = member.modelId || config.model || (isCcSwitch ? 'gpt-5' : 'gpt-4o-mini');
  const roleLabel = mode === 'cabinet'
    ? (member.role === 'pm' ? '内阁' : '六部')
    : (member.role === 'sg' ? 'MODERATOR' : 'DELEGATE');
  const sender = mode === 'cabinet'
    ? `${member.name}${member.nickname ? ` (${member.nickname})` : ''}`
    : `${member.name}${member.nickname ? ` (${member.nickname})` : ''}`;
  const historyText = (history || [])
    .map((item: any) => `${item.sender || 'unknown'}: ${item.content || ''}`)
    .join('\n')
    .slice(-5000);
  const contextText = [projectBrief, projectHandoff].filter(Boolean).join('\n\n').slice(0, 4000);
  const systemPrompt = mode === 'cabinet'
    ? `你是内阁会审中的一位成员。请用中文，结合你的职位和技能，直接回应圣上问题。保持简洁、可执行、有角色感。成员：${member.name}；部门：${member.ministry || 'none'}；职责：${member.skillPrompt || 'general reasoning'}。`
    : `You are a council delegate. Reply in Chinese unless the user asks otherwise. Be concise, technical, and actionable. Member: ${member.name}; department: ${member.ministry || 'none'}; skill: ${member.skillPrompt || 'general reasoning'}.`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isCcSwitch ? { 'User-Agent': 'codex-cli' } : {}),
  };
  if ((config.apiKey || '').trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  } else if (isCcSwitch) {
    headers.Authorization = 'Bearer cc-switch-local-routing';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const requestBody = isCcSwitch
      ? {
          model,
          input: [
            { role: 'developer', content: [{ type: 'input_text', text: systemPrompt }] },
            ...(contextText ? [{ role: 'developer', content: [{ type: 'input_text', text: `Project context:\n${contextText}` }] }] : []),
            ...(historyText ? [{ role: 'developer', content: [{ type: 'input_text', text: `Recent history:\n${historyText}` }] }] : []),
            { role: 'user', content: [{ type: 'input_text', text: query }] },
          ],
          temperature: 0.4,
          max_output_tokens: 900,
        }
      : {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(contextText ? [{ role: 'system', content: `Project context:\n${contextText}` }] : []),
            ...(historyText ? [{ role: 'system', content: `Recent history:\n${historyText}` }] : []),
            { role: 'user', content: query },
          ],
          temperature: 0.4,
          max_tokens: 900,
        };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      console.warn(`Provider ${config.id} failed with HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    const content = String(
      data?.output_text ||
      data?.choices?.[0]?.message?.content ||
      data?.output?.flatMap((item: any) => item?.content || [])
        ?.map((item: any) => item?.text || item?.content || '')
        ?.join('') ||
      ''
    ).trim();
    if (!content) return null;
    return {
      id: Math.random().toString(36).substring(2),
      sender,
      ministerId: member.id,
      content,
      roleLabel,
    };
  } catch (error: any) {
    console.warn(`Provider ${config.id} call failed:`, error?.message || error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getRuntimeProviderResponses(
  mode: 'cabinet' | 'un',
  query: string,
  history: any[],
  selectedMembers: RuntimeMember[],
  apiConfigs: RuntimeApiConfig[],
  projectBrief?: string,
  projectHandoff?: string,
): Promise<any[]> {
  if (!Array.isArray(apiConfigs) || apiConfigs.length === 0) return [];
  const callableMembers = (selectedMembers || [])
    .filter((member) => resolveRuntimeConfig(member, apiConfigs))
    .slice(0, 2);
  const results: any[] = [];
  for (const member of callableMembers) {
    const config = resolveRuntimeConfig(member, apiConfigs);
    if (!config) continue;
    const result = await callOpenAICompatible(member, config, mode, query, history, projectBrief, projectHandoff);
    if (result) results.push(result);
  }
  return results;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 3000): Promise<{ ok: boolean; data?: any; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Keep non-JSON response for diagnostics.
    }
    return response.ok ? { ok: true, data } : { ok: false, data, error: `HTTP ${response.status}` };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/runtime-check', async (_req, res) => {
  const ccSwitchBase = process.env.CCSWITCH_BASE_URL || 'http://127.0.0.1:15721';
  const backendBase = process.env.CABINET_BACKEND_URL || 'http://127.0.0.1:8000';
  const [ccHealth, ccStatus, backendHealth] = await Promise.all([
    fetchJsonWithTimeout(`${ccSwitchBase}/health`),
    fetchJsonWithTimeout(`${ccSwitchBase}/status`),
    fetchJsonWithTimeout(`${backendBase}/health`),
  ]);
  const status = ccStatus.data || {};
  const serviceOk = ccHealth.ok && ccStatus.ok;
  const routeReady = Boolean(serviceOk && status.current_provider_id && !status.last_error);
  return res.json({
    generatedAt: new Date().toISOString(),
    app: { ok: true, url: `http://127.0.0.1:${PORT}` },
    ccSwitch: {
      ok: routeReady,
      health: ccHealth.ok,
      serviceOk,
      routeReady,
      provider: status.current_provider || '',
      providerId: status.current_provider_id || '',
      activeTargets: Array.isArray(status.active_targets) ? status.active_targets : [],
      lastError: status.last_error || ccHealth.error || ccStatus.error || '',
      url: ccSwitchBase,
    },
    backend: {
      ok: backendHealth.ok,
      url: backendBase,
      error: backendHealth.error || '',
    },
    features: {
      issueReporting: { ok: backendHealth.ok, endpoint: '/api/issues' },
      imageGeneration: { ok: backendHealth.ok, endpoint: '/api/images/generate' },
    },
  });
});

async function proxyBackendPost(pathname: string, body: unknown, res: express.Response) {
  const backendBase = (process.env.CABINET_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  try {
    const response = await fetch(`${backendBase}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error: any) {
    res.status(503).json({ ok: false, error: error?.message || 'Backend unavailable' });
  }
}

app.post('/api/issues', async (req, res) => {
  await proxyBackendPost('/api/issues', req.body, res);
});

app.post('/api/images/generate', async (req, res) => {
  await proxyBackendPost('/api/images/generate', req.body, res);
});

app.post('/api/ccswitch/test', async (req, res) => {
  await proxyBackendPost('/api/ccswitch/test', req.body, res);
});

app.post('/api/ccswitch/launch', async (req, res) => {
  await proxyBackendPost('/api/ccswitch/launch', req.body, res);
});

app.post('/api/provider/test', async (req, res) => {
  await proxyBackendPost('/api/provider/test', req.body, res);
});

// API endpoint for debate simulation
app.post('/api/debate', async (req, res) => {
  const { mode, query, history, selectedMembers, apiConfigs, projectBrief, projectHandoff } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const runtimeMessages = await getRuntimeProviderResponses(
    mode,
    query,
    history || [],
    selectedMembers || [],
    apiConfigs || [],
    projectBrief,
    projectHandoff,
  );
  if (runtimeMessages.length > 0) {
    return res.json({ messages: runtimeMessages, provider: 'runtime-openai-compatible' });
  }

  // If Gemini client is not initialized, use the fallback generator
  if (!ai) {
    console.log('API Key not found, returning fallback responses');
    const simulatedAnswers = getFallbackResponse(mode, query, selectedMembers || []);
    return res.json({ messages: simulatedAnswers });
  }

  try {
    const listDescription = (selectedMembers || [])
      .map((m: any) => `- Name: ${m.name}, Type: ${m.type}, Role: ${m.role}, Department: ${m.ministry}`)
      .join('\n');

    let historySnippet = '';
    if (history && history.length > 0) {
      historySnippet = history
        .map((h: any) => `${h.sender}: ${h.content}`)
        .join('\n');
    }

    let projectContextSnippet = '';
    if (projectBrief) {
      projectContextSnippet = `
用户已经上传/装填了本地文件夹特征和工程大纲上下文 (Shared Project Brief):
${projectBrief}

Codex / DeepSeek 调试交接指令 (Handoff Directives):
${projectHandoff || ''}
`;
    }

    const systemPromptMessage = mode === 'cabinet' 
      ? `You are an AI Cabinet simulation engine for an ancient Chinese Neo-Traditional court context. 
The user is '朕 (圣上)' (The Emperor of the empire).
The active Cabinet and Ministry Members representing the simulated agents are:
${listDescription}

Previous Consultation History:
${historySnippet}

${projectContextSnippet}

User (圣上) just sent this decree or query: "${query}"

Generate 1 to 2 distinct dialogue responses from the active cabinet members in character. 
Use opulent, respectful, and grand classical court tone. Translate model characteristics to courtly gravitas (e.g. Claude 3.5 Sonnet might speak with sharp logic as the grand counselor '首辅大臣', ChatGPT as general ministers). Use semi-classical Chinese terms (or appropriate translation). Keep responses highly engaging, immersive and concise.

You MUST respond strictly in the following JSON array schema:
[
  {
    "sender": "string (e.g., '首辅大臣 (Claude 3.5 Sonnet)' or '兵部尚书 (Zuo Zongtang)')",
    "ministerId": "string (matching the exact member ID from the simulation, e.g. 'model-claude', 'tool-codex')",
    "content": "string (the in-character dialogue or response text)",
    "roleLabel": "string (e.g., '内阁', '六部' or '专门')"
  }
]`
      : `You are an AI Council simulation engine representing a technocratic United Nations committee.
The active Delegates, Moderators, and Representatives are:
${listDescription}

Previous Discussion History:
${historySnippet}

${projectContextSnippet}

User (Delegate/Participant) entered this input or directive: "${query}"

Generate 1 to 2 distinct clinical, technical dialogue responses from the active delegates in character. 
The Moderator is '秘书长 (Secretary General)'. Other agents represent technical, research, or execution representatives. Use professional, diplomatic, and highly analytical terminology. Keep answers succinct and direct.

You MUST respond strictly in the following JSON array schema:
[
  {
    "sender": "string (e.g., '秘书长 (Secretary General)' or '技术代表 (Codex)')",
    "ministerId": "string (matching the exact member ID from the list, e.g. 'tool-custom', 'tool-codex')",
    "content": "string (the in-character technical dialogue or reply)",
    "roleLabel": "string (e.g., 'MODERATOR', 'ENGINEERING', 'RESEARCH', 'EXECUTION')"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { text: systemPromptMessage }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sender: { type: Type.STRING },
              ministerId: { type: Type.STRING },
              content: { type: Type.STRING },
              roleLabel: { type: Type.STRING }
            },
            required: ['sender', 'ministerId', 'content', 'roleLabel']
          }
        },
        temperature: 0.8
      }
    });

    const textOutput = response.text || '[]';
    console.log('Gemini generated responses:', textOutput);
    const parsedMessages = JSON.parse(textOutput.trim());
    
    // Inject individual IDs
    const messages = parsedMessages.map((msg: any) => ({
      ...msg,
      id: Math.random().toString(36).substring(7)
    }));

    return res.json({ messages });
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    // Gracefully send correct fallback
    const simulatedAnswers = getFallbackResponse(mode, query, selectedMembers || []);
    return res.json({ messages: simulatedAnswers, error: error.message });
  }
});

// API endpoint for finalizing verdicts (圣裁定案 / Final Verdict)
app.post('/api/finalize', async (req, res) => {
  const { messages, contextTitle } = req.body;
  
  if (!ai) {
    // Simulated quick verdict plans
    return res.json({
      plans: [
        {
          id: 'alpha',
          title: 'Alpha Strategist (首脑折中案)',
          badge: 'LEAD ADVISOR',
          description: '允许商贾包办物流护航，官府集中征收盐税，在南方水利工程实施分阶段开发，首重民生。兼顾六部审计，调派两个营的巡防营精兵入驻。',
          icon: 'psychology'
        },
        {
          id: 'beta',
          title: 'Beta Policy (严刑峻法案)',
          badge: 'DOMESTIC',
          description: '实施彻底的专营禁卫制，严禁商贾染指。兵部与刑部连带清算贪腐，首恶枭首，从犯黥面流放，以峻法整顿帝制。',
          icon: 'policy'
        },
        {
          id: 'gamma',
          title: 'Gamma Global (开边通途案)',
          badge: 'FOREIGN AFFAIRS',
          description: '扩大边防预算，对海外盟属与藩国开放部分转运通商权，强化王化宣讲，在不损害皇商利益前提下推进物流通衢。',
          icon: 'public'
        }
      ]
    });
  }

  try {
    const chatTranscript = (messages || [])
      .map((m: any) => `${m.sender}: ${m.content}`)
      .join('\n');

    const verdictPrompt = `You are a Grand Scholar draft specialist. Based on the following discussion outline about "${contextTitle || 'The State of Affairs'}", propose 3 distinct verdict draft plans:
Draft Transcript:
${chatTranscript}

Draft plan 1: Alpha (Middle-way balanced compromise drafting)
Draft plan 2: Beta (Aggressive high-cost protective intervention)
Draft plan 3: Gamma (Reformative external cooperative strategy)

Return exactly the following JSON array of 3 plans:
[
  {
    "id": "alpha",
    "title": "string (elegantly phrased title)",
    "badge": "LEAD ADVISOR",
    "description": "string (comprehensive description summarizing the compromise and action points from cabinet members)",
    "icon": "psychology"
  },
  {
    "id": "beta",
    "title": "string (tough interventionist title)",
    "badge": "DOMESTIC",
    "description": "string (focused action points prioritizing internal security, strict audit and defense)",
    "icon": "policy"
  },
  {
    "id": "gamma",
    "title": "string (transformative long-term strategy)",
    "badge": "FOREIGN AFFAIRS",
    "description": "string (long term logistics reform, external influence or open-source technical enablement)",
    "icon": "public"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ text: verdictPrompt }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              badge: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ['id', 'title', 'badge', 'description', 'icon']
          }
        },
        temperature: 0.7
      }
    });

    const parsedPlans = JSON.parse(response.text?.trim() || '[]');
    return res.json({ plans: parsedPlans });
  } catch (err: any) {
    console.error('Verdict formulation error:', err);
    return res.json({
      plans: [
        {
          id: 'alpha',
          title: 'Alpha Compromise (首脑折中)',
          badge: 'LEAD ADVISOR',
          description: '折中两端，官民共营，调拨边防物流专车并打击基层贪墨政体。',
          icon: 'psychology'
        }
      ]
    });
  }
});

// Setup Vite Dev server or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server fully booted on http://localhost:${PORT}`);
  });
}

startServer();
