/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { CabinetMember, ChatMessage } from '../types';
import { normalizeMessageForLanguage } from '../data';
import { 
  Send, Sparkles, Gavel, RefreshCw, Layers, ShieldAlert, Paperclip,
  Trash2, ArrowLeft, Bot, HelpCircle, CheckCircle2, UserCheck, 
  ThumbsUp, ThumbsDown, AlertTriangle, Play, FileText, Check, Plus,
  PanelLeft, PanelLeftClose, Copy, Clock
} from 'lucide-react';
import { SafeAvatar } from './SafeAvatar';

interface CabinetMeetingProps {
  title: string;
  messages: ChatMessage[];
  members: CabinetMember[];
  onSendMessage: (text: string, targetMember?: CabinetMember) => void;
  onSelfTrigger: (rounds?: number) => void;
  onStopThinking: () => void;
  onOpenVerdict: () => void;
  onSwitchToColumns: () => void;
  onBack: () => void;
  onClear: () => void;
  onOpenAutoDebate?: () => void;
  isGenerating: boolean;
  visualMode: 'cabinet' | 'un';
  theme?: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  language?: 'zh' | 'en';
}

const getStableTimeOfMessage = (msg: ChatMessage, language: 'zh' | 'en' | undefined, visualMode: string) => {
  if (msg.timestamp) return msg.timestamp;
  
  // Use a stable hash of the message ID to ensure it is static and doesn't flicker on refresh/re-render
  let hash = 0;
  const idStr = msg.id || '';
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  // Restrict to solid business/government hours: 09:00 to 18:00
  const hour = 9 + (absHash % 10); 
  const minute = absHash % 60;
  const padH = String(hour).padStart(2, '0');
  const padM = String(minute).padStart(2, '0');

  if (visualMode === 'cabinet') {
    // 12 Traditional Earthly Branches mapping
    const earthlyBranches = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    const branchIndex = Math.floor(((hour + 1) % 24) / 2);
    const branch = earthlyBranches[branchIndex];
    // Traditional quarter mappings (一刻, 二刻, 三刻, 正刻)
    const quarterIndex = Math.floor(minute / 15);
    const quarterStrings = ['正刻', '一刻', '二刻', '三刻'];
    const quarter = quarterStrings[quarterIndex];
    
    return language === 'zh'
      ? `${branch}${quarter} (${padH}:${padM})`
      : `${branch} ${quarter} (${padH}:${padM})`;
  } else {
    return `${padH}:${padM}`;
  }
};

