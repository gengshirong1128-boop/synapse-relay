/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CabinetMember, ChatMessage } from '../types';
import { 
  ArrowLeft, Layers, Terminal, Crown, MessageSquare
} from 'lucide-react';
import { SafeAvatar } from './SafeAvatar';

interface CabinetColumnsProps {
  members: CabinetMember[];
  messages: ChatMessage[];
  onBackToMeeting: () => void;
  visualMode: 'cabinet' | 'un';
  isGenerating: boolean;
  theme?: 'light' | 'dark';
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  language?: 'zh' | 'en';
}

export const CabinetColumns: React.FC<CabinetColumnsProps> = ({
  members,
  messages,
  onBackToMeeting,
  visualMode,
  isGenerating,
  theme = 'dark',
  fontSize = 'md'
}) => {
  const activeMembers = members.filter(m => m.selected);

  // Separate moderator (host) out to place them exactly in the visual center
  const moderator = activeMembers.find(m => m.role === 'pm' || m.role === 'sg');
  const otherMembers = activeMembers.filter(m => m.id !== moderator?.id);

  // Position moderator directly in the center column
  const sortedMembers = [...otherMembers];
  if (moderator) {
    const centerIndex = Math.floor(sortedMembers.length / 2);
    sortedMembers.splice(centerIndex, 0, moderator);
  }

  const isLight = theme === 'light';
  const isCabinet = visualMode === 'cabinet';
  const messageTextClass = fontSize === 'sm' ? 'text-[11px]' : fontSize === 'lg' ? 'text-sm' : fontSize === 'xl' ? 'text-[15px]' : 'text-xs';

  const containerClass = isCabinet
    ? isLight
      ? 'bg-rice-paper text-[#1c120c] font-serif'
      : 'bg-rice-paper-dark text-[#eeddc5] font-serif'
    : isLight
      ? 'bg-[#f8fafc] text-slate-800 font-sans'
      : 'bg-[#05070c] text-slate-200 font-sans';

  const columnHeaderBorderClass = isCabinet
    ? 'border-[#3d2b1f]'
    : isLight ? 'border-slate-200' : 'border-[#1e293b]';

  const buttonClass = isCabinet
    ? isLight
      ? 'bg-[#f4ecd8] border-[#3d2b1f] text-[#3d2b1f] hover:bg-[#ecdcb9]'
      : 'bg-[#221d18] border-[#4a2f1b] text-[#eedcdc] hover:bg-[#2c241c]'
    : isLight
      ? 'bg-white hover:bg-stone-50 border-slate-200 text-slate-700'
      : 'bg-[#1b223c] hover:bg-[#232c4e] border-[#29355c] text-blue-300';

  const cardClass = (isModerator: boolean) => {
    if (isCabinet) {
      return isLight
        ? isModerator
          ? 'bg-[#f0e4c6] border-2 border-[#7a4823] shadow-md ring-4 ring-[#7a4823]/10'
          : 'bg-[#faf4e0] border border-[#3d2b1f] shadow-sm'
        : isModerator
          ? 'bg-[#1e150f] border-2 border-[#8c5227] ring-4 ring-[#8c5227]/10'
          : 'bg-[#140e0a] border border-[#3d2b1f] shadow-sm';
    }
    return isLight
      ? isModerator
        ? 'bg-white border-2 border-blue-500 shadow-md ring-4 ring-blue-500/10'
        : 'bg-white border border-slate-200 shadow-sm'
      : isModerator
        ? 'bg-[#0e162d] border-2 border-blue-500 ring-4 ring-blue-500/10'
        : 'bg-[#080b11] border border-slate-850';
  };

  const bannerClass = (isModerator: boolean) => {
    if (isCabinet) {
      return isLight
        ? isModerator ? 'bg-[#ebd3a3] border-b border-[#3d2b1f]' : 'bg-[#f2e2c4] border-b border-[#3d2b1f]/60'
        : isModerator ? 'bg-[#281a10] border-b border-[#4a2f1b]' : 'bg-[#1b140f] border-b border-[#3d2b1f]/60';
    }
    return isLight
      ? isModerator ? 'bg-blue-50/70 border-b border-slate-200' : 'bg-slate-50 border-b border-slate-200'
      : isModerator ? 'bg-[#152042] border-b border-[#1e293b]' : 'bg-[#0e1322] border-b border-[#1e293b]';
  };

  const messageStreamBgClass = isCabinet
    ? isLight ? 'bg-[#f4ecd8]' : 'bg-[#0f0b08]/85'
    : isLight ? 'bg-slate-50/50' : 'bg-[#04060b]/40';

  const bioCardClass = isCabinet
    ? isLight ? 'bg-[#fdfaf2] border border-[#3d2b1f]/40 text-stone-700' : 'bg-[#16110c] border border-[#3d2b1f]/40 text-stone-300'
    : isLight ? 'bg-white border border-slate-250 text-slate-600' : 'bg-slate-950/75 border border-slate-800 text-slate-400';

  const bioBorderClass = isCabinet
    ? 'border-[#3d2b1f]/20 text-[#6b4e31]'
    : isLight ? 'border-slate-100 text-slate-400' : 'border-slate-800/60 text-slate-500';

  const dialogueCardClass = isCabinet
    ? isLight ? 'bg-[#fdfbf6] border border-[#3d2b1f] text-[#241305]' : 'bg-[#1e1711] border border-[#3d2b1f] text-[#eedbc5]'
    : isLight ? 'bg-white border border-slate-250 text-slate-850' : 'bg-[#111726] border border-slate-800 text-slate-200';

  const footerClass = isCabinet
    ? isLight ? 'bg-[#ebd3a3]/35 border-t border-[#3d2b1f]' : 'bg-[#1b140f]/60 border-t border-[#3d2b1f]'
    : isLight ? 'bg-slate-50 border-t border-slate-200' : 'bg-[#0f1322] border-t border-slate-800';

  // Derive status message for each member
  const getMemberStatus = (member: CabinetMember) => {
    if (isGenerating) {
      if (member.role === 'pm' || member.role === 'sg') {
        return visualMode === 'cabinet' ? '起草拟折中...' : '起草拟折中...';
      }
      return visualMode === 'cabinet' ? '思忖拟草中...' : '思忖拟草中...';
    }
    return visualMode === 'cabinet' ? '阁议就位' : '阁议就位';
  };

  const getMemberStatusColor = (member: CabinetMember) => {
    if (isGenerating) {
      return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    }
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  };

  return (
    <div className={`w-full max-w-7xl mx-auto py-4 px-4 animate-fadeIn flex flex-col h-[calc(100vh-140px)] ${containerClass}`}>
      
      {/* Workspace column header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 mb-4 pb-3.5 border-b shrink-0 ${columnHeaderBorderClass}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMeeting}
            className={`px-4 py-2 rounded-xl border text-xs cursor-pointer font-bold transition-all flex items-center gap-1.5 shadow-lg ${buttonClass}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{visualMode === 'cabinet' ? '返回书殿/廷议' : '返回书殿/廷议'}</span>
          </button>
          
          <div>
            <h1 className="text-sm font-black font-display flex items-center gap-1.5 leading-none">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>{visualMode === 'cabinet' ? '九卿分列开案' : '参议列席对观'}</span>
            </h1>
            <p className="text-[10px] mt-1 opacity-75">
              {visualMode === 'cabinet' 
                ? '六部尚书奏议各占一卷，首辅赫然居中，实现群臣意见的平行透视与审计。' 
                : '六部尚书奏议各占一卷，首辅赫然居中，群臣意见平行透视。'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono font-bold">
          <span>{visualMode === 'cabinet' ? '活动部席：' : '活动部席：'} <strong className="text-amber-500">{activeMembers.length}</strong></span>
          <span>{visualMode === 'cabinet' ? '案存票拟：' : '案存票拟：'} <strong className="text-amber-500">{messages.length}</strong></span>
        </div>
      </div>

      {/* horizontal visual flow scrolling dashboard */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-5 h-full items-stretch min-w-max">
          
          {sortedMembers.map((member) => {
            const isModerator = member.role === 'pm' || member.role === 'sg';
            const statusLabel = getMemberStatus(member);
            const statusColor = getMemberStatusColor(member);

            // Filter specific dialogue blocks authored by this seat
            const seatMessages = messages.filter(
              msg => msg.ministerId === member.id || (msg.sender && msg.sender.includes(member.name))
            );

            return (
              <div 
                key={member.id}
                className={`w-[340px] rounded-2xl flex flex-col h-full overflow-hidden transition-all duration-350 shrink-0 ${cardClass(isModerator)}`}
              >
                
                {/* Column Host Banner */}
                <div className={`p-4 border-b shrink-0 ${bannerClass(isModerator)}`}>
                  <div className="flex items-start justify-between gap-2.5">
                    
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <SafeAvatar
                          src={member.avatar}
                          name={member.name}
                          className={`w-11 h-11 text-sm border-2 ${
                            isModerator 
                              ? 'border-amber-500 animate-pulse' 
                              : isLight ? 'border-slate-200' : 'border-[#1e293b]'
                          }`}
                        />
                        {isModerator && (
                          <div className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 border ${
                            isLight && !isCabinet ? 'bg-blue-600 text-white border-white' : 'bg-amber-500 text-stone-955 border-stone-900'
                          }`}>
                            <Crown className="w-3 h-3 stroke-[2.5]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-black truncate font-display tracking-tight leading-none">
                            {member.name}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1.5 animate-fadeIn">
                          {isModerator && (
                            <span className="text-[8px] font-bold bg-amber-600 text-stone-95 px-2 py-0.2 rounded-full uppercase tracking-wider font-mono">
                              {visualMode === 'cabinet' ? '领衔首辅' : '领衔首辅'}
                            </span>
                          )}
                          {member.ministry !== 'none' && (
                            <span className={`text-[8px] font-bold border px-1.5 py-0.2 rounded font-mono ${
                              isLight 
                                ? 'bg-stone-100 border-stone-200 text-stone-600' 
                                : 'bg-stone-950/80 border-stone-800 text-stone-300'
                            }`}>
                              {visualMode === 'cabinet'
                                ? (member.ministry === 'war' ? '兵部尚书'
                                   : member.ministry === 'works' ? '工部尚书'
                                   : member.ministry === 'rites' ? '礼部尚书'
                                   : member.ministry === 'revenue' ? '户部尚书'
                                   : member.ministry === 'punishments' ? '刑部尚书'
                                   : member.ministry === 'archive' ? '文秘史馆' : '吏部尚书')
                                : (member.ministry === 'war' ? '兵部尚书'
                                   : member.ministry === 'works' ? '工部尚书'
                                   : member.ministry === 'rites' ? '礼部尚书'
                                   : member.ministry === 'revenue' ? '户部尚书'
                                   : member.ministry === 'punishments' ? '刑部尚书'
                                   : member.ministry === 'archive' ? '文秘史馆' : '吏部尚书')}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>

                {/* Submessage stream block */}
                <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 ${messageStreamBgClass}`}>
                  
                  {/* System Seat Bio Description Card */}
                  <div className={`p-3 border rounded-xl space-y-1.5 font-mono text-[10px] leading-relaxed ${bioCardClass}`}>
                    <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase pb-1 border-b ${bioBorderClass}`}>
                      <Terminal className="w-3.5 h-3.5 text-amber-500/80" />
                      <span>{visualMode === 'cabinet' ? '阁席规制 / Desc' : '阁席规制'}</span>
                    </div>
                    <p className="font-sans leading-relaxed text-[11px]">{member.desc || '具有高级决策逻辑分析长上下文处理性能。'}</p>
                  </div>

                  {/* Dialogue thread inside column */}
                  {seatMessages.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-stone-450 text-center font-mono animate-fadeIn">
                      <MessageSquare className="w-7 h-7 stroke-[1.2] mb-2 text-stone-400/60" />
                      <p className="text-[10px] leading-relaxed max-w-[150px] opacity-70">
                        {visualMode === 'cabinet' ? '此臣尚未就此议案开折票拟' : '此臣尚未就此议案开折票拟'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {seatMessages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`p-3 border rounded-xl space-y-2 relative shadow-sm animate-scaleIn ${dialogueCardClass}`}
                        >
                          <div className="flex justify-between text-[8px] font-mono font-bold opacity-60">
                            <span>{msg.roleLabel || '奏折'}</span>
                            <span className="text-emerald-650">已送达</span>
                          </div>
                          
                          <p className={`${messageTextClass} leading-relaxed font-sans whitespace-pre-line pl-0.5 opacity-90`}>
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* Column status info footer */}
                <div className={`p-3 shrink-0 flex items-center justify-between text-[10px] font-mono leading-none font-bold ${footerClass}`}>
                  <div className={`px-2 py-1 rounded border flex items-center gap-1.5 ${statusColor} text-[9px] font-bold`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    <span>{statusLabel}</span>
                  </div>
                  <span className="opacity-70">
                    {visualMode === 'cabinet' ? '奏析' : '奏析'}: {seatMessages.length}
                  </span>
                </div>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
};
