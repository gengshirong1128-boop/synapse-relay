/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { VerdictOption, ChatMessage } from '../types';
import { Gavel, Check, Sparkles, X, Terminal, ArrowRight, Play, AlertCircle } from 'lucide-react';

interface VerdictModalProps {
  onClose: () => void;
  onSubmitVerdict: (selectedPlan: VerdictOption, executionAgent: string) => void;
  messages: ChatMessage[];
  contextTitle: string;
  visualMode: 'cabinet' | 'un';
}

const EXECUTION_AGENTS = [
  { id: 'codex', name: 'Codex Dev Node', type: 'system', desc: '本地底层及脚本自动化执行代理' },
  { id: 'claudecode', name: 'Claude Code CLI', type: 'system', desc: '交互式命令行与安全审查代理' },
  { id: 'trae', name: 'Trae AI Agent', type: 'system', desc: '结构化文件管理与精密工程实现' },
  { id: 'workbuddy', name: 'WorkBuddy Service', type: 'system', desc: '硬件状态调用与综合总线中通' },
  { id: 'localscript', name: '本地脚本 Agent', type: 'user', desc: '执行本地 Shell/Python 深度控制' },
  { id: 'browserauto', name: '浏览器自动化 Agent', type: 'user', desc: '网页驱动、Puppeteer 及流程抓取' },
  { id: 'custom', name: '自定义 Agent (专属档案馆)', type: 'user', desc: '机密诏书存卷与内部条例对比' }
];