export const CabinetMeeting: React.FC<CabinetMeetingProps> = ({
  title,
  messages,
  members,
  onSendMessage,
  onSelfTrigger,
  onStopThinking,
  onOpenVerdict,
  onSwitchToColumns,
  onBack,
  onClear,
  onOpenAutoDebate,
  isGenerating,
  visualMode,
  theme = 'dark',
  fontSize,
  language = 'zh'
}) => {
  const uiLanguage: 'zh' | 'en' = language === 'en' ? 'en' : 'zh';
  const [inputText, setInputText] = useState('');
  const [targetMember, setTargetMember] = useState<CabinetMember | undefined>(undefined);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [msgStances, setMsgStances] = useState<Record<string, 'approve' | 'reject' | 'none'>>({});
  const [attachedFiles, setAttachedFiles] = useState<{name: string, size: string}[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const availableRounds = Array.from(
    new Set(
      messages
        .filter(msg => msg.isRoundDivider && msg.roundNumber !== undefined)
        .map(msg => Number(msg.roundNumber))
    )
  ).sort((a, b) => Number(a) - Number(b));

  const activeMembers = members.filter(m => m.selected);
  const isLight = theme === 'light' && visualMode === 'un';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    
    // Send message with optional target @mention context
    onSendMessage(inputText.trim(), targetMember);
    setInputText('');
    setTargetMember(undefined); // Reset target after sending
  };

  const handleToggleMention = (member: CabinetMember) => {
    setTargetMember(prev => (prev?.id === member.id ? undefined : member));
  };

  const handleFileUploadSimulate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files).map((f: any) => ({
        name: f.name,
        size: (f.size / 1024).toFixed(1) + ' KB'
      }));
      setAttachedFiles(prev => [...prev, ...fileList]);
      setShowAttachMenu(false);
    }
  };

  // Toggle state of approval/rejection for individual items to support multi-select staging
  const handleToggleMessageStance = (msgId: string, stanceType: 'approve' | 'reject') => {
    if (isGenerating) return;
    setMsgStances(prev => {
      const current = prev[msgId];
      if (current === stanceType) {
        const copy = { ...prev };
        delete copy[msgId];
        return copy;
      } else {
        return {
          ...prev,
          [msgId]: stanceType
        };
      }
    });
  };

  // Compile individual decisions and send as a unified central mandate on group debate trigger
  const handleGroupDebateTrigger = () => {
    if (isGenerating) return;
    const activeStanceKeys = Object.entries(msgStances).filter(([_, s]) => s === 'approve' || s === 'reject');

    if (activeStanceKeys.length > 0) {
      const approvedSenders: string[] = [];
      const rejectedSenders: string[] = [];

      activeStanceKeys.forEach(([msgId, stance]) => {
        const msg = messages.find(m => m.id === msgId);
        if (msg) {
          if (stance === 'approve') {
            approvedSenders.push(msg.sender);
          } else {
            rejectedSenders.push(msg.sender);
          }
        }
      });

      let decreeText = '';
      if (visualMode === 'cabinet') {
        decreeText = language === 'zh' ? '【圣旨】：朕批阅众臣条奏。' : '【EMPEROR DECREE】: Royal review of councillor drafts.';
        if (approvedSenders.length > 0) {
          decreeText += language === 'zh' 
            ? `对 【${approvedSenders.join('、')}】 等所奏之议：准奏交付执行！`
            : ` Approved proposals submitted by 【${approvedSenders.join(', ')}】;`;
        }
        if (rejectedSenders.length > 0) {
          decreeText += (approvedSenders.length > 0 ? (language === 'zh' ? '；' : ' ') : '') + (language === 'zh' 
            ? `对 【${rejectedSenders.join('、')}】 等多漏窒碍之议：窒碍难行，特予驳回！`
            : ` Vetoed and rejected flawed drafts from 【${rejectedSenders.join(', ')}】;`);
        }
        decreeText += language === 'zh'
          ? ' 着众阁相公卿恪尽职守，切中圣谕，再议一轮，速作备折！'
          : ' Commanding all councillors to perform their duties and continue core debate iteration.';
      } else {
        decreeText = language === 'zh' ? '【公审结论】：审查委员会决议。' : '【SYSTEM MUNICIPALS】: Council evaluation complete.';
        if (approvedSenders.length > 0) {
          decreeText += language === 'zh'
            ? ` 采纳由 【${approvedSenders.join('和')}】 提交的评议；`
            : ` Approved briefs submitted by: 【${approvedSenders.join(', ')}】;`;
        }
        if (rejectedSenders.length > 0) {
          decreeText += language === 'zh'
            ? ` 坚决驳回 【${rejectedSenders.join('和')}】 的不合规草案；`
            : ` Vetoed/rejected drafts from: 【${rejectedSenders.join(', ')}】;`;
        }
        decreeText += language === 'zh'
          ? ' 所有席位成员需立即重置合规性阈值，开始下一轮评析。'
          : ' Propagate compliance thresholds, deploy secondary arguments, and launch consensus debate round.';
      }

      onSendMessage(decreeText);
      setMsgStances({});
    } else {
      // Direct pass-through if no specific stances selected (trigger next single round)
      onSelfTrigger(1);
    }
  };

  const getFontSizeClass = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    switch (size) {
      case 'sm': return 'text-[11px] sm:text-[12px] leading-relaxed';
      case 'md': return 'text-[12px] sm:text-[13.5px] leading-relaxed';
      case 'lg': return 'text-[13.5px] sm:text-[15px] leading-[1.75]';
      case 'xl': return 'text-[15px] sm:text-[17px] leading-[1.8]';
      default: return 'text-[12px] sm:text-[13.5px] leading-relaxed';
    }
  };

  const fontClass = getFontSizeClass(fontSize);

  return (
    <div className={`w-full h-full flex-1 min-h-0 flex flex-col lg:flex-row gap-2 px-2 py-1 animate-fadeIn ${
      visualMode === 'cabinet' ? 'font-serif' : 'font-sans'
    }`}>
      
      {/* Panelists Sidebar (在列公卿) with Collapsible Design */}
      <div 
        id="panelists-sidebar"
        className={`border rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-xl transition-all duration-300 ${
          isSidebarCollapsed 
            ? 'w-full lg:w-16 p-2 items-center justify-start lg:h-full shrink-0' 
            : 'w-full lg:w-64 p-4 lg:h-full shrink-0'
        } ${
          visualMode === 'cabinet'
            ? theme === 'dark'
              ? 'bg-[#181512] border-[#c0a680]/30 text-[#f1ebd9]'
              : 'bg-[#faf6ee] border-[#bca580]/40 text-[#251c11]'
            : theme === 'dark'
              ? 'bg-[#171717] border-neutral-800 text-stone-200'
              : 'bg-[#ffffff] border-[#e5e5e5] text-stone-850'
        }`}
      >
        {isSidebarCollapsed ? (
          // Collapsed View
          <div className="flex lg:flex-col items-center justify-between lg:justify-start gap-4 w-full h-full py-1">
            <button 
              type="button" 
              onClick={() => setIsSidebarCollapsed(false)} 
              className={`p-2 rounded-xl transition cursor-pointer self-center ${
                visualMode === 'cabinet'
                  ? 'hover:bg-[#c5a8a0]/15 text-amber-600'
                  : 'hover:bg-stone-850 text-stone-400'
              }`}
              title={visualMode === 'cabinet' ? (language === 'zh' ? '展开在列公卿' : 'Expand Imperial Councillors') : (language === 'zh' ? '展开参审面板' : 'Expand Sidebar')}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            
            <div className="hidden lg:flex flex-col items-center gap-3 mt-4 overflow-y-auto max-h-[80%] py-2 pr-1">
              {activeMembers.map(member => {
                const isTarget = targetMember?.id === member.id;
                return (
                  <div 
                    key={member.id} 
                    onClick={() => handleToggleMention(member)}
                    className={`relative cursor-pointer transition-transform duration-155 transform hover:scale-105 active:scale-95 ${
                      isTarget ? 'ring-2 ring-amber-500 rounded-full p-0.5' : ''
                    }`}
                    title={member.name}
                  >
                    <SafeAvatar src={member.avatar} name={member.name} className="w-9 h-9" />
                  </div>
                );
              })}
            </div>
            <span className="lg:hidden text-xs font-mono text-stone-450">{activeMembers.length} 位</span>
          </div>
        ) : (
          // Full Expanded View
          <div className="flex flex-col h-full overflow-hidden w-full">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-800/10 dark:border-stone-100/10">
              <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span>{visualMode === 'cabinet' ? (language === 'zh' ? '🏛️ 在列公卿' : '🏛️ Councillors') : (language === 'zh' ? '👥 参与成员' : '👥 Members')}</span>
                <span className="bg-amber-600/15 text-amber-500 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {activeMembers.length}
                </span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded hover:bg-stone-500/10 transition text-stone-500 hover:text-stone-300"
                title={visualMode === 'cabinet' ? (language === 'zh' ? '收起公卿列表' : 'Collapse Councillors') : (language === 'zh' ? '收起参审面板' : 'Collapse Sidebar')}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
              {activeMembers.map((member) => {
                const isTarget = targetMember?.id === member.id;
                return (
                  <div 
                    key={member.id}
                    onClick={() => handleToggleMention(member)}
                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2.5 ${
                      isTarget 
                        ? 'bg-amber-600/10 border-amber-600/60 text-stone-100 shadow'
                        : visualMode === 'cabinet'
                          ? theme === 'dark'
                            ? 'bg-[#221d18]/40 border-[#bca580]/15 text-[#eeddc5]/80 hover:bg-[#2c2620]'
                            : 'bg-white border-[#bca580]/30 text-stone-800 hover:bg-[#faf5eb]'
                          : theme === 'dark'
                            ? 'bg-[#202020] border-neutral-800 text-stone-300 hover:bg-[#282828]'
                            : 'bg-[#f7f7f8] border-neutral-200 text-stone-700 hover:bg-[#eef0f3]'
                    }`}
                    title={visualMode === 'cabinet' ? '单独传召/密谈' : '单独传召/密谈'}
                  >
                    <div className="relative shrink-0">
                      <SafeAvatar src={member.avatar} name={member.name} className="w-9 h-9" />
                      {isTarget && (
                        <div className="absolute -top-1 -right-1 bg-amber-600 text-amber-50 rounded-full p-0.5 border border-[#181512] animate-scaleIn">
                          <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold truncate">{member.nickname ? `${member.name}（${member.nickname}）` : member.name}</h4>
                      
                      <div className="flex items-center gap-1 mt-0.5">
                        {member.role !== 'none' && (
                          <span className="text-[9px] font-black bg-amber-600/20 text-amber-500 px-1 py-0.2 rounded border border-amber-600/10 font-sans">
                            {member.role === 'pm' ? '首辅' : '秘书长'}
                          </span>
                        )}
                        {member.ministry !== 'none' && (
                          <span className={`text-[9px] font-semibold px-1 py-0.2 rounded border font-sans ${
                            visualMode === 'cabinet'
                              ? 'bg-stone-500/10 border-[#c5a880]/20 text-[#c5a880]'
                              : 'bg-stone-500/10 border-neutral-800 text-stone-400'
                          }`}>
                            {visualMode === 'cabinet' 
                              ? (member.ministry === 'war' ? '兵部' 
                                 : member.ministry === 'works' ? '工部' 
                                 : member.ministry === 'rites' ? '礼部' 
                                 : member.ministry === 'revenue' ? '户部' 
                                 : member.ministry === 'punishments' ? '刑部' 
                                 : member.ministry === 'archive' ? '内史' : '吏部')
                              : member.ministry.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hint Box */}
            <div className={`mt-3 p-3 border rounded-xl text-[10px] sm:text-[11px] leading-relaxed font-sans ${
              visualMode === 'cabinet'
                ? 'bg-amber-600/5 border-[#bca580]/30 text-amber-700/80 dark:text-amber-500/80'
                : 'bg-stone-500/5 border-neutral-200 dark:border-neutral-800 text-stone-500'
            }`}>
              {visualMode === 'cabinet' ? (
                <span>帝居深宫，可于殿前群臣奏呈之旁勾选为<b>「准奏」</b>或<b>「驳回」</b>。选定之后再面谕点击下方<b>「群臣廷议」</b>。</span>
              ) : (
                <span>可在每条意见旁标记<b>「通过」</b>或<b>「驳回」</b>，然后点击下方<b>「继续讨论」</b>进入下一轮。</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Debate Panel */}
      <div
        id="main-debate-panel"
        className={`flex-1 min-h-0 border rounded-2xl overflow-hidden flex flex-col shadow-xl relative ${
          visualMode === 'cabinet'
            ? `animate-scroll-unfold ${
                theme === 'light'
                  ? 'bg-rice-paper text-[#1c120c] border-[#3d2b1f]'
                  : 'bg-rice-paper-dark text-[#eeddc5] border-[#4a2f1b]'
              }`
            : theme === 'dark'
              ? 'bg-[#0b0f19] border-[#1e293b] text-slate-100'
              : 'bg-white border-slate-250 text-slate-800'
        }`}
      >
        {/* Deco traditional imperial scroll wooden handles with golden brass endcaps */}
        {visualMode === 'cabinet' && (
          <>
            {/* Left Shaft */}
            <div className="absolute left-[-7px] top-[8%] bottom-[8%] w-2 bg-[#311c0c] border border-[#1e1005] rounded-full shadow-lg z-10 flex flex-col justify-between items-center py-0.5">
              <div className="w-3.5 h-3.5 bg-[#d4af37] border border-[#231505] rounded-full shrink-0 -translate-y-1"></div>
              <div className="w-3.5 h-3.5 bg-[#d4af37] border border-[#231505] rounded-full shrink-0 translate-y-1"></div>
            </div>
            {/* Right Shaft */}
            <div className="absolute right-[-7px] top-[8%] bottom-[8%] w-2 bg-[#311c0c] border border-[#1e1005] rounded-full shadow-lg z-10 flex flex-col justify-between items-center py-0.5">
              <div className="w-3.5 h-3.5 bg-[#d4af37] border border-[#231505] rounded-full shrink-0 -translate-y-1"></div>
              <div className="w-3.5 h-3.5 bg-[#d4af37] border border-[#231505] rounded-full shrink-0 translate-y-1"></div>
            </div>
          </>
        )}
        {/* Panel Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          visualMode === 'cabinet'
            ? theme === 'light'
              ? 'bg-[#dfce9e]/40 border-[#3d2b1f]'
              : 'bg-[#18130f] border-[#4a2f1b]'
            : theme === 'dark'
              ? 'bg-[#0e1322] border-[#1e293b]'
              : 'bg-slate-100 border-slate-250'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={onBack}
              className={`px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-1.5 cursor-pointer font-semibold ${
                visualMode === 'cabinet'
                  ? theme === 'dark'
                    ? 'bg-[#221d18] border-[#4b3524] text-[#eedbca] hover:bg-[#2c241c]'
                    : 'bg-[#f5e9ce] border-[#3d2b1f] text-stone-850 hover:bg-[#ecdcb9]'
                  : theme === 'dark'
                    ? 'bg-[#1b223c] hover:bg-[#232c4e] border-[#29355c] text-blue-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{visualMode === 'cabinet' ? '重设会话' : '重设会话'}</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <span>{visualMode === 'cabinet' ? '📜 圣裁诏书：' : '📋 会话：'}</span>
                <span className="truncate max-w-[120px] sm:max-w-md font-bold normal-case tracking-normal">
                  {title}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToColumns}
              className={`px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
                visualMode === 'cabinet'
                  ? theme === 'dark'
                    ? 'bg-[#221d18] border-[#4b3524] text-[#eedbca] hover:bg-[#2c241c]'
                    : 'bg-[#f5e9ce] border-[#3d2b1f] text-[#3d2b1f] hover:bg-[#ecdcb9]'
                  : theme === 'dark'
                    ? 'bg-[#1b223c] hover:bg-[#232c4e] border-[#29355c] text-blue-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-750'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>{visualMode === 'cabinet' ? '书案直列' : '书案直列'}</span>
            </button>
            <button
              onClick={onClear}
              className={`p-1.5 border border-transparent transition rounded-xl ${
                visualMode === 'cabinet'
                  ? 'text-stone-500 hover:text-red-500 hover:bg-[#221d18]/40'
                  : 'text-stone-500 hover:text-red-500 hover:bg-stone-500/10'
              }`}
              title={visualMode === 'cabinet' ? "清空阁臣奏章" : "清空记录"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Available rounds jump/display bar */}
        {availableRounds.length > 0 && (
          <div className={`px-4 py-2 flex items-center gap-2 border-b text-[11px] font-mono shrink-0 select-none shadow-sm ${
            visualMode === 'cabinet'
              ? theme === 'light'
                ? 'bg-[#f4ebd0] border-[#3d2b1f]/35 text-[#3d2b1f]'
                : 'bg-[#1c1611]/90 border-[#4a2f1b] text-[#eeddc5]'
              : theme === 'dark'
                ? 'bg-[#101524] border-[#1e293b] text-stone-300'
                : 'bg-stone-50 border-stone-200 text-stone-700'
          }`}>
            <span className="font-sans font-semibold shrink-0 text-stone-450">
              {language === 'zh' ? '🏛️ 快速折返辩驳轮次:' : '🏛️ 快速折返辩驳轮次:'}
            </span>
            <div className="flex flex-wrap gap-1.5 overflow-x-auto max-w-full pr-2">
              {availableRounds.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`round-divider-${r}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                  className={`px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider font-sans cursor-pointer transition-all duration-155 ${
                    visualMode === 'cabinet'
                      ? theme === 'dark'
                        ? 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-600/30'
                        : 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 border border-amber-600/40'
                      : theme === 'dark'
                        ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                        : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 border border-emerald-600/20'
                  }`}
                >
                  {language === 'zh' ? `第 ${r} 轮` : `第 ${r} 轮`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread Scroll Area */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 transition-colors duration-300 ${
          visualMode === 'cabinet'
            ? theme === 'dark'
              ? 'bg-[#151311] bg-[radial-gradient(#1e1a17_1px,transparent_1px)] bg-[size:16px_16px]'
              : 'bg-[#faf8f5] bg-[radial-gradient(#e6ded2_1px,transparent_1px)] bg-[size:16px_16px]'
            : theme === 'dark'
              ? 'bg-[#212121]'
              : 'bg-[#f7f7f8]'
        }`}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-stone-500">
              <Bot className="w-16 h-16 stroke-[1.1] text-amber-500/10 mb-3" />
              <p className="text-xs max-w-sm text-stone-505 leading-relaxed font-sans">
                {visualMode === 'cabinet'
                  ? '起草殿前上谕颁发，文臣武将即刻秉烛廷辩。下方的勾选按钮可以让您在下达批示前，先整理思绪。'
                  : '起草殿前上谕颁发，文臣武将即刻秉烛廷辩。勾选按钮可让您在下达批示前先整理思绪。'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((rawMsg) => {
                const msg = normalizeMessageForLanguage(rawMsg, uiLanguage);
                if (msg.isRoundDivider) {
                  return (
                    <div 
                      key={msg.id}
                      id={`round-divider-${msg.roundNumber}`}
                      className="w-full flex items-center justify-center py-4 my-2 animate-fadeIn relative scroll-mt-6"
                    >
                      <div className="absolute left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#bca580]/30 to-transparent top-1/2 -translate-y-1/2"></div>
                      
                      <div className={`relative px-6 py-2 rounded-full border text-center font-bold text-xs sm:text-sm tracking-widest shadow-lg flex items-center gap-2.5 z-10 ${
                        visualMode === 'cabinet'
                          ? theme === 'dark'
                            ? 'bg-[#251b11] border-[#8a6a42]/70 text-[#f1ebd9] shadow-[#090502]'
                            : 'bg-[#faf3e3] border-[#d6af66] text-[#2c1a0c] shadow-[#f0e8d0]'
                          : theme === 'dark'
                            ? 'bg-[#181d30] border-slate-800 text-slate-200'
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                      }`}>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span>{msg.content}</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      </div>
                    </div>
                  );
                }

                const isUserMsg = msg.isUser;
                const activeStance = msgStances[msg.id];
                
                return (
                  <div 
                    key={msg.id}
                    className={`flex gap-3 max-w-4xl agent-enter group relative ${
                      isUserMsg ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div className="shrink-0">
                      <SafeAvatar
                        src={msg.avatar}
                        name={msg.sender}
                        providerId={members.find(m => m.id === msg.ministerId)?.providerId}
                        className="w-10 h-10 border border-[#bca580]/20"
                      />
                    </div>
                    
                    <div className={`space-y-1.5 max-w-[85%] ${isUserMsg ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 ${isUserMsg ? 'flex-row-reverse' : ''}`}>
                        <span className={`text-xs font-black tracking-wide ${
                          visualMode === 'cabinet'
                            ? theme === 'dark' ? 'text-[#f0e4cc]' : 'text-[#251c11]'
                            : theme === 'dark' ? 'text-stone-200' : 'text-stone-850'
                        }`}>
                          {msg.sender}
                        </span>
                        
                        {msg.roleLabel && (
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.2 rounded-full uppercase border ${
                            isUserMsg 
                              ? 'bg-amber-600/10 text-amber-500 border-amber-600/20' 
                              : msg.roleLabel === '内阁' || msg.roleLabel === '领衔首辅' || msg.roleLabel === 'MODERATOR'
                                ? 'bg-red-950/20 text-red-550 border-red-950/40'
                                : 'bg-stone-800 border-stone-700 text-stone-400 font-sans'
                          }`}>
                            {msg.roleLabel}
                          </span>
                        )}

                        {/* Discreet Timestamp display showing up beautifully on hover next to sender info */}
                        <span className={`text-[10px] font-mono opacity-0 group-hover:opacity-60 transition-all duration-300 flex items-center gap-1 cursor-default select-none pointer-events-none ${
                          theme === 'dark' ? 'text-stone-450' : 'text-stone-500'
                        }`} title={language === 'zh' ? '宣呈时间' : 'Submission time'}>
                          <Clock className="w-2.5 h-2.5 opacity-70" />
                          <span>
                            {getStableTimeOfMessage(msg, uiLanguage, visualMode)}
                          </span>
                        </span>
                      </div>

                      {/* Content Card with customized Font Sizes and aesthetic borders & subtle hover utility */}
                      <div className="relative">
                        <div className={`p-4 rounded-2xl ${fontClass} transition-all duration-200 ${
                          isUserMsg 
                            ? visualMode === 'cabinet'
                              ? theme === 'dark'
                                ? 'bg-[#291e13] border border-amber-600/40 rounded-tr-sm text-[#ecd9bc] shadow-md shadow-[#110101]'
                                : 'bg-[#faf2df] border border-[#d6af66] rounded-tr-sm text-stone-900 shadow-sm shadow-[#eeddc5]'
                              : theme === 'dark'
                                ? 'bg-[#2f2f2f] text-stone-105 rounded-tr-sm'
                                : 'bg-white border border-neutral-250 text-stone-900 rounded-tr-sm shadow-sm'
                            : activeStance === 'approve'
                              ? 'bg-emerald-600/5 border border-emerald-500 text-emerald-100 rounded-tl-sm shadow-md'
                              : activeStance === 'reject'
                                ? 'bg-rose-600/5 border border-rose-500 text-rose-100 rounded-tl-sm shadow-md'
                                : visualMode === 'cabinet'
                                  ? theme === 'dark'
                                    ? 'bg-[#1a1715] border border-[#c5a880]/15 rounded-tl-sm text-[#ebd9bc] hover:border-[#c5a880]/30 shadow-sm'
                                    : 'bg-white border border-[#bca580]/30 rounded-tl-sm text-[#2c1a0c] hover:border-[#bca580]/50 shadow-sm'
                                  : theme === 'dark'
                                    ? 'bg-[#202020] border border-neutral-800 rounded-tl-sm text-stone-200'
                                    : 'bg-white border border-neutral-200 rounded-tl-sm text-stone-850'
                        }`}>
                          <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                        </div>

                        {/* Subtle Hover Action Widget (with timestamp copy, backdrop blurred, responsive hover transition) */}
                        <div className={`absolute -top-3.5 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 select-none hover:-translate-y-0.5 ${
                          visualMode === 'cabinet'
                            ? theme === 'dark'
                              ? 'bg-[#1e150d] border-[#8a6a42]/60 text-[#cbd0c8] shadow-black/80'
                              : 'bg-[#faf6eb] border-[#d6af66]/80 text-[#2c1a0c] shadow-amber-950/15'
                            : theme === 'dark'
                              ? 'bg-[#1c1c1e] border-neutral-800 text-stone-200 shadow-black'
                              : 'bg-white border-neutral-250 text-stone-850 shadow-stone-200/60'
                        }`}>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60 shrink-0" />
                            <span className="font-mono text-[9px] tracking-wider opacity-85">
                              {getStableTimeOfMessage(msg, uiLanguage, visualMode)}
                            </span>
                          </div>
                          
                          <div className={`w-[1px] h-3.5 shrink-0 my-0.5 ${
                            visualMode === 'cabinet'
                              ? theme === 'dark' ? 'bg-[#c5a880]/20' : 'bg-[#bca580]/30'
                              : theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'
                          }`}></div>

                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content, msg.id)}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded transition-all duration-200 hover:scale-[1.03] text-[9px] font-mono font-bold tracking-wider uppercase cursor-pointer ${
                              copiedId === msg.id 
                                ? 'text-emerald-500 font-black' 
                                : visualMode === 'cabinet' && theme === 'dark'
                                  ? 'text-[#ebd9bc]/90 hover:text-amber-400'
                                  : 'text-stone-500 hover:text-amber-500'
                            }`}
                            title={language === 'zh' ? '复制文本' : '复制文本'}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-2.5 h-2.5 stroke-[3] text-emerald-500" />
                                <span>{language === 'zh' ? '已复制' : '已复制'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" />
                                <span>{language === 'zh' ? '复制' : '复制'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Multiselection actions at card footer (ONLY FOR CABINET AGENT RESPONSES) */}
                      {!isUserMsg && msg.sender !== '朕 (圣上)' && (
                        <div className={`flex items-center gap-2 pt-1 text-[11px] font-sans ${
                          isUserMsg ? 'justify-end' : 'justify-start pl-1'
                        }`}>
                          <button
                            type="button"
                            onClick={() => handleToggleMessageStance(msg.id, 'approve')}
                            disabled={isGenerating}
                            className={`px-3 py-1 rounded-lg border transition-all duration-200 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              activeStance === 'approve'
                                ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-400 font-bold shadow-md shadow-emerald-950/20 animate-scaleIn'
                                : visualMode === 'cabinet'
                                  ? theme === 'dark'
                                    ? 'bg-[#221d18] border-[#c0a680]/20 text-[#edd9bc]/85 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-950/20'
                                    : 'bg-white border-[#bca580]/30 text-stone-600 hover:text-emerald-600 hover:border-emerald-600/35 hover:bg-emerald-50/20'
                                  : theme === 'dark'
                                    ? 'bg-[#2a2a2a] border-neutral-800 text-stone-400 hover:text-emerald-400 hover:bg-emerald-955/20'
                                    : 'bg-white border-neutral-250 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50/30'
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${activeStance === 'approve' ? 'stroke-[3]' : ''}`} />
                            <span>{visualMode === 'cabinet' ? '准奏' : '通过'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleMessageStance(msg.id, 'reject')}
                            disabled={isGenerating}
                            className={`px-3 py-1 rounded-lg border transition-all duration-200 flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              activeStance === 'reject'
                                ? 'bg-rose-600/20 border-rose-500/80 text-rose-400 font-bold shadow-md shadow-rose-950/20 animate-scaleIn'
                                : visualMode === 'cabinet'
                                  ? theme === 'dark'
                                    ? 'bg-[#221d18] border-[#c0a680]/20 text-[#edd9bc]/85 hover:text-rose-450 hover:border-rose-500/40 hover:bg-rose-950/20'
                                    : 'bg-white border-[#bca580]/30 text-stone-600 hover:text-rose-600 hover:border-rose-600/35 hover:bg-rose-50/20'
                                  : theme === 'dark'
                                    ? 'bg-[#2a2a2a] border-neutral-800 text-stone-400 hover:text-rose-400 hover:bg-rose-955/20'
                                    : 'bg-white border-neutral-250 text-stone-500 hover:text-rose-600 hover:bg-rose-50/30'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span>{visualMode === 'cabinet' ? '驳回' : '驳回'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isGenerating && (
            <div className="flex gap-3 max-w-lg mr-auto animate-pulse">
              <div className="w-10 h-10 rounded-full flex items-center justify-center border border-[#bca580]/20 bg-[#c5a880]/5 shrink-0">
                <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
              </div>
              <div className="space-y-1.5 flex-1 font-sans">
                <span className="text-[10px] font-mono text-amber-500 tracking-wider font-semibold">
                  {visualMode === 'cabinet' ? '阁臣领旨审度应对中...' : '成员思考中...'}
                </span>
                <div className={`p-4 rounded-xl border rounded-tl-sm text-xs leading-relaxed shadow-sm ${
                  visualMode === 'cabinet'
                    ? theme === 'dark' ? 'bg-[#1a1715] border-[#c5a880]/15 text-[#eeddc5]' : 'bg-white border-[#bca580]/30 text-stone-600'
                    : theme === 'dark' ? 'bg-[#202020] border-[#2f2f2f] text-stone-400' : 'bg-white border-neutral-250 text-stone-500'
                }`}>
                  <span className="inline-flex gap-1 py-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className={`p-4 border-t shrink-0 space-y-3 ${
          visualMode === 'cabinet'
            ? theme === 'dark' ? 'bg-[#1a1715] border-[#c0a680]/15' : 'bg-[#fcfaf7] border-[#bca580]/35'
            : theme === 'dark' ? 'bg-[#212121] border-[#2f2f2f]' : 'bg-[#ffffff] border-[#e5e5e5]'
        }`}>
          
          {/* Targeted state notification */}
          {targetMember && (
            <div className="p-2 border rounded-xl text-[10px] sm:text-[11px] font-mono flex items-center justify-between animate-fadeIn bg-amber-600/5 border-amber-600/30 text-amber-600">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {visualMode === 'cabinet'
                    ? `【密传诏令】正在传召公卿阁臣 【${targetMember.name}】 听候密旨单独对答。`
                    : `【私聊】正在联系成员 【${targetMember.name}】 进行单独对话。`}
                </span>
              </span>
              <button type="button" onClick={() => setTargetMember(undefined)} className="hover:text-stone-300 text-stone-500 font-bold px-1.5 text-xs">×</button>
            </div>
          )}

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 animate-fadeIn">
              {attachedFiles.map((f, i) => (
                <div key={i} className="px-2.5 py-1 border rounded-lg text-[10px] font-mono flex items-center gap-1.5 bg-[#c5a880]/5 border-[#bca580]/30 text-stone-400">
                  <FileText className="w-3 h-3 text-amber-500" />
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-stone-550 hover:text-stone-300 ml-1">×</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 font-sans">
            <div className="relative flex items-center">
              
              {/* Attachment Plus button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute left-3 p-1.5 rounded-xl transition cursor-pointer text-stone-550 ${
                  visualMode === 'cabinet' ? 'hover:bg-[#c5a880]/10' : 'hover:bg-stone-500/15'
                }`}
                title={visualMode === 'cabinet' ? '挂载奏章文献' : 'Attach context document'}
              >
                <Plus className="w-4 h-4 stroke-[3] text-amber-500" />
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUploadSimulate} 
                className="hidden" 
                multiple
              />

              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={isGenerating}
                placeholder={
                  targetMember
                    ? (visualMode === 'cabinet' ? `起草下传阁臣 【${targetMember.name}】 密旨...` : `发送给成员 【${targetMember.name}】...`)
                    : (visualMode === 'cabinet' ? '宣召朱笔御批诏书，着群相阁僚通盘陈词答对...' : '输入议题，让各成员展开讨论...')
                }
                rows={1}
                className={`w-full text-xs rounded-2xl py-3 pl-10 pr-12 transition-all leading-relaxed shadow-inner border font-serif ${
                  visualMode === 'cabinet'
                    ? theme === 'dark'
                      ? 'bg-[#13110f] border-[#c5a880]/25 text-[#ecd9bc] placeholder-stone-600 focus:border-amber-600'
                      : 'bg-[#faf8f5] border-[#bca580]/40 text-[#2c1d0c] placeholder-stone-450 focus:border-amber-600'
                    : theme === 'dark'
                      ? 'bg-[#2f2f2f] border-[#3f3f3f] text-stone-100 placeholder-stone-500 focus:border-emerald-600'
                      : 'bg-[#ffffff] border-neutral-250 text-stone-855 placeholder-stone-400 focus:border-emerald-600'
                }`}
                style={{ minHeight: '64px', maxHeight: '160px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim()) handleSubmit(e);
                  }
                }}
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isGenerating}
                className={`absolute right-3.5 p-1.5 rounded-xl text-stone-950 disabled:bg-stone-850 disabled:text-stone-500 transition-all cursor-pointer shadow-md hover:scale-105 ${
                  visualMode === 'cabinet'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Bottom Debate/Decisions triggers */}
            <div className="flex flex-col md:flex-row gap-3 font-mono items-center w-full">

              {/* Debate Trigger */}
              <button
                type="button"
                onClick={handleGroupDebateTrigger}
                disabled={isGenerating || messages.length === 0}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full ${
                  visualMode === 'cabinet'
                    ? theme === 'dark'
                      ? 'bg-[#221d18] border-[#c0a680]/30 text-[#ecd9bc] hover:bg-amber-600/5 hover:border-amber-600/50'
                      : 'bg-white border-[#bca580]/55 text-stone-850 hover:bg-[#faf5eb]'
                    : theme === 'dark'
                      ? 'bg-[#2f2f2f] hover:bg-[#383838] border-[#3f3f3f] text-stone-300'
                      : 'bg-[#f7f7f8] hover:bg-[#eef0f5] border-stone-200 text-stone-700'
                }`}
                title={visualMode === 'cabinet' ? '群臣起议继续辩驳下一轮' : 'Deploy consensus model simulation next round'}
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
                <span>
                  {visualMode === 'cabinet'
                    ? language === 'zh'
                      ? Object.keys(msgStances).length > 0 ? `批拟其案 (继续下轮廷议)` : '继续廷议 (下一轮)'
                      : Object.keys(msgStances).length > 0 ? `Decree & Debate (Next Round)` : 'Continue Debate (Next Round)'
                    : language === 'zh'
                      ? Object.keys(msgStances).length > 0 ? `裁定提议 (开展次轮辩论)` : '继续辩驳 (下一轮)'
                      : Object.keys(msgStances).length > 0 ? `Decree (Continue Debate)` : 'Continue Debate (Next Round)'}
                </span>
              </button>

              {/* Stop Thinking Button */}
              {isGenerating && (
                <button
                  type="button"
                  onClick={onStopThinking}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full ${
                    visualMode === 'cabinet'
                      ? theme === 'dark'
                        ? 'bg-[#221d18] border-[#c0a680]/30 text-[#ecd9bc] hover:bg-rose-600/10 hover:border-rose-600/50'
                        : 'bg-white border-[#bca580]/55 text-stone-850 hover:bg-rose-50'
                      : theme === 'dark'
                        ? 'bg-[#2f2f2f] hover:bg-[#383838] border-[#3f3f3f] text-stone-300'
                        : 'bg-[#f7f7f8] hover:bg-[#eef0f5] border-stone-200 text-stone-700'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
                  <span>{language === 'zh' ? '暂停思考' : 'Stop Thinking'}</span>
                </button>
              )}

              <button
                type="button"
                className={`flex-1 px-5 py-2.5 rounded-xl font-extrabold tracking-wider text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:scale-[1.01] w-full ${
                  visualMode === 'cabinet'
                    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                    : 'bg-stone-900 border border-[#3f3f3f] hover:bg-[#2c2c2c] text-white'
                }`}
                disabled={messages.length === 0}
                onClick={onOpenVerdict}
              >
                <Gavel className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {visualMode === 'cabinet'
                    ? language === 'zh' ? '圣裁' : '圣裁'
                    : language === 'zh' ? '定案' : 'Verdict'}
                </span>
              </button>

              {/* Auto Debate Button */}
              {onOpenAutoDebate && (
                <button
                  type="button"
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    visualMode === 'cabinet'
                      ? theme === 'dark'
                        ? 'bg-[#221d18] border-[#c0a680]/30 text-[#ecd9bc] hover:bg-amber-600/10 hover:border-amber-600/50 border'
                        : 'bg-white border-[#bca580]/55 text-stone-850 hover:bg-[#faf5eb] border'
                      : theme === 'dark'
                        ? 'bg-[#2f2f2f] hover:bg-[#383838] border-[#3f3f3f] text-stone-300 border'
                        : 'bg-[#f7f7f8] hover:bg-[#eef0f5] border-stone-200 text-stone-700 border'
                  }`}
                  onClick={onOpenAutoDebate}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span>{language === 'zh' ? '自动辩驳' : 'Auto Debate'}</span>
                </button>
              )}
            </div>

          </form>
        </div>

      </div>

    </div>
  );
};
