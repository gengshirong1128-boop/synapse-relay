/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ViewType, VisualModeType, CabinetMember, ChatMessage, VerdictOption, HistorySession } from './types';
import { INITIAL_MEMBERS, TOPICS, INITIAL_MESSAGES_CABINET, INITIAL_MESSAGES_UN, getInitialMessages, normalizeMessageForLanguage } from './data';
import { CabinetSelection } from './components/CabinetSelection';
import { NewSession } from './components/NewSession';
import { CabinetMeeting } from './components/CabinetMeeting';
import { CabinetColumns } from './components/CabinetColumns';
import { VerdictModal } from './components/VerdictModal';
import { Settings } from './components/Settings';
import { LocalTools } from './components/LocalTools';
import { FolderReader } from './components/FolderReader';
import { IssueReport } from './components/IssueReport';
import { ImageStudio } from './components/ImageStudio';
import { t } from './i18n';
import { fontScaleRootStyle } from './uiScale';
import { getProviderAvatar } from './providerAvatars';
import { getSkillById, MINISTRY_SKILLS } from './skills';
import { 
  Users, PlusSquare, History, Settings as SettingsIcon, PanelLeft, 
  PanelLeftClose, Search, Pin, Trash2, Edit2, Download, Copy, RefreshCw, 
  Check, MoreVertical, Globe, Layers, Sparkles, MessageSquare, Plus, CheckCircle, Crown, Info, X,
  Radio, FolderOpen, Bug, Image as ImageIcon
} from 'lucide-react';

interface ExtendedSession extends HistorySession {
  sessionMode: 'private' | 'meeting';
  pinned?: boolean;
}

const DEFAULT_MEMBER_IDS = new Set(INITIAL_MEMBERS.map((member) => member.id));

const uniqueMembers = (items: CabinetMember[]): CabinetMember[] => {
  const unique = new Map<string, CabinetMember>();
  items.forEach((member) => {
    if (member?.id) unique.set(member.id, member);
  });
  return Array.from(unique.values());
};

