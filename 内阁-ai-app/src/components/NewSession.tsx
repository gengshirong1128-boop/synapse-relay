/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CabinetMember, VisualModeType } from '../types';
import {
  PlusCircle, ArrowLeft, ArrowRight, MessageSquare,
  Users, Check, UserCheck, Cpu, Terminal, Sparkles
} from 'lucide-react';
import { SafeAvatar } from './SafeAvatar';

interface NewSessionProps {
  onBack: () => void;
  onStartSession: (
    title: string,
    prompt: string,
    sessionMode: 'private' | 'meeting',
    chosenMembers: CabinetMember[]
  ) => void;
  visualMode: VisualModeType;
  availableMembersPreset: CabinetMember[];
  theme?: 'light' | 'dark';
}

export const NewSession: React.FC<NewSessionProps> = ({
  onBack,
  onStartSession,
  visualMode,
  availableMembersPreset,
  theme = 'dark'
}) => {
  const [step, setStep] = useState<'mode' | 'members' | 'topic'>('mode');
  const [sessionMode, setSessionMode] = useState<'private' | 'meeting'>('meeting');
  const [localMembers, setLocalMembers] = useState<CabinetMember[]>(
    availableMembersPreset.map(m => ({ ...m, selected: false }))
  );

  const [customTitle, setCustomTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  const isLight = theme === 'light' && visualMode === 'un';
  const isZh = true; // UI language handled by parent

  const autoAllocatePositions = (selected: CabinetMember[], mode: 'private' | 'meeting'): CabinetMember[] => {
    if (mode === 'private') {
      return selected.map(s => ({ ...s, role: 'none' as const, ministry: 'none' as const }));
    }
    let hostIdx = selected.findIndex(s => s.role === 'pm' || s.role === 'sg');
    if (hostIdx === -1) hostIdx = 0;
    const cabMinistries: Array<CabinetMember['ministry']> = ['personnel', 'rites', 'works', 'war', 'punishments', 'revenue', 'archive'];
    return selected.map((member, index) => {
      const isHost = index === hostIdx;
      const role: 'pm' | 'sg' | 'none' = isHost ? (visualMode === 'cabinet' ? 'pm' : 'sg') : 'none';
      let ministry: CabinetMember['ministry'] = 'none';
      if (!isHost) ministry = cabMinistries[index % cabMinistries.length];
      return { ...member, role, ministry };
    });
  };

  const handleToggleMember = (id: string) => {
    setLocalMembers(prev => prev.map(m => {
      if (m.id === id) {
        if (sessionMode === 'private') return { ...m, selected: true };
        return { ...m, selected: !m.selected };
      }
      if (sessionMode === 'private') return { ...m, selected: false };
      return m;
    }));
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customTitle.trim() || customPrompt.trim().slice(0, 20);
    if (!customPrompt.trim()) return;
    const selectedList = localMembers.filter(m => m.selected);
    const finalMembers = autoAllocatePositions(selectedList, sessionMode);
    onStartSession(title, customPrompt.trim(), sessionMode, finalMembers);
  };

  const selectedCount = localMembers.filter(m => m.selected).length;
  const minRequired = sessionMode === 'private' ? 1 : 2;
  const canStart = selectedCount >= minRequired && customPrompt.trim().length > 0;

  return (
    <div className={`w-full h-full flex flex-col py-4 px-5 animate-fadeIn font-sans ${isLight ? 'text-stone-800' : 'text-stone-100'}`}>

      {/* Header */}
      <div className="text-center shrink-0 mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-600/10 text-amber-500 border border-amber-600/20 text-[10px] font-semibold tracking-wider uppercase mb-2">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
          {step === 'mode' ? '选择会话模式' : step === 'members' ? '遴选阁臣' : '拟诏议题'}
        </div>
        <h1 className={`text-2xl font-extrabold tracking-tight font-display ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>
          {visualMode === 'cabinet' ? '📜 开辟新廷本' : '👥 新建群臣会商'}
        </h1>
      </div>

      {/* STEP 1: MODE SELECTOR */}
      {step === 'mode' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl w-full">

            {/* Private Chat */}
            <div
              onClick={() => {
                setSessionMode('private');
                setLocalMembers(prev => prev.map((m, i) => ({ ...m, selected: i === 0 })));
                setStep('topic');
              }}
              className={`p-6 border rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between h-48 shadow-md hover:shadow-lg ${
                isLight ? 'bg-white border-stone-200 hover:border-amber-600' : 'bg-stone-900 border-stone-800 hover:border-amber-600/40'
              }`}
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center text-[#10a37f] mb-4 group-hover:scale-105 transition-all">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className={`text-sm font-bold font-display mb-2 group-hover:text-amber-500 transition-colors ${isLight ? 'text-stone-800' : 'text-stone-100'}`}>
                  💬 私聊密谈模式
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                  单独传召一位阁臣进行一对一深谈。
                </p>
              </div>
              <span className="text-[10px] text-amber-500 font-mono tracking-wider font-semibold block">进入私聊 ➔</span>
            </div>

            {/* Meeting */}
            <div
              onClick={() => {
                setSessionMode('meeting');
                setLocalMembers(prev => prev.map(m => ({ ...m, selected: ['model-chatgpt', 'model-claude', 'model-deepseek'].includes(m.id) })));
                setStep('topic');
              }}
              className={`p-6 border rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between h-48 shadow-md hover:shadow-lg ${
                isLight ? 'bg-white border-stone-200 hover:border-amber-600' : 'bg-stone-900 border-stone-800 hover:border-amber-600/40'
              }`}
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center text-amber-500 mb-4 group-hover:scale-105 transition-all">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className={`text-sm font-bold font-display mb-2 group-hover:text-amber-500 transition-colors ${isLight ? 'text-stone-800' : 'text-stone-100'}`}>
                  🏛️ 群聊廷议模式
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                  委命多位阁臣，分配六部职位，进行多轮廷议辩析。
                </p>
              </div>
              <span className="text-[10px] text-amber-500 font-mono tracking-wider font-semibold block">进入群聊 ➔</span>
            </div>

          </div>
        </div>
      )}

      {/* STEP 2: MEMBER SELECTION (only for custom mode adjustment) */}
      {step === 'members' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center justify-between pb-2 border-b shrink-0 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
            <button onClick={() => setStep('topic')} className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer font-semibold ${isLight ? 'bg-white hover:bg-stone-50 border-stone-200' : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-400'}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> 返回
            </button>
            <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              已选 <strong className="text-amber-500">{selectedCount}</strong> 位
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {localMembers.filter(m => m.type === 'model').map(m => (
              <div key={m.id} onClick={() => handleToggleMember(m.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 ${m.selected ? 'bg-amber-600/5 border-amber-600' : isLight ? 'bg-white border-stone-200' : 'bg-stone-900/40 border-stone-800'}`}>
                <SafeAvatar src={m.avatar} name={m.name} className="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{m.name}</div>
                  <div className="text-[10px] text-stone-500">{m.badge}</div>
                </div>
                {m.selected && <Check className="w-5 h-5 text-amber-500" />}
              </div>
            ))}
            {localMembers.filter(m => m.type !== 'model').map(m => (
              <div key={m.id} onClick={() => handleToggleMember(m.id)} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 ${m.selected ? 'bg-amber-600/5 border-amber-600' : isLight ? 'bg-white border-stone-200' : 'bg-stone-900/40 border-stone-800'}`}>
                <SafeAvatar src={m.avatar} name={m.name} className="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{m.name}</div>
                  <div className="text-[10px] text-stone-500">{m.badge}</div>
                </div>
                {m.selected && <Check className="w-5 h-5 text-amber-500" />}
              </div>
            ))}
          </div>
          <div className="pt-2 shrink-0">
            <button onClick={() => setStep('topic')} className="w-full px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold cursor-pointer">确认选择</button>
          </div>
        </div>
      )}

      {/* STEP 3 / Direct-to: TOPIC & CUSTOM INPUT */}
      {step === 'topic' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center justify-between pb-2 border-b shrink-0 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
            <button onClick={() => { setStep('mode'); setCustomTitle(''); setCustomPrompt(''); }} className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer font-semibold ${isLight ? 'bg-white hover:bg-stone-50 border-stone-200' : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-400'}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> 返回模式选择
            </button>
            <button onClick={() => setStep('members')} className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer font-semibold ${isLight ? 'bg-white hover:bg-stone-50 border-stone-200' : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-400'}`}>
              遴选大臣 ({selectedCount})
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-stone-500">
              ✒️ 自定义会审议题
            </h4>

            <div className={`border rounded-2xl p-5 space-y-4 shadow ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
              <div>
                <label className="block text-[10px] font-mono mb-1.5 uppercase tracking-wider text-stone-500">廷议标题</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder="例：关于塞外诸部互市之税额议事录"
                  className={`w-full text-xs rounded-xl p-3 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition ${isLight ? 'bg-stone-50 border border-stone-200 text-stone-800' : 'bg-stone-950 border border-stone-800 text-stone-100'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono mb-1.5 uppercase tracking-wider text-stone-500">圣谕/询问内容 *</label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  rows={5}
                  placeholder="在此书写圣上旨意或敕令课题..."
                  className={`w-full text-xs rounded-xl p-3 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition resize-none leading-relaxed ${isLight ? 'bg-stone-50 border border-stone-200 text-stone-800' : 'bg-stone-950 border border-stone-800 text-stone-100'}`}
                />
              </div>

              {!canStart && customPrompt.trim() === '' && selectedCount >= minRequired && (
                <p className="text-[10px] text-rose-500">⚠️ 请输入廷议内容</p>
              )}
              {sessionMode === 'meeting' && selectedCount < 2 && (
                <p className="text-[10px] text-rose-500">⚠️ 群聊模式至少需要选择 2 位大臣</p>
              )}
              {sessionMode === 'private' && selectedCount !== 1 && (
                <p className="text-[10px] text-rose-500">⚠️ 私聊模式只能选择 1 位大臣</p>
              )}

              <button
                onClick={handleSubmitCustom}
                disabled={!canStart}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  canStart
                    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 border-amber-600 hover:scale-[1.01] active:scale-[0.99] shadow-md'
                    : 'bg-stone-800 text-stone-500 border-transparent cursor-not-allowed opacity-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>钦命首辅：开朝廷议！</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
