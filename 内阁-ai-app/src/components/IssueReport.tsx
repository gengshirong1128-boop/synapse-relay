/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clipboard, Mail, RefreshCw, Send, ShieldAlert } from 'lucide-react';

interface IssueReportProps {
  onBack: () => void;
  theme?: 'light' | 'dark';
}

type RuntimeCheck = {
  generatedAt?: string;
  app?: { ok?: boolean; url?: string };
  ccSwitch?: {
    ok?: boolean;
    health?: boolean;
    serviceOk?: boolean;
    routeReady?: boolean;
    provider?: string;
    providerId?: string;
    activeTargets?: string[];
    lastError?: string;
  };
  backend?: { ok?: boolean; url?: string; error?: string };
};

export const IssueReport: React.FC<IssueReportProps> = ({ onBack, theme = 'dark' }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('cabinet_feedback_email') || '');
  const [category, setCategory] = useState('功能异常');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [diagnosis, setDiagnosis] = useState<RuntimeCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const isLight = theme === 'light';

  useEffect(() => {
    localStorage.setItem('cabinet_feedback_email', email.trim());
  }, [email]);

  const reportText = useMemo(() => {
    const diagnostics = diagnosis ? JSON.stringify(diagnosis, null, 2) : '尚未运行自动检测';
    return `内阁问题反馈

类型：${category}
标题：${title || '未填写'}

问题描述：
${description || '未填写'}

复现步骤：
${steps || '未填写'}

期望结果：
${expected || '未填写'}

自动检测：
${diagnostics}`;
  }, [category, description, diagnosis, expected, steps, title]);

  const runCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/runtime-check');
      const data = await response.json();
      setDiagnosis(data);
    } catch (error: any) {
      setDiagnosis({ app: { ok: false }, backend: { ok: false, error: error?.message || 'runtime check failed' } });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const openMailClient = () => {
    const target = email.trim();
    if (!target) return;
    const subject = encodeURIComponent(`[内阁反馈][${category}] ${title || '未命名问题'}`);
    const body = encodeURIComponent(reportText);
    window.location.href = `mailto:${target}?subject=${subject}&body=${body}`;
  };

  const submitIssue = async () => {
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: email.trim(),
          category,
          title: title.trim(),
          reportText,
          diagnosis,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      if (data.emailSent) {
        setSubmitMessage(`问题单 ${data.reportId} 已保存并发送到邮箱。`);
      } else {
        setSubmitMessage(`问题单 ${data.reportId} 已保存到本机。未配置 SMTP，正在打开邮件客户端。`);
        openMailClient();
      }
    } catch (error: any) {
      setSubmitMessage(`提交失败：${error?.message || 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass = isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-stone-900 border-stone-800 text-stone-100';
  const inputClass = isLight
    ? 'bg-white border-stone-200 text-stone-800 placeholder:text-stone-400'
    : 'bg-stone-950 border-stone-800 text-stone-100 placeholder:text-stone-600';

  return (
    <div className="w-full h-full overflow-auto p-5 animate-fadeIn font-sans">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${inputClass}`}>
            <ArrowLeft className="w-3.5 h-3.5" /> 返回
          </button>
          <div className="flex items-center gap-2 text-amber-500 text-xs font-bold">
            <ShieldAlert className="w-4 h-4" /> 问题反馈与诊断
          </div>
        </div>

        <section className={`border rounded-xl p-5 space-y-4 ${cardClass}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500">接收邮箱</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold text-stone-500">问题类型</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`}>
                <option>功能异常</option>
                <option>API / CC Switch</option>
                <option>自动检测</option>
                <option>AI 成员 / Skill</option>
                <option>界面问题</option>
                <option>功能建议</option>
              </select>
            </label>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句话描述问题" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${inputClass}`} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="问题描述" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none resize-y ${inputClass}`} />
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4} placeholder="复现步骤" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none resize-y ${inputClass}`} />
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={3} placeholder="期望结果" className={`w-full rounded-lg border px-3 py-2 text-xs outline-none resize-y ${inputClass}`} />
        </section>

        <section className={`border rounded-xl p-5 space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">自动检测报告</span>
            <button onClick={runCheck} disabled={checking} className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-bold flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> 检测
            </button>
          </div>
          <pre className={`max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-[10px] leading-relaxed ${inputClass}`}>{diagnosis ? JSON.stringify(diagnosis, null, 2) : '点击检测后自动收集应用、CC Switch 和后端状态。'}</pre>
        </section>

        <div className="flex justify-end gap-2">
          <button onClick={() => navigator.clipboard?.writeText(reportText)} className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${inputClass}`}>
            <Clipboard className="w-3.5 h-3.5" /> 复制报告
          </button>
          <button onClick={openMailClient} disabled={!email.trim()} className={`px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${inputClass}`}>
            <Mail className="w-3.5 h-3.5" /> 邮件客户端
          </button>
          <button onClick={submitIssue} disabled={!email.trim() || submitting} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 text-xs font-bold flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> {submitting ? '提交中' : '保存并提交'}
          </button>
        </div>
        {submitMessage && <p className="text-right text-[11px] text-amber-500">{submitMessage}</p>}
      </div>
    </div>
  );
};
