/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { CabinetMember, ChatMessage } from '../types';
import { normalizeMessageForLanguage } from '../data';
import {
  RefreshCw, ArrowLeft, Users, ThumbsUp, ThumbsDown, AlertTriangle,
  CheckCircle, XCircle, Play, Pause, SkipForward, Award
} from 'lucide-react';
import { SafeAvatar } from './SafeAvatar';

interface AutoDebateProps {
  members: CabinetMember[];
  onSendMessage: (text: string, targetMember?: CabinetMember) => void;
  onBack: () => void;
  visualMode: 'cabinet' | 'un';
  theme?: 'light' | 'dark';
  language?: 'zh' | 'en';
  backendBaseUrl: string;
}

interface DebateRound {
  roundNumber: number;
  opinions: Array<{
    memberId: string;
    memberName: string;
    opinion: string;
    votes: {
      approve: number;
      reject: number;
    };
    eliminated: boolean;
    selectedAlternative?: string;
  }>;
  eliminatedMemberId?: string;
  isComplete: boolean;
}

export const AutoDebate: React.FC<AutoDebateProps> = ({
  members,
  onSendMessage,
  onBack,
  visualMode,
  theme = 'dark',
  language = 'zh',
  backendBaseUrl
}) => {
  const [debateTopic, setDebateTopic] = useState('');
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isDebating, setIsDebating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const isLight = theme === 'light' && visualMode === 'un';

  const handleStartDebate = async () => {
    if (!debateTopic.trim() || members.length < 2) return;

    setIsDebating(true);
    setIsPaused(false);
    setDebateRounds([]);
    setCurrentRound(0);
    setWinner(null);
    setShowResults(false);

    // Start the auto-debate process
    await runDebateRounds(debateTopic, members.filter(m => m.selected), []);
  };

  const runDebateRounds = async (
    topic: string,
    activeMembers: CabinetMember[],
    previousRounds: DebateRound[]
  ) => {
    const maxRounds = 5;

    for (let round = 1; round <= maxRounds; round++) {
      if (isPaused) {
        // Wait for unpause
        await new Promise(resolve => {
          const checkPause = setInterval(() => {
            if (!isPaused) {
              clearInterval(checkPause);
              resolve(undefined);
            }
          }, 100);
        });
      }

      setCurrentRound(round);

      // Get opinions from each member
      const roundData: DebateRound = {
        roundNumber: round,
        opinions: [],
        isComplete: false
      };

      // Simulate AI opinions (in production, call backend API)
      for (const member of activeMembers) {
        const opinion = await generateMemberOpinion(member, topic, previousRounds);
        roundData.opinions.push({
          memberId: member.id,
          memberName: member.name,
          opinion,
          votes: { approve: 0, reject: 0 },
          eliminated: false
        });
      }

      // Voting phase - each member votes on others' opinions
      for (const voter of activeMembers) {
        for (const opinion of roundData.opinions) {
          if (opinion.memberId !== voter.id) {
            // Simulate vote (random for demo, in production use AI)
            const vote = Math.random() > 0.5 ? 'approve' : 'reject';
            if (vote === 'approve') {
              opinion.votes.approve++;
            } else {
              opinion.votes.reject++;
            }
          }
        }
      }

      // Find member with most rejections
      const sortedByReject = [...roundData.opinions].sort((a, b) => b.votes.reject - a.votes.reject);
      const mostRejected = sortedByReject[0];

      // Check if there's a tie
      const tiedMembers = sortedByReject.filter(o => o.votes.reject === mostRejected.votes.reject);

      if (tiedMembers.length > 1 && round < maxRounds) {
        // Tie - continue debate
        roundData.isComplete = false;
      } else {
        // Eliminate the member with most rejections
        mostRejected.eliminated = true;
        roundData.eliminatedMemberId = mostRejected.memberId;

        // Ask eliminated member to choose an alternative
        const alternativeMember = activeMembers.find(m => m.id !== mostRejected.memberId);
        if (alternativeMember) {
          mostRejected.selectedAlternative = alternativeMember.id;
        }

        // Remove eliminated member from active list
        activeMembers = activeMembers.filter(m => m.id !== mostRejected.memberId);

        // Check if we have a winner
        if (activeMembers.length === 1) {
          setWinner(activeMembers[0].name);
          roundData.isComplete = true;
          setShowResults(true);
        }
      }

      setDebateRounds(prev => [...prev, roundData]);

      // Wait before next round
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // If we reached max rounds without a winner
    if (!winner && activeMembers.length > 1) {
      setShowResults(true);
    }

    setIsDebating(false);
  };

  const generateMemberOpinion = async (
    member: CabinetMember,
    topic: string,
    previousRounds: DebateRound[]
  ): Promise<string> => {
    // In production, this would call the backend API
    // For now, return a placeholder
    return `[${member.name}] 对 "${topic}" 的观点 - 第 ${previousRounds.length + 1} 轮`;
  };

  const handlePauseDebate = () => {
    setIsPaused(true);
  };

  const handleResumeDebate = () => {
    setIsPaused(false);
  };

  const handleStopDebate = () => {
    setIsDebating(false);
    setIsPaused(false);
  };

  return (
    <div className={`w-full h-full overflow-auto p-5 animate-fadeIn font-sans ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={onBack}
          className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
            isLight
              ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
              : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-100'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回
        </button>

        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" />
          <h1 className={`text-lg font-bold ${isLight ? 'text-stone-900' : 'text-white'}`}>
            自动辩驳模式
          </h1>
        </div>
      </div>

      {/* Topic Input */}
      <div className={`border rounded-xl p-5 mb-6 ${isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'}`}>
        <h2 className={`text-sm font-bold mb-3 ${isLight ? 'text-stone-800' : 'text-white'}`}>
          议题设置
        </h2>
        <textarea
          value={debateTopic}
          onChange={(e) => setDebateTopic(e.target.value)}
          placeholder="输入辩驳议题，各AI将就此展开多轮辩论..."
          rows={3}
          className={`w-full rounded-lg border p-3 text-sm resize-none ${
            isLight
              ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400'
              : 'bg-stone-950 border-stone-800 text-stone-200 placeholder-stone-600'
          }`}
          disabled={isDebating}
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleStartDebate}
            disabled={!debateTopic.trim() || members.length < 2 || isDebating}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all"
          >
            <Play className="w-4 h-4" />
            开始自动辩驳
          </button>
          {isDebating && (
            <>
              {isPaused ? (
                <button
                  onClick={handleResumeDebate}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  继续辩驳
                </button>
              ) : (
                <button
                  onClick={handlePauseDebate}
                  className="px-4 py-2.5 bg-stone-600 hover:bg-stone-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  暂停辩驳
                </button>
              )}
              <button
                onClick={handleStopDebate}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                停止辩驳
              </button>
            </>
          )}
        </div>
      </div>

      {/* Debate Rounds Display */}
      {debateRounds.length > 0 && (
        <div className="space-y-6">
          {debateRounds.map((round, index) => (
            <div
              key={round.roundNumber}
              className={`border rounded-xl p-5 transition-all ${
                isLight
                  ? 'bg-white border-stone-200'
                  : 'bg-stone-900 border-stone-800'
              } ${round.isComplete ? 'ring-2 ring-emerald-500/30' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-stone-800' : 'text-white'}`}>
                  <span className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
                    {round.roundNumber}
                  </span>
                  第 {round.roundNumber} 轮
                </h3>
                {round.isComplete && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">
                    完成
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {round.opinions.map((opinion) => (
                  <div
                    key={opinion.memberId}
                    className={`p-4 rounded-lg border transition-all ${
                      opinion.eliminated
                        ? isLight
                          ? 'bg-rose-50 border-rose-200 opacity-60'
                          : 'bg-rose-950/20 border-rose-800 opacity-60'
                        : isLight
                          ? 'bg-stone-50 border-stone-200'
                          : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        opinion.eliminated
                          ? 'bg-rose-200 text-rose-700'
                          : 'bg-amber-200 text-amber-700'
                      }`}>
                        {opinion.memberName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-sm font-bold ${isLight ? 'text-stone-800' : 'text-white'}`}>
                            {opinion.memberName}
                          </span>
                          {opinion.eliminated && (
                            <span className="px-2 py-0.5 bg-rose-200 text-rose-700 text-xs font-bold rounded">
                              已淘汰
                            </span>
                          )}
                        </div>
                        <p className={`text-sm leading-relaxed ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                          {opinion.opinion}
                        </p>

                        {/* Votes Display */}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-stone-200 dark:border-stone-700">
                          <div className="flex items-center gap-1.5">
                            <ThumbsUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-600">{opinion.votes.approve}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ThumbsDown className="w-4 h-4 text-rose-500" />
                            <span className="text-xs font-bold text-rose-600">{opinion.votes.reject}</span>
                          </div>
                        </div>

                        {opinion.selectedAlternative && (
                          <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800">
                            选择支持: {round.opinions.find(o => o.id === opinion.selectedAlternative)?.memberName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Modal */}
      {showResults && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`border rounded-3xl p-8 max-w-lg w-full shadow-2xl ${
            isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
          }`}>
            <div className="text-center mb-6">
              <Award className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className={`text-2xl font-bold mb-2 ${isLight ? 'text-stone-900' : 'text-white'}`}>
                {winner ? '辩驳完成' : '辩驳结束'}
              </h2>
              <p className={`text-sm ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                {winner
                  ? `最终胜出: ${winner}`
                  : `经过 ${debateRounds.length} 轮辩驳，未能达成一致`
                }
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {debateRounds[debateRounds.length - 1]?.opinions
                .filter(o => !o.eliminated)
                .map((opinion) => (
                  <div
                    key={opinion.memberId}
                    className={`p-4 rounded-xl border ${
                      isLight ? 'bg-stone-50 border-stone-200' : 'bg-stone-950 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold">
                        {opinion.memberName[0]}
                      </div>
                      <div>
                        <p className={`font-bold ${isLight ? 'text-stone-800' : 'text-white'}`}>
                          {opinion.memberName}
                        </p>
                        <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                          支持: {opinion.votes.approve} | 反对: {opinion.votes.reject}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResults(false)}
                className={`flex-1 px-4 py-3 rounded-xl border font-bold text-sm transition ${
                  isLight
                    ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                    : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white'
                }`}
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  setDebateTopic('');
                  setDebateRounds([]);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition"
              >
                新的辩驳
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {debateRounds.length === 0 && !isDebating && (
        <div className={`text-center py-16 ${isLight ? 'text-stone-400' : 'text-stone-600'}`}>
          <Users className="w-20 h-20 mx-auto mb-4 opacity-20" />
          <p className="text-sm">
            输入议题并点击"开始自动辩驳"，各AI将自动进行多轮辩论并淘汰反对意见最多的观点。
          </p>
        </div>
      )}
    </div>
  );
};