export default function App() {
  const [view, setView] = useState<ViewType>('new-session'); // Default to landing suggestions
  const [visualMode, setVisualMode] = useState<VisualModeType>('cabinet');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [members, setMembers] = useState<CabinetMember[]>(INITIAL_MEMBERS);
  const [projectBrief, setProjectBrief] = useState<string>('');
  const [projectHandoff, setProjectHandoff] = useState<string>('');
  
  const [sessionTitle, setSessionTitle] = useState('关于北境盐铁专营之榷议');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Historical session lists
  const [sessions, setSessions] = useState<ExtendedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [activeSessionMenuId, setActiveSessionMenuId] = useState<string | null>(null);

  // Top action bar menus
  const [showTopActionMenu, setShowTopActionMenu] = useState(false);
  const [topActionTab, setTopActionTab] = useState<'none' | 'add' | 'remove' | 'host' | 'positions'>('none');

  const [isGenerating, setIsGenerating] = useState(false);
  const [showVerdictModal, setShowVerdictModal] = useState(false);

  const [lastViewBeforeNav, setLastViewBeforeNav] = useState<ViewType>('new-session');
  const [isComposingNewSession, setIsComposingNewSession] = useState(false);
  const [newSessionDraftKey, setNewSessionDraftKey] = useState(0);

  // ---- Backend member persistence ----
  const [backendBaseUrl, setBackendBaseUrl] = useState(() => {
    return localStorage.getItem('cabinet_backend_url') || 'http://127.0.0.1:8000';
  });

  const saveMembersToBackend = (currentMembers: CabinetMember[]) => {
    const base = backendBaseUrl.trim().replace(/\/$/, '');
    if (!base) return;
    const customMembers = currentMembers
      .filter(m => !m.isDefault && !DEFAULT_MEMBER_IDS.has(m.id))
      .map(m => ({
        id: m.id, name: m.name, nickname: m.nickname || '', avatar: m.avatar || '',
        type: m.type, role: m.role, ministry: m.ministry, skillId: m.skillId || '',
        providerId: m.providerId || '', apiProfileId: m.apiProfileId || '',
        localToolId: m.localToolId || '', modelId: m.modelId || '', enabled: m.enabled !== false,
      }));
    const memberOverrides: Record<string, Record<string, string>> = {};
    currentMembers.filter(m => m.isDefault).forEach(m => {
      memberOverrides[m.id] = {
        name: m.name, nickname: m.nickname || '', avatar: m.avatar || '',
        role: m.role, ministry: m.ministry, skillId: m.skillId || '',
        providerId: m.providerId || '', apiProfileId: m.apiProfileId || '', localToolId: m.localToolId || '',
      };
    });
    fetch(`${base}/ai-members/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customMembers, memberOverrides }),
    }).catch((e) => { console.warn('[内阁] 保存大臣配置到后端失败:', e); });
  };

  const loadMembersFromBackend = () => {
    const base = backendBaseUrl.trim().replace(/\/$/, '');
    if (!base) return;
    fetch(`${base}/ai-members`)
      .then(r => r.json())
      .then((data: any) => {
        const settings = data?.settings || {};
        const overrides = settings.memberOverrides || {};
        const customs: CabinetMember[] = (settings.customMembers || []).filter((m: any) => !DEFAULT_MEMBER_IDS.has(m.id)).map((m: any) => ({
          id: m.id || `custom_${Date.now()}`,
          name: m.name || '自定义大臣',
          nickname: m.nickname || '',
          avatar: m.avatar || '',
          avatarType: 'provider' as const,
          type: (m.type as 'model' | 'tool' | 'custom') || 'custom',
          selected: true,
          role: (m.role as 'pm' | 'sg' | 'none') || 'none',
          ministry: (m.ministry as any) || 'none',
          badge: '自定义',
          skillId: m.skillId || '',
          providerId: m.providerId || '',
          modelId: m.modelId || '',
          apiProfileId: m.apiProfileId || '',
          localToolId: m.localToolId || '',
          enabled: m.enabled !== false,
          isDefault: false,
          desc: '',
        }));
        // Apply overrides to INITIAL_MEMBERS
        const merged = INITIAL_MEMBERS.map(dm => {
          const ov = overrides[dm.id];
          if (ov) {
            return { ...dm, ...ov, isDefault: true };
          }
          return dm;
        });
        // Append custom members
        const allMembers = uniqueMembers([...merged, ...customs]);
        setMembers(allMembers);
        syncActiveSessionData(allMembers, messages);
      })
      .catch(() => { /* backend unreachable, keep local */ });
  };
  // ---- End backend persistence ----

  // Persist font size choice
  useEffect(() => {
    localStorage.setItem('cabinet_font_size_v3', fontSize);
  }, [fontSize]);

  // Persist theme choice
  useEffect(() => {
    localStorage.setItem('cabinet_theme_v3', theme);
  }, [theme]);

  // Persist language choice
  useEffect(() => {
    localStorage.setItem('cabinet_language_v3', language);
  }, [language]);

  // Load configuration and sessions on start
  useEffect(() => {
    // Sync theme styling classes to document element
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  // Load from localStorage on mounts
  useEffect(() => {
    const savedSessions = localStorage.getItem('cabinet_sessions_v3');
    const savedActiveId = localStorage.getItem('cabinet_active_session_id_v3');
    const savedVisualMode = localStorage.getItem('cabinet_visual_mode_v3');
    const savedTheme = localStorage.getItem('cabinet_theme_v3');
    const savedLang = localStorage.getItem('cabinet_language_v3');
    const savedFontSize = localStorage.getItem('cabinet_font_size_v3');

    if (savedVisualMode) setVisualMode(savedVisualMode as any);
    if (savedTheme) setTheme(savedTheme as any);
    if (savedLang) setLanguage(savedLang as any);
    if (savedFontSize) setFontSize(savedFontSize as any);

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions).map((session: ExtendedSession) => ({
          ...session,
          members: uniqueMembers(session.members || []),
        }));
        setSessions(parsed);
        
        if (savedActiveId && parsed.some((s: any) => s.id === savedActiveId)) {
          const activeSess = parsed.find((s: any) => s.id === savedActiveId);
          setActiveSessionId(savedActiveId);
          setSessionTitle(activeSess.title);
          setMessages(activeSess.messages);
          setMembers(activeSess.members);
          setView('meeting');
        } else {
          // If no active session, show pristine landingSuggestions (view='new-session')
          setView('new-session');
        }
      } catch (e) {
        console.error('Failed to parse saved sessions', e);
      }
    } else {
      // Pre-populate with beautiful initial sessions so the app feels immediately active and professional
      const initialSess: ExtendedSession[] = [
        {
          id: 'session-salt',
          title: '关于北境盐铁专营之榷议',
          timestamp: '丙辰/腊月廿三',
          mode: 'cabinet',
          sessionMode: 'meeting',
          pinned: true,
          members: INITIAL_MEMBERS,
          messages: getInitialMessages('cabinet', language)
        },
        {
          id: 'session-ethics',
          title: '关于两湖大区灾后财政核准案',
          timestamp: '丙辰年 仲春十五',
          mode: 'cabinet',
          sessionMode: 'meeting',
          pinned: false,
          members: INITIAL_MEMBERS.map(m => m.id === 'tool-custom' ? { ...m, role: 'none' } : m),
          messages: getInitialMessages('cabinet', language)
        }
      ];
      setSessions(initialSess);
      localStorage.setItem('cabinet_sessions_v3', JSON.stringify(initialSess));
    }
    // Try loading minister config from backend
    loadMembersFromBackend();
  }, []);

  // Save member changes to backend
  useEffect(() => {
    if (members.length > 0) {
      const timer = setTimeout(() => saveMembersToBackend(members), 500);
      return () => clearTimeout(timer);
    }
  }, [members]);

  // Save changes to sessions list
  const saveSessionsToStorage = (updatedSessions: ExtendedSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem('cabinet_sessions_v3', JSON.stringify(updatedSessions));
  };

  const handleNavWithBackup = (newView: ViewType) => {
    if (view !== 'settings' && view !== 'tools' && view !== 'folder-reader' && view !== 'image-studio' && view !== 'issue-report' && view !== 'selection') {
      setLastViewBeforeNav(view);
    }
    setView(newView);
  };

  // Helper starting session
  const handleStartSession = (
    title: string, 
    prompt: string, 
    sessionMode: 'private' | 'meeting' = 'meeting', 
    chosenMembers: CabinetMember[] = members
  ) => {
    const newId = 'session-' + Math.random().toString(36).substring(2, 9);
    
    // Create Emperor's decree
    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      sender: visualMode === 'cabinet' ? '朕 (圣上)' : '朕 (圣上)',
      avatar: '',
      content: prompt,
      isUser: true,
      roleLabel: visualMode === 'cabinet' ? '圣上' : '圣上'
    };

    const newSession: ExtendedSession = {
      id: newId,
      title,
      timestamp: visualMode === 'cabinet' ? '丙辰 / 即刻时' : '丙辰 / 即刻时',
      mode: visualMode,
      sessionMode,
      members: chosenMembers,
      messages: [userMsg],
      pinned: false
    };

    const updated = [newSession, ...sessions];
    saveSessionsToStorage(updated);
    
    // Toggle active state
    setActiveSessionId(newId);
    localStorage.setItem('cabinet_active_session_id_v3', newId);

    setSessionTitle(title);
    setMessages([userMsg]);
    setMembers(chosenMembers);
    setView('meeting');
    setIsComposingNewSession(false);

    // Trigger AI round
    handleTriggerDebateRound(prompt, [userMsg], chosenMembers, 1, newId, chosenMembers);
  };

  const handleSelectSession = (id: string) => {
    const sess = sessions.find(s => s.id === id);
    if (sess) {
      setActiveSessionId(id);
      localStorage.setItem('cabinet_active_session_id_v3', id);
      setSessionTitle(sess.title);
      setMessages(sess.messages);
      setMembers(sess.members);
      // Retain the globally active visualMode instead of reverting, and upgrade session mode
      setView('meeting');
      setIsComposingNewSession(false);
    }
  };

  const handleNewSessionButton = () => {
    setActiveSessionId(null);
    localStorage.removeItem('cabinet_active_session_id_v3');
    setView('new-session');
    setMessages([]);
    setSessionTitle('');
    setShowTopActionMenu(false);
    setTopActionTab('none');
    setActiveSessionMenuId(null);
    setIsComposingNewSession(true);
    setNewSessionDraftKey(k => k + 1);
  };

  // Toggle pinnings
  const handleTogglePinSession = (id: string) => {
    const updated = sessions.map(s => {
      if (s.id === id) {
        return { ...s, pinned: !s.pinned };
      }
      return s;
    });
    saveSessionsToStorage(updated);
    setActiveSessionMenuId(null);
  };

  // Renaming setup
  const handleStartRename = (id: string, currentTitle: string) => {
    setRenamingSessionId(id);
    setRenameInputValue(currentTitle);
    setActiveSessionMenuId(null);
  };

  const handleConfirmRename = (id: string) => {
    if (!renameInputValue.trim()) return;
    const updated = sessions.map(s => {
      if (s.id === id) {
        return { ...s, title: renameInputValue.trim() };
      }
      return s;
    });
    saveSessionsToStorage(updated);
    if (activeSessionId === id) {
      setSessionTitle(renameInputValue.trim());
    }
    setRenamingSessionId(null);
  };

  // Deletions
  const handleDeleteSession = (id: string) => {
    const confirmation = confirm(language === 'zh' ? '确定要删除此段议案历史吗？' : 'Delete this historical context?');
    if (!confirmation) return;
    
    const updated = sessions.filter(s => s.id !== id);
    saveSessionsToStorage(updated);
    setActiveSessionMenuId(null);

    if (activeSessionId === id) {
      setActiveSessionId(null);
      localStorage.removeItem('cabinet_active_session_id_v3');
      setView('new-session');
      setMessages([]);
      setIsComposingNewSession(false);
    }
  };

  // Toggle user from top selector
  const handleToggleUserActive = (id: string) => {
    const updatedMembers = members.map(m => m.id === id ? { ...m, selected: !m.selected } : m);
    setMembers(updatedMembers);
    syncActiveSessionData(updatedMembers, messages);
  };

  const handleUpdateRoleActive = (id: string, role: CabinetMember['role']) => {
    const updatedMembers = members.map(m => {
      if (role !== 'none' && m.role === role) {
        return { ...m, role: 'none' as any };
      }
      if (m.id === id) return { ...m, role };
      return m;
    });
    setMembers(updatedMembers);
    syncActiveSessionData(updatedMembers, messages);
  };

  const handleUpdateMinistryActive = (id: string, ministry: CabinetMember['ministry']) => {
    const updatedMembers = members.map(m => {
      if (m.id !== id) return m;
      // Auto-suggest skill based on ministry
      const suggestedSkill = MINISTRY_SKILLS[ministry];
      return { ...m, ministry, ...(suggestedSkill ? { skillId: suggestedSkill } : {}) };
    });
    setMembers(updatedMembers);
    syncActiveSessionData(updatedMembers, messages);
  };

  // Synchronize state into active historical session record
  const syncActiveSessionData = (
    currentMembers: CabinetMember[],
    currentMessages: ChatMessage[],
    targetSessionId: string | null = activeSessionId
  ) => {
    if (!targetSessionId) return;
    setSessions(prevSessions => {
      const updated = prevSessions.map(s => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            members: currentMembers,
            messages: currentMessages,
            mode: visualMode
          };
        }
        return s;
      });
      localStorage.setItem('cabinet_sessions_v3', JSON.stringify(updated));
      return updated;
    });
  };

  // Local tools integrations
  const handleAddLocalMember = (newMember: CabinetMember) => {
    const exists = members.some(m => m.id === newMember.id);
    let updated: CabinetMember[];
    if (exists) {
      updated = members.map(m => m.id === newMember.id ? newMember : m);
    } else {
      updated = [...members, newMember];
    }
    const normalized = uniqueMembers(updated);
    setMembers(normalized);
    syncActiveSessionData(normalized, messages);
  };

  const handleUpdateMembersList = (updated: CabinetMember[]) => {
    const normalized = uniqueMembers(updated);
    setMembers(normalized);
    syncActiveSessionData(normalized, messages);
  };

  // Dispatch message sending
  const handleSendMessage = async (text: string, directTarget?: CabinetMember) => {
    const targetBrief = directTarget ? (visualMode === 'cabinet' ? `【密奏 @${directTarget.name.split(' ')[0]}】 ` : `【密奏 @${directTarget.name.split(' ')[0]}】 `) : '';
    
    const userMsg: ChatMessage = {
      id: Math.random().toString(36),
      sender: visualMode === 'cabinet' ? '朕 (圣上)' : '朕 (圣上)',
      avatar: '',
      content: targetBrief ? targetBrief + text : text,
      isUser: true,
      roleLabel: visualMode === 'cabinet' ? '圣上' : '圣上'
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    syncActiveSessionData(members, updated);
    
    // If target @mention is specified, temporarily invoke only that member under the simulation pool!
    const pool = directTarget ? [directTarget] : members.filter(m => m.selected);
    await handleTriggerDebateRound(text, updated, pool);
  };

  // CONTINUATION CONTROLLER ("再议一轮")
  const handleAutomaticSelfTrigger = async (rounds: number = 1) => {
    if (messages.length === 0 || isGenerating) return;
    const triggerPrompt = visualMode === 'cabinet' 
      ? '内阁诸臣，各部公卿，请就刚才的提议，再议一轮，尽速辩驳陈奏！'
      : '诸臣依次批阅前议、提出辩驳，汇整合议结论。';
    
    await handleTriggerDebateRound(triggerPrompt, messages, members.filter(m => m.selected), rounds);
  };

  const getApiConfigsForMembers = (activePool: CabinetMember[]) => {
    try {
      const saved = localStorage.getItem('cabinet_api_configs');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const providerIds = new Set(activePool.map(m => (m.providerId || '').toLowerCase()).filter(Boolean));
      const needsRelay = activePool.some(m => ['model', 'custom'].includes(m.type));
      return parsed
        .filter((item: any) => {
          const id = String(item?.id || '').toLowerCase();
          return providerIds.has(id) || (needsRelay && id === 'ccswitch');
        })
        .map((item: any) => ({
          id: String(item.id || ''),
          name: String(item.name || ''),
          endpoint: String(item.endpoint || ''),
          apiKey: String(item.apiKey || ''),
          model: String(item.model || ''),
        }));
    } catch {
      return [];
    }
  };

  // Call main api backend debate with support for sequential multi-round simulations
  const handleTriggerDebateRound = async (
    queryText: string, 
    currentHistory: ChatMessage[], 
    activePool: CabinetMember[],
    roundsToRun: number = 1,
    targetSessionId: string | null = activeSessionId,
    sessionMembers: CabinetMember[] = members
  ) => {
    try {
      setIsGenerating(true);
      let cumulativeHistory = [...currentHistory];

      for (let r = 1; r <= roundsToRun; r++) {
        const isCabinet = visualMode === 'cabinet';
        const isZh = language === 'zh';
        
        // Render timeline round divider
        const roundTitle = isCabinet
          ? isZh
            ? `📜 ─── 【第 ${r} 轮 廷议辩驳展开】 ─── 📜`
            : `📜 ─── 【第 ${r} 轮 廷议辩驳展开】 ─── 📜`
          : isZh
            ? `📜 ─── 【第 ${r} 轮 廷议辩驳展开】 ─── 📜`
            : `📜 ─── 【第 ${r} 轮 廷议辩驳展开】 ─── 📜`;

        const dividerMsg: ChatMessage = {
          id: `divider-${Math.random().toString(36)}`,
          sender: 'SYSTEM_DIVIDER',
          avatar: '',
          content: roundTitle,
          isUser: false,
          roleLabel: 'SYSTEM',
          isRoundDivider: true,
          roundNumber: r
        };

        cumulativeHistory = [...cumulativeHistory, dividerMsg];
        setMessages(cumulativeHistory);
        syncActiveSessionData(sessionMembers, cumulativeHistory, targetSessionId);

        // Gentle pause to absorb the divider unfolding transition
        await new Promise(resolve => setTimeout(resolve, 800));

        // Formulate target prompt adjusted sequentially to the round number
        const actualPrompt = roundsToRun > 1
          ? isCabinet
            ? `【廷辩第 ${r} 轮】：群臣阁僚，请针对前序论点进行第 ${r} 轮相互辩驳，各抒己见！`
            : `【廷辩第 ${r} 轮】：群臣阁僚，请针对前序论点进行第 ${r} 轮相互辩驳，各抒己见！`
          : queryText;

        // Build selectedMembers with skill info
        const selectedWithSkills = activePool.map((m) => {
          const skill = m.skillId ? getSkillById(m.skillId) : undefined;
          return {
            id: m.id,
            name: m.name,
            nickname: m.nickname || '',
            ministry: m.ministry,
            role: m.role,
            skillId: m.skillId || '',
            skillPrompt: skill?.prompt || '',
            providerId: m.providerId || '',
            modelId: m.modelId || '',
            apiProfileId: m.apiProfileId || '',
            localToolId: m.localToolId || '',
          };
        });

        const response = await fetch('/api/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: visualMode,
            query: actualPrompt,
            history: cumulativeHistory.slice(-8).filter(h => !h.isRoundDivider),
            selectedMembers: selectedWithSkills,
            apiConfigs: getApiConfigsForMembers(activePool),
            projectBrief,
            projectHandoff
          })
        });

        if (!response.ok) {
          throw new Error('API debate simulation failed.');
        }

        const data = await response.json();
        const newMessages: ChatMessage[] = data.messages || [];

        if (newMessages.length > 0) {
          for (let i = 0; i < newMessages.length; i++) {
            await new Promise((resolve) => setTimeout(resolve, i === 0 ? 300 : 1200));
            
            const match = INITIAL_MEMBERS.find(m => m.id === newMessages[i].ministerId);
            const finalMsg: ChatMessage = {
              ...newMessages[i],
              avatar: match?.avatar || '',
            };
            cumulativeHistory.push(finalMsg);
            setMessages([...cumulativeHistory]);
            syncActiveSessionData(sessionMembers, cumulativeHistory, targetSessionId);
          }
        }

        // Delay between rounds
        if (r < roundsToRun) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Finalize selected plan as final imperial decree/promulgated verdict
  const handleSubmitVerdict = (plan: VerdictOption, executionAgentName: string) => {
    const verdictDeclaration: ChatMessage = {
      id: Math.random().toString(36),
      sender: visualMode === 'cabinet' ? '【交办执行】内阁谕旨' : '【交办执行】内阁谕旨',
      avatar: '',
      content: visualMode === 'cabinet'
        ? `【奉旨交办执行】\n\n钦命大纲：【${plan.title}】\n折大纲要：${plan.description}\n承办执行 Agent：💻 ${executionAgentName}\n\n朕准此折！命工部及 ${executionAgentName} 即刻奉旨启奏、编码核验，依案推演，钦此！`
        : `【奉旨交办执行】\n\n钦命大纲：【${plan.title}】\n折大纲要：${plan.description}\n承办执行 Agent：💻 ${executionAgentName}\n\n朕准此折！命工部及 ${executionAgentName} 即刻奉旨启奏、编码核验，依案推演，钦此！`,
      isUser: false,
      roleLabel: visualMode === 'cabinet' ? '交办执行' : '交办执行'
    };

    const finalMessages = [...messages, verdictDeclaration];
    setMessages(finalMessages);
    syncActiveSessionData(members, finalMessages);
    setShowVerdictModal(false);
  };

  const handleClearTranscript = () => {
    if (confirm(language === 'zh' ? '确定清除本会话所有记录？' : 'Reset this current active discussion log?')) {
      setMessages([]);
      syncActiveSessionData(members, []);
    }
  };

  // Export conversations to Markdown and prompt browser text download
  const handleExportConversation = () => {
    if (messages.length === 0) return;
    
    let text = language === 'zh'
      ? `# ${sessionTitle}\n\n模式：${visualMode === 'cabinet' ? '内阁' : '现代会审'} | 会话记录\n\n---\n\n`
      : `# ${sessionTitle}\n\nMode: ${visualMode.toUpperCase()} | Generated context transcript log\n\n---\n\n`;
    messages.forEach(m => {
      text += `### **${m.sender}** [${m.roleLabel || 'Seat'}]\n\n*${m.content}*\n\n---\n\n`;
    });

    // Trigger file download
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${sessionTitle.replace(/\s+/g, '_')}_transcript.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(language === 'zh' ? '✓ 奏本历史格式化导出：Markdown 文件下载已启动。' : '✓ Transcript exported successfully as Markdown file.');
  };

  // Switch style modes immediately from top selection
  const handleSetVisualMode = (mode: VisualModeType) => {
    setVisualMode(mode);
    localStorage.setItem('cabinet_visual_mode_v3', mode);
    
    if (activeSessionId) {
      const updated = sessions.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, mode };
        }
        return s;
      });
      saveSessionsToStorage(updated);
    }
  };

  // Filter sessions by search prompt
  const sortedSessions = [...sessions].sort((a, b) => {
    const aP = a.pinned ? 1 : 0;
    const bP = b.pinned ? 1 : 0;
    return bP - aP; // Pins display first
  });

  const filteredSessions = sortedSessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Theme responsive styling variables for premium look (ChatGPT clean + Cabinet ink scroll style)
  const isLight = theme === 'light';
  const isCabinet = visualMode === 'cabinet';

  const rootBgClass = isCabinet
    ? isLight 
      ? 'bg-rice-paper text-[#1c120c]' 
      : 'bg-rice-paper-dark text-[#eedec6]'
    : isLight 
      ? 'bg-[#f8fafc] text-slate-900' 
      : 'bg-[#0a0f1d] text-slate-200';

  const sidebarClass = isCabinet
    ? isLight
      ? 'bg-[#ebdcb9] border-r border-[#3d2b1f] text-[#2c1d0c]'
      : 'bg-[#1a140f] border-r border-[#3d2b1f] text-[#eedcc6]'
    : isLight
      ? 'bg-slate-100 border-r border-slate-250 text-slate-800'
      : 'bg-[#0f1322] border-r border-[#1e293b] text-slate-200';

  const sidebarHeaderClass = isCabinet
    ? isLight ? 'bg-[#dfce9e] border-b border-[#3d2b1f]' : 'bg-[#130d09] border-b border-[#3d2b1f]'
    : isLight ? 'bg-slate-200/50 border-b border-slate-200' : 'bg-[#070a14] border-b border-[#1e293b]';

  const textPrimaryClass = isCabinet
    ? isLight ? 'text-[#1c120c]' : 'text-[#eeddc5]'
    : isLight ? 'text-slate-800' : 'text-slate-100';

  const textSecondaryClass = isCabinet
    ? isLight ? 'text-[#61462a]' : 'text-[#b09e85]'
    : isLight ? 'text-slate-500' : 'text-slate-400';

  const searchInputClass = isCabinet
    ? isLight
      ? 'bg-[#fcf7ec] border border-[#3d2b1f] text-[#1c120c] placeholder-[#806b52]/80'
      : 'bg-[#120d09] border border-[#3d2b1f] text-[#eeddc6] placeholder-[#735e45]'
    : isLight
      ? 'bg-white border border-slate-200 text-slate-850 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
      : 'bg-[#06080e] border border-slate-800 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  const scrollItemClass = (isActive: boolean) => {
    if (isActive) {
      return isCabinet
        ? 'bg-[#3d2b1f]/10 border-l-4 border-[#7a4823] text-[#7a4823] font-bold shadow-sm'
        : 'bg-blue-600/10 border-l-4 border-blue-500 text-blue-500 font-bold';
    }
    return isCabinet
      ? isLight ? 'hover:bg-[#dfce9e]/40 text-[#54402a]' : 'hover:bg-[#251e16] text-[#c9b7a1]'
      : isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800/40 text-slate-450';
  };

  const headerClass = isCabinet
    ? isLight ? 'bg-rice-paper border-b border-[#3d2b1f] text-[#1c120c]' : 'bg-rice-paper-dark border-b border-[#3d2b1f] text-[#eeddc5]'
    : isLight ? 'bg-white border-b border-slate-200 text-slate-800' : 'bg-[#0a0f1d] border-b border-[#1e293b] text-[#eeddc5]';
  const appFontSizeClass = fontSize === 'sm' ? 'text-[13px]' : fontSize === 'lg' ? 'text-[15px]' : fontSize === 'xl' ? 'text-[16px]' : 'text-[14px]';

  return (
    <div className={`min-h-screen ${rootBgClass} ${isCabinet ? 'font-serif' : 'font-sans'} ${appFontSizeClass} flex overflow-hidden app-scaled`} style={fontScaleRootStyle(fontSize)}>
      
      {/* LEFT CHATGPT-STYLE COLLAPSIBLE SIDEBAR */}
      <aside 
        className={`${sidebarClass} h-screen transition-all duration-300 flex flex-col shrink-0 overflow-hidden relative z-30 shadow-2xl ${
          isSidebarOpen ? 'w-66' : 'w-0 border-r-0'
        }`}
      >
        {/* Sidebar Header Title logo */}
        <div className={`p-4.5 flex items-center justify-between ${sidebarHeaderClass}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-amber-600/15 border border-amber-600/30 flex items-center justify-center text-amber-500 text-base font-bold shadow-inner shrink-0">
              {visualMode === 'cabinet' ? '🏛️' : '🌐'}
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-black font-display tracking-widest truncate">
                {visualMode === 'cabinet' ? t(language, 'sidebar.title') : t(language, 'sidebar.title')}
              </h2>
              <span className={`text-[8px] font-mono tracking-widest block font-bold uppercase mt-0.5 ${isLight ? 'text-stone-500' : 'text-stone-450'}`}>{t(language, 'sidebar.subtitle')}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-lg text-stone-500 hover:text-amber-600 transition cursor-pointer"
            title="收起历史侧栏"
          >
            <PanelLeftClose className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Start new session button */}
        <div className="p-3 font-medium">
          <button
            onClick={handleNewSessionButton}
            className={`w-full py-3 px-3 border rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow cursor-pointer group ${
              isCabinet
                ? 'bg-[#3d2b1f]/10 hover:bg-[#3d2b1f] border-[#3d2b1f] text-[#3d2b1f] hover:text-[#f4ecd8]'
                : 'bg-blue-600/10 hover:bg-blue-600 border-blue-500/20 hover:border-transparent text-blue-500 hover:text-white'
            }`}
          >
            <Plus className="w-4.5 h-4.5 transition-transform group-hover:rotate-90" />
            <span>{visualMode === 'cabinet' ? t(language, 'sidebar.newSession') : t(language, 'sidebar.newSession')}</span>
          </button>
        </div>

        {/* History search */}
        <div className="px-3 pb-2 relative shrink-0">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={visualMode === 'cabinet' ? t(language, 'sidebar.search') : t(language, 'sidebar.search')}
            className={`w-full text-xs rounded-lg py-1.5 pl-8 pr-3 focus:outline-none transition ${searchInputClass}`}
          />
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-6 top-3" />
        </div>

        {/* Session history list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1.5 py-2 scrollbar-none">
          {filteredSessions.length === 0 ? (
            <div className={`text-center py-8 text-[11px] font-mono select-none ${isLight ? 'text-stone-400' : 'text-stone-600'}`}>
              无匹配廷议历史
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isRenaming = renamingSessionId === session.id;
              
              return (
                <div 
                  key={session.id}
                  className={`group rounded-xl p-2.5 transition relative cursor-pointer flex flex-col justify-between ${scrollItemClass(isActive)}`}
                  onClick={() => !isRenaming && handleSelectSession(session.id)}
                >
                  
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renameInputValue}
                      onChange={e => setRenameInputValue(e.target.value)}
                      onBlur={() => handleConfirmRename(session.id)}
                      onKeyDown={e => e.key === 'Enter' && handleConfirmRename(session.id)}
                      className={`text-xs outline-none rounded p-1 w-full text-[11px] ${
                        isCabinet
                          ? 'bg-[#faf8f5] border border-amber-600'
                          : 'bg-stone-900 border border-emerald-500 text-stone-105'
                      }`}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-[11px] font-bold truncate tracking-wide ${
                          isActive 
                            ? 'text-amber-500 font-extrabold' 
                            : isLight ? 'text-stone-800' : 'text-stone-200'
                        }`}>
                          {session.title}
                        </h4>
                        <span className={`text-[9px] font-mono mt-1 block ${isLight ? 'text-stone-500' : 'text-stone-550'}`}>
                          {session.mode === 'cabinet' ? '🏛️ 内阁' : '🏛️ 内阁'} • {session.messages.length} {t(language, 'sidebar.sessionSuffix')}
                        </span>
                      </div>
                      
                      {session.pinned && (
                        <Pin className="w-3 h-3 text-amber-500 rotate-45 shrink-0 mt-0.5" />
                      )}
                    </div>
                  )}

                  {/* Context hover floating triple dot action box */}
                  {!isRenaming && (
                    <div className="absolute right-1 top-2.5 opacity-0 group-hover:opacity-100 transition duration-155 flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionMenuId(activeSessionMenuId === session.id ? null : session.id);
                        }}
                        className="p-1 hover:text-amber-500 text-stone-500 rounded"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeSessionMenuId === session.id && (
                        <div className={`absolute right-0 top-6 border rounded-lg py-1.5 w-28 shadow-2xl z-50 text-[10px] font-mono ${
                          isCabinet
                            ? 'bg-[#faf6ee] border-[#bca580]/40 text-[#2c1d0c]'
                            : 'bg-stone-950 border-neutral-800 text-stone-300'
                        }`}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleTogglePinSession(session.id); }}
                            className="w-full text-left px-3 py-1 hover:bg-amber-600/5 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Pin className="w-3 h-3 text-amber-500" />
                            {session.pinned ? t(language, 'sidebar.pinOff') : t(language, 'sidebar.pinOn')}
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleStartRename(session.id, session.title); }}
                            className="w-full text-left px-3 py-1 hover:bg-amber-600/5 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-amber-500" />
                            {t(language, 'sidebar.rename')}
                          </button>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                            className="w-full text-left px-3 py-1 hover:bg-amber-600/5 text-red-400 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            {t(language, 'sidebar.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Sidebar settings and manager togglers bottom rows */}
        <div className={`p-3 border-t shrink-0 ${
          isCabinet
            ? isLight ? 'border-[#c2b291]/30 bg-[#dfd3b5]/15' : 'border-[#3a3026] bg-[#0c0908]/40'
            : isLight ? 'border-neutral-200 bg-stone-100' : 'border-neutral-850 bg-[#121212]/40'
        } space-y-1`}>
          
          <button 
            onClick={() => handleNavWithBackup('selection')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'selection' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-600/10 font-bold text-emerald-500') : ''}`}
          >
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t(language, 'sidebar.ministry')}</span>
          </button>

          <button 
            onClick={() => handleNavWithBackup('tools')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'tools' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-600/10 font-bold text-emerald-500') : ''}`}
          >
            <Radio className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{t(language, 'sidebar.tools')}</span>
          </button>

          <button 
            onClick={() => handleNavWithBackup('folder-reader')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'folder-reader' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-600/10 font-bold text-emerald-500') : ''}`}
          >
            <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{t(language, 'sidebar.folderReader')}</span>
          </button>

          <button
            onClick={() => handleNavWithBackup('image-studio')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'image-studio' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-600/10 font-bold text-emerald-500') : ''}`}
          >
            <ImageIcon className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <span>AI 图像创作</span>
          </button>

          <button
            onClick={() => handleNavWithBackup('issue-report')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'issue-report' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-600/10 font-bold text-emerald-500') : ''}`}
          >
            <Bug className="w-4 h-4 text-rose-400 shrink-0" />
            <span>问题反馈</span>
          </button>

          <button 
            onClick={() => handleNavWithBackup('settings')}
            className={`w-full py-2 px-3 rounded-lg text-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              isCabinet
                ? isLight ? 'hover:bg-[#dfd3b5]/40 text-[#54432d]' : 'hover:bg-[#25201a] text-[#ebd9bc]'
                : isLight ? 'hover:bg-[#eaecee] text-stone-700' : 'hover:bg-neutral-800 text-stone-300'
            } ${view === 'settings' ? (isCabinet ? 'bg-[#c5a880]/15 font-bold text-amber-600' : 'bg-emerald-610/10 font-bold text-[#10b981]') : ''}`}
          >
            <SettingsIcon className="w-4 h-4 text-teal-500 shrink-0" />
            <span>{t(language, 'sidebar.settings')}</span>
          </button>

          {/* Collapsible Panel back link */}
          <div className={`pt-2 text-[8px] text-center leading-none font-semibold font-mono ${isLight ? 'text-stone-400' : 'text-stone-550'}`}>
            <span>{t(language, 'sidebar.localMode')}</span>
          </div>

        </div>

      </aside>

      {/* MAIN SCREEN LAYOUT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* CHATGPT STYLE TOP HEADER */}
        <header className={`${headerClass} px-5 py-3 shrink-0 flex items-center justify-between z-25 relative shadow-md`}>
          <div className="flex items-center gap-3">
            
            {/* Sidebar toggle */}
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1.5 rounded-lg border cursor-pointer shadow mr-1 animate-fadeIn transition ${
                  isCabinet
                    ? isLight ? 'bg-[#f4eedb] border-[#c2b291]/40 text-[#2c1d0c] hover:bg-[#e9dec4]' : 'bg-[#181512] border-[#3a3026] text-[#eeddc5] hover:bg-[#25201a]'
                    : isLight ? 'bg-white border-neutral-200 text-stone-700 hover:bg-stone-50' : 'bg-stone-950/80 border-stone-800 text-stone-400 hover:text-stone-100'
                }`}
                title="开启历史栏"
              >
                <PanelLeft className="w-4.5 h-4.5" />
              </button>
            )}

            {/* Natural model selector drop-down container pill matched to specifications */}
            <div className={`border px-4 py-1.5 rounded-xl flex items-center gap-2.5 text-xs transition-all font-mono ${
              isCabinet
                ? isLight ? 'bg-[#f4eedb] border-[#c2b291]/40 text-[#2c1d0c]' : 'bg-[#181512]/90 border-[#3a3026] text-[#eeddc5]'
                : isLight ? 'bg-neutral-50 border-neutral-200 text-stone-700' : 'bg-stone-950/80 border-neutral-800 text-stone-300'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isCabinet ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                <span className={isLight ? 'text-stone-500' : 'text-stone-400'}>{t(language, 'sidebar.modeLabel')}</span>
                <strong className={`font-bold ${isCabinet ? 'text-amber-500' : 'text-emerald-500'}`}>{activeSessionId ? (sessions.find(s => s.id === activeSessionId)?.sessionMode === 'private' ? t(language, 'sidebar.privateLabel') : t(language, 'sidebar.councilLabel')) : t(language, 'sidebar.autoPlanLabel')}</strong>
              </div>
              <span className={isLight ? 'text-neutral-250' : 'text-stone-700'}>|</span>
              <button 
                onClick={() => handleSetVisualMode(visualMode === 'cabinet' ? 'un' : 'cabinet')}
                className="hover:text-amber-500 transition cursor-pointer font-bold flex items-center gap-1 text-xs"
                title={language === 'zh' ? '点击一键瞬移视觉场景' : 'Shift scene perspective'}
              >
                <span>{visualMode === 'cabinet' ? t(language, 'sidebar.cabinetView') : t(language, 'sidebar.unView')}</span>
              </button>
            </div>

          </div>

          {/* Top header right actions dropdown menu */}
          <div className="flex items-center gap-2 relative">
            
            {activeSessionId && (
              <>
                <button
                  onClick={() => setShowTopActionMenu(!showTopActionMenu)}
                  className={`px-3 py-1.5 border rounded-xl text-xs flex items-center gap-1 cursor-pointer font-bold transition shadow ${
                    isCabinet
                      ? isLight ? 'bg-[#f4eedb] border-[#c2b291]/50 text-[#2c1d0c] hover:bg-[#dfd3b5]/50' : 'bg-[#181512] border-[#3a3026] text-[#eeddc5] hover:bg-[#25201a]'
                      : isLight ? 'bg-white border-neutral-250 text-stone-700 hover:bg-[#eaecee]' : 'bg-stone-950 border-neutral-800 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t(language, 'meeting.cabinetMgmt')}</span>
                </button>

                {/* Top Action Dropdown options list */}
                {showTopActionMenu && (
                  <div className="absolute right-0 top-10 bg-stone-900 border border-stone-800 rounded-2xl p-4 w-72 shadow-2xl z-50 space-y-3.5 text-xs animate-fadeIn text-stone-300">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                      <span className="font-bold font-mono tracking-wider text-amber-500">{t(language, 'meeting.councilMgmt')}</span>
                      <button onClick={() => { setShowTopActionMenu(false); setTopActionTab('none'); }} className="text-stone-500 hover:text-stone-100">×</button>
                    </div>

                    {/* Sub tabs selectors */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      <button onClick={() => setTopActionTab('add')} className={`py-1 rounded border transition ${topActionTab === 'add' ? 'bg-amber-600/10 border-amber-600 text-amber-400' : 'bg-stone-950 border-stone-800'}`}>加入</button>
                      <button onClick={() => setTopActionTab('remove')} className={`py-1 rounded border transition ${topActionTab === 'remove' ? 'bg-amber-600/10 border-amber-600 text-amber-400' : 'bg-stone-950 border-stone-805'}`}>罢免</button>
                      <button onClick={() => setTopActionTab('host')} className={`py-1 rounded border transition ${topActionTab === 'host' ? 'bg-amber-600/10 border-amber-600 text-amber-400' : 'bg-stone-950 border-stone-805'}`}>首脑</button>
                      <button onClick={() => setTopActionTab('positions')} className={`py-1 rounded border transition ${topActionTab === 'positions' ? 'bg-amber-600/10 border-amber-600 text-amber-400' : 'bg-stone-950 border-stone-805'}`}>部阁</button>
                    </div>

                    {/* Active submenu widgets */}
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {topActionTab === 'add' && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-stone-500 mb-1 leading-relaxed">任用法印：遴选加入当前议政会场</p>
                          {members.filter(m => !m.selected).map(m => (
                            <button key={m.id} onClick={() => handleToggleUserActive(m.id)} className="w-full p-1.5 rounded bg-stone-950 hover:bg-stone-800 border border-stone-800 text-left text-[11px] truncate flex items-center justify-between">
                              <span>➕ {m.name}</span>
                              <span className="text-[9px] text-stone-600">{m.badge}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {topActionTab === 'remove' && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-stone-500 mb-1 leading-relaxed">罢免退出：降黜该阁员出列</p>
                          {members.filter(m => m.selected).map(m => (
                            <button key={m.id} onClick={() => handleToggleUserActive(m.id)} className="w-full p-1.5 rounded bg-stone-950 hover:bg-rose-955 border border-stone-805 text-left text-[11px] truncate flex items-center justify-between hover:text-rose-400">
                              <span>➖ {m.name}</span>
                              <span className="text-[9px] text-stone-60 pointer-events-none">罢免</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {topActionTab === 'host' && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-stone-505 mb-1">重任司职：钦命起草首辅/首座大臣</p>
                          {members.filter(m => m.selected).map(m => (
                            <button key={m.id} onClick={() => handleUpdateRoleActive(m.id, visualMode === 'cabinet' ? 'pm' : 'sg')} className="w-full p-1.5 rounded bg-stone-950 hover:bg-amber-600/10 border border-stone-800 text-left text-[11px] truncate flex items-center justify-between">
                              <span className="flex items-center gap-1">👑 {m.name}</span>
                              {m.role !== 'none' && <span className="text-[8px] bg-amber-600 text-stone-950 px-1 py-0.2 rounded font-bold font-mono">首辅</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {topActionTab === 'positions' && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-stone-505 mb-1">六部重新认领职位：</p>
                          {members.filter(m => m.selected).map(m => (
                            <div key={m.id} className="p-1.5 rounded bg-stone-950 border border-stone-800 space-y-1">
                              <span className="text-[10px] font-bold text-stone-350">{m.name.split(' ')[0]}</span>
                              <select 
                                value={m.ministry} 
                                onChange={(e) => handleUpdateMinistryActive(m.id, e.target.value as any)}
                                className="w-full text-[10px] bg-stone-900 text-stone-200 border border-stone-800 rounded p-1"
                              >
                                <option value="none">无具体部职</option>
                                <option value="personnel">吏部 / 朝局考课</option>
                                <option value="rites">礼部 / 朝仪公关</option>
                                <option value="works">工部 / 工程营造</option>
                                <option value="war">兵部 / 巡边保驾</option>
                                <option value="punishments">刑部 / 刑律典狱</option>
                                <option value="revenue">户部 / 钱粮调度</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-stone-800 pt-2 flex flex-col gap-1 text-[11px]">
                      <button onClick={handleExportConversation} className="w-full py-2 hover:bg-stone-800 text-left px-2 rounded-lg flex items-center gap-2">
                        <Download className="w-4 h-4 text-amber-500" />
                        <span>{t(language, 'meeting.exportMD')}</span>
                      </button>
                      <button onClick={handleClearTranscript} className="w-full py-2 hover:bg-stone-800 text-left px-2 text-rose-400 rounded-lg flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-rose-400 animate-pulse" />
                        <span>{t(language, 'meeting.clearLog')}</span>
                      </button>
                    </div>

                  </div>
                )}
              </>
            )}

          </div>
        </header>

        {/* CONTAINER WORK MODULE VIEW FOR LANDING SUGGESTS CARD INTEGRATED ON START */}
        <div className="flex-1 overflow-auto bg-stone-950/10">
          
          {/* Landing suggegts screen if no session has active focus (fits ChatGPT layout) */}
          {view === 'new-session' && messages.length === 0 && !isComposingNewSession ? (
            <div className="h-full flex flex-col justify-center items-center px-6 py-12 max-w-4xl mx-auto space-y-10 select-none animate-fadeIn">

              {/* Central Visual Logo */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-amber-600 flex items-center justify-center font-bold text-stone-105 text-4xl shadow-2xl mx-auto animate-bounce-slow">
                  🏛️
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight text-stone-105 font-display min-h-[40px] uppercase">
                  {visualMode === 'cabinet' ? '🏛️ 帝制深沉・廷议案台' : '🌐 现代会审'}
                </h1>

                <p className="text-stone-400 text-xs tracking-wide max-w-md mx-auto leading-relaxed">
                  {visualMode === 'cabinet'
                    ? '起谕旨、配阁臣、命尚书、交承办。针对家国重典大事进行多智能体自动推算与终局决策。'
                    : '起谕旨、配阁臣、命尚书、交承办。针对家国重典大事进行多智能体自动推算与终局决策。'}
                </p>
              </div>

              {/* Custom Creation Shortcut */}
              <button
                onClick={() => {
                  setIsComposingNewSession(true);
                  setNewSessionDraftKey(k => k + 1);
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs tracking-wider transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-stone-950" />
                <span>开辟新廷本 ➔</span>
              </button>

            </div>
          ) : (
            // Regular view controller routes
            <div className="h-full">
              {view === 'selection' && (
                <CabinetSelection
                  members={members}
                  onToggleUser={handleToggleUserActive}
                  onUpdateRole={handleUpdateRoleActive}
                  onUpdateMinistry={handleUpdateMinistryActive}
                  onAddMember={(member) => {
                    const updated = [...members, { ...member, selected: true }];
                    setMembers(updated);
                    syncActiveSessionData(updated, messages);
                  }}
                  onUpdateMember={(id, patch) => {
                    const updated = members.map((m) => (m.id === id ? { ...m, ...patch } : m));
                    setMembers(updated);
                    syncActiveSessionData(updated, messages);
                  }}
                  onDeleteMember={(id) => {
                    const updated = members.filter((m) => m.id !== id);
                    setMembers(updated);
                    syncActiveSessionData(updated, messages);
                  }}
                  onContinue={() => {
                    setIsComposingNewSession(true);
                    setNewSessionDraftKey(k => k + 1);
                    setView('new-session');
                  }}
                  visualMode={visualMode}
                  theme={theme}
                />
              )}

              {view === 'new-session' && (
                <NewSession 
                  key={newSessionDraftKey}
                  onBack={() => setView('selection')}
                  onStartSession={handleStartSession}
                  visualMode={visualMode}
                  availableMembersPreset={members}
                  theme={theme}
                />
              )}

              {view === 'meeting' && (
                <CabinetMeeting 
                  title={sessionTitle}
                  messages={messages}
                  members={members}
                  onSendMessage={handleSendMessage}
                  onSelfTrigger={handleAutomaticSelfTrigger}
                  onOpenVerdict={() => setShowVerdictModal(true)}
                  onSwitchToColumns={() => setView('columns')}
                  onBack={() => setView('new-session')}
                  onClear={handleClearTranscript}
                  isGenerating={isGenerating}
                  visualMode={visualMode}
                  theme={theme}
                  fontSize={fontSize}
                  language={language}
                />
              )}

              {view === 'columns' && (
                <CabinetColumns 
                  members={members}
                  messages={messages}
                  onBackToMeeting={() => setView('meeting')}
                  visualMode={visualMode}
                  isGenerating={isGenerating}
                  theme={theme}
                  fontSize={fontSize}
                  language={language}
                />
              )}

              {view === 'settings' && (
                <Settings 
                  visualMode={visualMode}
                  onSetVisualMode={handleSetVisualMode}
                  theme={theme}
                  onSetTheme={setTheme}
                  language={language}
                  onSetLanguage={setLanguage}
                  fontSize={fontSize}
                  onSetFontSize={setFontSize}
                  onBack={() => setView(lastViewBeforeNav || 'meeting')}
                />
              )}

              {view === 'tools' && (
                <LocalTools 
                  members={members}
                  onAddLocalMember={handleAddLocalMember}
                  onUpdateMembersList={handleUpdateMembersList}
                  onBack={() => setView(lastViewBeforeNav || 'meeting')}
                  visualMode={visualMode}
                  theme={theme}
                  language={language}
                />
              )}

              {view === 'folder-reader' && (
                <FolderReader 
                  onAddProjectContext={(context, handoff) => {
                    setProjectBrief(context);
                    setProjectHandoff(handoff);
                    setView('meeting');
                  }}
                  visualMode={visualMode}
                  theme={theme}
                  onBack={() => setView(lastViewBeforeNav || 'meeting')}
                  language={language}
                />
              )}

              {view === 'issue-report' && (
                <IssueReport
                  onBack={() => setView(lastViewBeforeNav || 'meeting')}
                  theme={theme}
                />
              )}

              {view === 'image-studio' && (
                <ImageStudio
                  onBack={() => setView(lastViewBeforeNav || 'meeting')}
                  theme={theme}
                />
              )}
            </div>
          )}

        </div>

      </div>

      {/* Decision Finalize modal overlay */}
      {showVerdictModal && (
        <VerdictModal 
          onClose={() => setShowVerdictModal(false)}
          onSubmitVerdict={handleSubmitVerdict}
          messages={messages}
          contextTitle={sessionTitle}
          visualMode={visualMode}
        />
      )}

    </div>
  );
}
