/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CabinetMember } from '../types';
import { Check, Cpu, Hammer, Plus, Edit2, Trash2, X } from 'lucide-react';
import { SafeAvatar } from './SafeAvatar';
import { DEFAULT_SKILLS, getSkillById, MINISTRY_SKILLS } from '../skills';
import { getAvatarInitial } from '../providerAvatars';

interface CabinetSelectionProps {
  members: CabinetMember[];
  onToggleUser: (id: string) => void;
  onUpdateRole: (id: string, role: 'pm' | 'sg' | 'none') => void;
  onUpdateMinistry: (id: string, ministry: CabinetMember['ministry']) => void;
  onAddMember?: (member: CabinetMember) => void;
  onUpdateMember?: (id: string, patch: Partial<CabinetMember>) => void;
  onDeleteMember?: (id: string) => void;
  onContinue: () => void;
  visualMode: 'cabinet' | 'un';
  theme?: 'light' | 'dark';
}

export const CabinetSelection: React.FC<CabinetSelectionProps> = ({
  members,
  onToggleUser,
  onUpdateRole,
  onUpdateMinistry,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onContinue,
  visualMode,
  theme = 'dark'
}) => {
  const models = members.filter(m => m.type === 'model');
  const tools = members.filter(m => m.type === 'tool' || m.type === 'custom');

  const activeCount = members.filter(m => m.selected).length;
  const isLight = theme === 'light' && visualMode === 'un';

  // Minister form modal state
  const [showMinisterForm, setShowMinisterForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [ministerForm, setMinisterForm] = useState<Partial<CabinetMember>>({});

  const openAddForm = () => {
    setEditingMemberId(null);
    setMinisterForm({
      name: '', nickname: '', type: 'custom', avatar: '',
      ministry: 'none', role: 'none', skillId: 'skill_general_reasoning',
      providerId: '', modelId: '',
    });
    setShowMinisterForm(true);
  };

  const openEditForm = (member: CabinetMember) => {
    setEditingMemberId(member.id);
    setMinisterForm({ ...member });
    setShowMinisterForm(true);
  };

  const saveMinister = () => {
    if (!ministerForm.name) return;
    const form = ministerForm as CabinetMember;
    if (editingMemberId) {
      onUpdateMember?.(editingMemberId, form);
    } else {
      const newMember: CabinetMember = {
        id: `member_${Date.now()}`,
        name: form.name || '',
        nickname: form.nickname || '',
        avatar: form.avatar || '',
        type: form.type || 'custom',
        selected: true,
        role: form.role || 'none',
        ministry: form.ministry || 'none',
        badge: form.badge || '自定义',
        skillId: form.skillId || 'skill_general_reasoning',
        providerId: form.providerId || '',
        modelId: form.modelId || '',
        localToolId: form.localToolId || '',
        avatarType: 'provider',
        isDefault: false,
        desc: form.desc || '',
      };
      onAddMember?.(newMember);
    }
    setShowMinisterForm(false);
  };

  const memberDisplayName = (m: CabinetMember) => {
    if (m.nickname) return `${m.name}（${m.nickname}）`;
    return m.name;
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 animate-fadeIn">
      {/* Header section with theme-specific typography */}
      <div className="mb-12 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-600/10 text-amber-500 border border-amber-600/20 text-[10px] font-semibold tracking-wider uppercase mb-4">
          <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></span>
          {visualMode === 'cabinet' ? '机要内阁・就位就绪' : '内阁机要・系统就绪'}
        </div>
        <h1 className={`text-3xl font-bold tracking-tight font-display mb-3 ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>
          {visualMode === 'cabinet' ? '🏛️ 帝制内阁成员遴选' : '🏛️ 智能内阁成员遴选'}
        </h1>
        <p className={`text-sm max-w-2xl leading-relaxed ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
          {visualMode === 'cabinet' 
            ? '从通用推理模型及本地特定工部工具中，遴选群臣入阁。指定首辅大臣与阁臣归属，拟定帝制决策的核心廷议阵容。'
            : '从通用推理模型及本地执行工具中，遴选群臣入阁。指定首辅大臣与阁臣归属，拟定核心廷议阵容。'}
        </p>
      </div>

      {/* Grid of AI Models */}
      <div className="mb-10">
        <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
          <Cpu className="w-5 h-5 text-amber-500" />
          <h2 className={`text-lg font-semibold tracking-tight font-display ${isLight ? 'text-stone-805' : 'text-stone-200'}`}>
            {visualMode === 'cabinet' ? '备选 AI 大模型 (阁臣/议政官员)' : '备选 AI 大模型 (内阁大臣)'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((member) => (
            <div 
              key={member.id}
              className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                member.selected 
                  ? isLight
                    ? 'bg-white border-amber-600 shadow-md shadow-amber-600/5 text-stone-900'
                    : 'bg-stone-900/95 border-amber-600/40 shadow-md shadow-stone-950/10 text-stone-200' 
                  : isLight
                    ? 'bg-stone-50/60 border-stone-100 hover:border-stone-200 text-stone-700'
                    : 'bg-stone-950/40 border-stone-800/80 hover:border-stone-700 text-stone-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <SafeAvatar
                    src={member.avatar}
                    name={member.name}
                    providerId={member.providerId}
                    className={`w-12 h-12 rounded-lg object-cover transition-all ${member.selected ? 'brightness-110' : 'opacity-65 grayscale'}`}
                  />
                  {member.selected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-stone-950 rounded-full p-0.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className={`font-bold text-sm truncate ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{memberDisplayName(member)}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditForm(member); }}
                        className="p-1 rounded text-stone-500 hover:text-amber-500 transition cursor-pointer"
                        title="编辑大臣"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!member.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('确定要移除此大臣吗？')) onDeleteMember?.(member.id); }}
                          className="p-1 rounded text-stone-500 hover:text-rose-500 transition cursor-pointer"
                          title="删除大臣"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${
                        isLight
                          ? 'bg-stone-100 border-stone-200 text-stone-600'
                          : 'bg-stone-900 border-stone-800 text-amber-300'
                      }`}>
                        {member.badge}
                      </span>
                    </div>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed mb-3 ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                    {member.desc || '通用高级多模态及推理辅助，提供军机策论的深度见解。'}
                  </p>
                </div>
              </div>

              {/* Roles controls */}
              <div className={`mt-2 pt-3 border-t flex flex-wrap items-center gap-2 ${isLight ? 'border-stone-200' : 'border-stone-800/80'}`}>
                <button
                  onClick={() => onToggleUser(member.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    member.selected 
                      ? 'bg-amber-600/15 text-amber-655 border border-amber-600/35 hover:bg-amber-600/25' 
                      : isLight 
                        ? 'bg-white text-stone-600 border border-stone-200 hover:text-stone-800 hover:bg-stone-50' 
                        : 'bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-250 hover:bg-stone-800'
                  }`}
                >
                  {member.selected ? (visualMode === 'cabinet' ? '解任' : '解任') : (visualMode === 'cabinet' ? '起复/入阁' : '起复/入阁')}
                </button>

                {member.selected && (
                  <>
                    {/* Role selector */}
                    <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-900 border-stone-800 text-stone-200'
                    }`}>
                      <span className="text-stone-400 font-mono text-[10px]">职务:</span>
                      <select
                        value={member.role}
                        onChange={(e) => onUpdateRole(member.id, e.target.value as any)}
                        className={`bg-transparent focus:outline-none cursor-pointer font-semibold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}
                      >
                        <option value="none" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>无职务</option>
                        {visualMode === 'cabinet' ? (
                          <option value="pm" className={isLight ? 'bg-white text-[#d4af37]' : 'bg-stone-900 text-amber-300'}>首辅大臣</option>
                        ) : (
                          <option value="sg" className={isLight ? 'bg-white text-[#10a37f]' : 'bg-stone-900 text-teal-300'}>领衔首辅</option>
                        )}
                      </select>
                    </div>

                    {/* Ministry selector */}
                    <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-900 border-stone-800'
                    }`}>
                      <span className="text-stone-400 font-mono text-[10px]">六部归属:</span>
                      <select
                        value={member.ministry}
                        onChange={(e) => onUpdateMinistry(member.id, e.target.value as any)}
                        className={`bg-transparent focus:outline-none cursor-pointer font-semibold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}
                      >
                        <option value="none" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>无归属</option>
                        {visualMode === 'cabinet' ? (
                          <>
                            <option value="rites" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>礼部 (朝仪礼典)</option>
                            <option value="personnel" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>吏部 (官吏廷推)</option>
                            <option value="revenue" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>户部 (钱粮地赋)</option>
                            <option value="war" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>兵部 (军政征防)</option>
                            <option value="works" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>工部 (土木水利)</option>
                            <option value="punishments" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>刑部 (秋审谳狱)</option>
                          </>
                        ) : (
                          <>
                            <option value="rites" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>礼部 (朝仪礼典)</option>
                            <option value="personnel" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>吏部 (官吏廷推)</option>
                            <option value="revenue" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>户部 (钱粮地赋)</option>
                            <option value="war" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>兵部 (军政征防)</option>
                            <option value="works" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>工部 (土木水利)</option>
                            <option value="punishments" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900 text-stone-200'}>刑部 (秋审谳狱)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of Agent Tools / Local Tools */}
      <div className="mb-12">
        <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
          <Hammer className="w-5 h-5 text-stone-450" />
          <h2 className={`text-lg font-semibold tracking-tight font-display ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>
            {visualMode === 'cabinet' ? '备选 Agent 智能体 / 本地执行工具' : '备选 Agent 智能体 / 本地执行工具'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((member) => (
            <div 
              key={member.id}
              className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                member.selected 
                  ? isLight
                    ? 'bg-white border-amber-600 shadow-md shadow-amber-600/5 text-stone-900'
                    : 'bg-stone-900/95 border-amber-600/40 shadow-md shadow-stone-950/10 text-stone-200' 
                  : isLight
                    ? 'bg-stone-50/60 border-stone-105 hover:border-stone-200 text-stone-750'
                    : 'bg-stone-955/40 border-stone-800/80 hover:border-stone-700 text-stone-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <SafeAvatar
                    src={member.avatar}
                    name={member.name}
                    providerId={member.providerId}
                    className={`w-12 h-12 rounded-lg object-cover transition-all ${member.selected ? 'brightness-110' : 'opacity-65 grayscale'}`}
                  />
                  {member.selected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-stone-950 rounded-full p-0.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className={`font-bold text-sm truncate ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{memberDisplayName(member)}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditForm(member); }}
                        className="p-1 rounded text-stone-500 hover:text-amber-500 transition cursor-pointer"
                        title="编辑大臣"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!member.isDefault && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('确定要移除此大臣吗？')) onDeleteMember?.(member.id); }}
                          className="p-1 rounded text-stone-500 hover:text-rose-500 transition cursor-pointer"
                          title="删除大臣"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${
                        isLight
                          ? 'bg-stone-100 border-stone-200 text-stone-605'
                          : 'bg-stone-900 border-stone-800 text-amber-400'
                      }`}>
                        {member.badge}
                      </span>
                    </div>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed mb-3 ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                    {member.desc || '技术执行单元，精熟本地业务规范和安全隔离审计方案。'}
                  </p>
                </div>
              </div>

              {/* Roles controls */}
              <div className={`mt-2 pt-3 border-t flex flex-wrap items-center gap-2 ${isLight ? 'border-stone-200' : 'border-stone-800/80'}`}>
                <button
                  onClick={() => onToggleUser(member.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    member.selected 
                      ? 'bg-amber-600/15 text-amber-655 border border-amber-600/35 hover:bg-amber-600/25' 
                      : isLight 
                        ? 'bg-white text-stone-600 border border-stone-200 hover:text-stone-800 hover:bg-stone-50' 
                        : 'bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {member.selected ? (visualMode === 'cabinet' ? '革除' : '革除') : (visualMode === 'cabinet' ? '委任/辟召' : '委任/辟召')}
                </button>

                {member.selected && (
                  <>
                    <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-900 border-stone-800 text-stone-250'
                    }`}>
                      <span className="text-stone-400 font-mono text-[10px]">职务:</span>
                      <select
                        value={member.role}
                        onChange={(e) => onUpdateRole(member.id, e.target.value as any)}
                        className={`bg-transparent focus:outline-none cursor-pointer font-semibold ${isLight ? 'text-stone-800' : 'text-stone-200'}`}
                      >
                        <option value="none" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900 text-stone-200'}>无职务</option>
                        {visualMode === 'cabinet' ? (
                          <option value="pm" className={isLight ? 'bg-white text-amber-655 font-bold' : 'bg-stone-900 text-amber-300'}>首辅大臣</option>
                        ) : (
                          <option value="sg" className={isLight ? 'bg-white text-[#10a37f] font-bold' : 'bg-stone-900 text-teal-300'}>领衔首辅</option>
                        )}
                      </select>
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 ${
                      isLight ? 'bg-stone-50 border-stone-200 text-stone-700' : 'bg-stone-900 border-stone-800 text-stone-250'
                    }`}>
                      <span className="text-stone-400 font-mono text-[10px]">部门/职责:</span>
                      <select
                        value={member.ministry}
                        onChange={(e) => onUpdateMinistry(member.id, e.target.value as any)}
                        className={`bg-transparent focus:outline-none cursor-pointer font-semibold ${isLight ? 'text-stone-805' : 'text-stone-200'}`}
                      >
                        <option value="none" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900'}>无部门</option>
                        {visualMode === 'cabinet' ? (
                          <>
                            <option value="rites" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900'}>礼部 / 朝仪公关</option>
                            <option value="personnel" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900'}>吏部 / 朝局考课</option>
                            <option value="revenue" className={isLight ? 'bg-white text-stone-800' : 'bg-stone-900'}>户部 / 钱粮调度</option>
                            <option value="war" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900'}>兵部 / 巡边保驾</option>
                            <option value="works" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900'}>工部 / 工程营造</option>
                            <option value="punishments" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900'}>刑部 / 刑律典狱</option>
                            <option value="archive" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900'}>内史 / 文秘史档</option>
                          </>
                        ) : (
                          <>
                            <option value="rites" className={isLight ? 'bg-white text-stone-805' : 'bg-stone-900'}>礼部 / 朝仪公关</option>
                            <option value="personnel" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>吏部 / 朝局考课</option>
                            <option value="revenue" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>户部 / 钱粮调度</option>
                            <option value="war" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>兵部 / 巡边保驾</option>
                            <option value="works" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>工部 / 工程营造</option>
                            <option value="punishments" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>刑部 / 刑律典狱</option>
                            <option value="archive" className={isLight ? 'bg-white text-stone-802' : 'bg-stone-900'}>内史 / 文秘史档</option>
                          </>
                        )}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Member button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={openAddForm}
          className="px-5 py-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 text-xs font-bold transition cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {visualMode === 'cabinet' ? '新增大臣' : '新增大臣'}
        </button>
      </div>

      {/* Floating or Footer action bar */}
      <div className={`sticky bottom-4 left-0 right-0 border p-4 rounded-xl flex items-center justify-between transition-colors duration-300 z-10 ${
        isLight ? 'bg-white/90 backdrop-blur border-stone-200 shadow-lg' : 'bg-stone-955/85 backdrop-blur border-stone-800 shadow-2xl'
      }`}>
        <div className={`text-xs font-bold ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
          已遴选大臣与辅助工具：<span className="text-amber-500 font-mono font-semibold">{activeCount}</span> 位
        </div>
        <button
          onClick={onContinue}
          disabled={activeCount === 0}
          className={`px-6 py-2 rounded-lg text-xs font-bold tracking-wider flex items-center gap-2 transition cursor-pointer shadow ${
            activeCount > 0 
              ? 'bg-amber-600 hover:bg-amber-500 text-stone-95 shadow-md hover:scale-[1.01]' 
              : 'bg-stone-800 text-stone-505 cursor-not-allowed opacity-50'
          }`}
        >
          {visualMode === 'cabinet' ? '继续并新建廷议会话 ➔' : '继续并新建廷议会话 ➔'}
        </button>
      </div>

      {/* Minister Add/Edit Modal */}
      {showMinisterForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className={`border rounded-3xl p-6 max-w-2xl w-full relative space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-stone-900 border-stone-800 text-stone-200'
          }`}>
            <button onClick={() => setShowMinisterForm(false)} className={`absolute top-4 right-4 text-sm font-bold p-1 rounded-lg ${isLight ? 'hover:bg-stone-100' : 'hover:bg-stone-800'}`}><X className="w-4 h-4" /></button>
            <h3 className="text-sm font-black font-display text-amber-500">
              {editingMemberId ? '编辑大臣' : '新增大臣'}
            </h3>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">正式名称</span>
                <input value={ministerForm.name || ''} onChange={e => setMinisterForm({...ministerForm, name: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="内阁首辅" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">括号昵称</span>
                <input value={ministerForm.nickname || ''} onChange={e => setMinisterForm({...ministerForm, nickname: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="ChatGPT" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">类型</span>
                <select value={ministerForm.type || 'custom'} onChange={e => setMinisterForm({...ministerForm, type: e.target.value as any})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                  <option value="model">AI 模型</option>
                  <option value="tool">本地工具</option>
                  <option value="custom">自定义</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">技能</span>
                <select value={ministerForm.skillId || 'skill_general_reasoning'} onChange={e => setMinisterForm({...ministerForm, skillId: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                  {DEFAULT_SKILLS.map(s => <option key={s.id} value={s.id}>{s.name} - {s.role}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">部职</span>
                <select value={ministerForm.ministry || 'none'} onChange={e => {
                  const newMinistry = e.target.value as any;
                  const suggested = MINISTRY_SKILLS[newMinistry];
                  setMinisterForm({...ministerForm, ministry: newMinistry, ...(suggested ? { skillId: suggested } : {})});
                }} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                  <option value="none">无归属</option>
                  <option value="personnel">吏部</option>
                  <option value="rites">礼部</option>
                  <option value="revenue">户部</option>
                  <option value="war">兵部</option>
                  <option value="works">工部</option>
                  <option value="punishments">刑部</option>
                  <option value="archive">内史</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">职务</span>
                <select value={ministerForm.role || 'none'} onChange={e => setMinisterForm({...ministerForm, role: e.target.value as any})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                  <option value="none">无职务</option>
                  <option value="pm">首辅大臣</option>
                  <option value="sg">领衔首辅</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">头像 URL</span>
                <input value={ministerForm.avatar || ''} onChange={e => setMinisterForm({...ministerForm, avatar: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="留空则自动生成" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">Provider ID</span>
                <input value={ministerForm.providerId || ''} onChange={e => setMinisterForm({...ministerForm, providerId: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="openai / deepseek / claude / ..." />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">模型 ID</span>
                <input value={ministerForm.modelId || ''} onChange={e => setMinisterForm({...ministerForm, modelId: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="gpt-4o / deepseek-chat / ..." />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">工具 ID</span>
                <input value={ministerForm.localToolId || ''} onChange={e => setMinisterForm({...ministerForm, localToolId: e.target.value})} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'}`} placeholder="本地工具的 ID，如 cli.codex" />
              </label>
            </div>

            <div className="flex justify-between pt-2 border-t border-stone-800">
              {editingMemberId && onDeleteMember && !(members.find(m => m.id === editingMemberId)?.isDefault) ? (
                <button onClick={() => { if (confirm('确定要移除此大臣吗？')) { onDeleteMember(editingMemberId); setShowMinisterForm(false); } }} className="px-4 py-2 rounded-lg border border-rose-500/20 text-rose-500 text-xs font-bold cursor-pointer hover:bg-rose-500/10">
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowMinisterForm(false)} className={`px-5 py-2 rounded-lg border text-xs font-bold ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>取消</button>
                <button onClick={saveMinister} className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold cursor-pointer">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