export const VerdictModal: React.FC<VerdictModalProps> = ({
  onClose,
  onSubmitVerdict,
  messages,
  contextTitle,
  visualMode
}) => {
  const [plans, setPlans] = useState<VerdictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('alpha');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('trae');
  const [error, setError] = useState<string | null>(null);

  // Derive source AIs for mock realism if plans are loaded
  const getSourceForPlan = (id: string): string => {
    if (id === 'alpha') return 'Claude 3.5 Sonnet / ChatGPT';
    if (id === 'beta') return 'DeepSeek R1 / Codex';
    return 'Gemini 3.5 Flash / Qwen 2.5';
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, contextTitle })
        });
        
        if (!response.ok) {
          throw new Error('Failed to formulate drafts.');
        }

        const data = await response.json();
        setPlans(data.plans || []);
        if (data.plans && data.plans.length > 0) {
          setSelectedPlanId(data.plans[0].id);
        }
      } catch (err: any) {
        console.error('Error in finalizing:', err);
        setError(err.message || 'Server error crafting drafts.');
        setPlans([
          {
            id: 'alpha',
            title: visualMode === 'cabinet' ? '首脑折中安民案 (Balanced Compromise Plan)' : '首脑折中安民案',
            badge: '折中案',
            description: visualMode === 'cabinet' 
              ? '允许商贾包办部分榷用运输，官民六四分成，不施重税以抚民生；同时设立北关盐粮司，彻查基层官吏贪墨中饱。'
              : '允许商贾包办部分榷用运输，官民六四分成；同时设立监察分司，彻查贪墨中饱。',
            icon: 'psychology'
          },
          {
            id: 'beta',
            title: visualMode === 'cabinet' ? '雷霆专营重惩案 (Directive State Monopoly)' : '雷霆专营重惩案',
            badge: '专营重惩案',
            description: visualMode === 'cabinet'
              ? '全面禁止私人涉足盐铁。兵部抽调三营巡防精兵锁死北境粮道，刑部在边关设重典法庭，私贩罪首枭首，包庇劣绅抄家。'
              : '全面禁止私人涉足盐铁。兵部抽调精兵锁死粮道，刑部在边关设重典法庭，私贩枭首，包庇抄家。',
            icon: 'policy'
          },
          {
            id: 'gamma',
            title: visualMode === 'cabinet' ? '互市通衢化边案 (Market Liberalization & Defense)' : '互市通衢化边案',
            badge: '互市通商案',
            description: visualMode === 'cabinet'
              ? '撤销过境重税，敕令北境与外邦直接互市，由皇室特许商会承销官盐。引渠灌溉改善牧地，化堵为疏让私盐无利可图。'
              : '撤销过境重税，敕令北境与外邦直接互市，由皇室特许商会承销官盐。化堵为疏让私盐无利可图。',
            icon: 'public'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [messages, contextTitle, visualMode]);

  const handlePromulgate = () => {
    const activePlan = plans.find(p => p.id === selectedPlanId);
    const activeAgent = EXECUTION_AGENTS.find(a => a.id === selectedAgentId);
    if (activePlan && activeAgent) {
      onSubmitVerdict(activePlan, activeAgent.name);
    }
  };

  const activePlanDetails = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header bar */}
        <div className="p-4.5 border-b border-stone-800 flex items-center justify-between bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 border border-amber-600/30 flex items-center justify-center text-amber-500 shadow">
              <Gavel className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-stone-100 uppercase font-display">
                {visualMode === 'cabinet' ? '🏛️ 圣裁定案：起草敕令与交办执行' : '🏛️ 圣裁定案：起草敕令与交办执行'}
              </h2>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {visualMode === 'cabinet' ? '提炼群臣廷争要旨，确立乾坤终局大计，指定专属 Agent 落实承办' : '提炼群臣廷争要旨，确立乾坤终局大计，指定专属 Agent 落实承办'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content splits */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-stone-800">
          
          {/* Left panel: Candidate Plans */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="pb-2 border-b border-stone-800">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">
                {visualMode === 'cabinet' ? '1. 候选敕令草案' : '1. Candidate Plans'}
              </h3>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-500">
                <span className="w-6 h-6 border-2 border-stone-700 border-t-amber-500 rounded-full animate-spin"></span>
                <span className="text-xs font-mono">文渊阁、翰林学士提炼折奏中...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-600/5 border-amber-600/60 shadow-md shadow-amber-950/15' 
                          : 'bg-stone-950/20 border-stone-800/80 hover:border-stone-700 hover:bg-stone-950/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-amber-600 border-transparent text-stone-950' : 'border-stone-700 text-transparent'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <h4 className="text-xs font-bold text-stone-100 font-display">
                            {plan.title}
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-stone-950 px-2 py-0.5 rounded-full text-amber-500 border border-stone-800">
                          {plan.badge}
                        </span>
                      </div>
                      
                      <p className="text-xs text-stone-300/90 leading-relaxed pl-6.5 font-sans">
                        {plan.description}
                      </p>

                      <div className="mt-3.5 pt-2 border-t border-stone-800/60 flex justify-between items-center text-[10px] text-stone-500 pl-6.5 font-mono">
                        <span>{visualMode === 'cabinet' ? '奏折来源 AI' : '奏折来源 AI'}: <strong className="text-stone-300 font-semibold">{getSourceForPlan(plan.id)}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Execution Agent Selection */}
          <div className="w-full lg:w-[380px] overflow-y-auto p-5 bg-stone-950/40 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-2 border-b border-stone-800">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">
                  {visualMode === 'cabinet' ? '2. 指派执行部级 Agent' : '2. 指派执行部级 Agent'}
                </h3>
              </div>

              {/* Selected Plan Details Card Summary */}
              {activePlanDetails && (
                <div className="p-3.5 bg-stone-950/80 border border-stone-800 rounded-xl space-y-2">
                  <h5 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">
                    {visualMode === 'cabinet' ? '当前承案决案概要' : '当前承案决案概要'}
                  </h5>
                  <h4 className="text-xs font-bold text-amber-100 font-display truncate">
                    {activePlanDetails.title}
                  </h4>
                  <p className="text-[11px] text-stone-400 line-clamp-3 leading-relaxed">
                    {activePlanDetails.description}
                  </p>
                </div>
              )}

              {/* List of computer agent executors */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {EXECUTION_AGENTS.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-amber-600/10 border-amber-600/40 text-stone-100' 
                          : 'bg-stone-950/45 border-stone-800/80 hover:border-stone-700 hover:bg-stone-950 text-stone-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Terminal className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-500' : 'text-stone-600'}`} />
                        <div className="min-w-0">
                          <h5 className={`text-xs font-semibold ${isSelected ? 'text-stone-200' : 'text-stone-300'}`}>{agent.name}</h5>
                          <p className="text-[9px] text-stone-500 truncate mt-0.5">{agent.desc}</p>
                        </div>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-amber-500 text-amber-500' : 'border-stone-700'}`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Promote Action Box */}
            <div className="mt-6 pt-4 border-t border-stone-800/80">
              <button
                onClick={handlePromulgate}
                disabled={loading || plans.length === 0}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg text-stone-950 ${
                  !loading && plans.length > 0 
                    ? 'bg-amber-600 hover:bg-amber-500 cursor-pointer hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{visualMode === 'cabinet' ? '发旨：命内阁交办执行' : '发旨：命内阁交办执行'}</span>
              </button>
              <p className="text-[10px] text-stone-500 text-center mt-2 font-mono">
                {visualMode === 'cabinet' ? '✓ 此旨意将汇入廷议总案并触发自动集成流程' : '✓ 此旨意将汇入廷议总案并触发自动集成流程'}
              </p>
            </div>

          </div>

        </div>

        {/* Outer overall actions */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/80 shrink-0 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4.5 py-2 rounded-xl text-xs font-semibold border border-stone-800 hover:border-stone-700 hover:text-stone-200 transition-colors cursor-pointer"
          >
            {visualMode === 'cabinet' ? '按下不表 (暂存)' : '暂存'}
          </button>
        </div>

      </div>
    </div>
  );
};
