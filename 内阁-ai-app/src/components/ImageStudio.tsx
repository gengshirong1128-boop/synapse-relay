/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Image as ImageIcon, Sparkles } from 'lucide-react';

type ApiConfigItem = {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
};

interface ImageStudioProps {
  onBack: () => void;
  theme?: 'light' | 'dark';
}

const readApiConfigs = (): ApiConfigItem[] => {
  try {
    const raw = JSON.parse(localStorage.getItem('cabinet_api_configs') || '[]');
    if (Array.isArray(raw)) return raw.filter((item) => item?.endpoint);
  } catch {
    // Use the default OpenAI-compatible configuration below.
  }
  return [];
};

export const ImageStudio: React.FC<ImageStudioProps> = ({ onBack, theme = 'dark' }) => {
  const configs = useMemo(readApiConfigs, []);
  const [providerId, setProviderId] = useState(configs.find((item) => item.id === 'openai')?.id || configs[0]?.id || 'openai');
  const [model, setModel] = useState('gpt-image-1');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('写实');
  const [task, setTask] = useState('概念设计');
  const [negativePrompt, setNegativePrompt] = useState('低清晰度、主体变形、重复元素、乱码文字、水印');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('standard');
  const [imageUrl, setImageUrl] = useState('');
  const [revisedPrompt, setRevisedPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const isLight = theme === 'light';

  const selected = configs.find((item) => item.id === providerId) || {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-1',
  };
  const finalPrompt = `${prompt.trim()}\n\n创作任务：${task}。视觉要求：${style}；构图主体清楚；输出比例 ${size}。\n避免：${negativePrompt.trim() || '低清晰度、主体变形、乱码文字、水印'}。`;
  const panelClass = isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-stone-900 border-stone-800 text-stone-100';
  const inputClass = isLight
    ? 'bg-white border-stone-200 text-stone-800 placeholder:text-stone-400'
    : 'bg-stone-950 border-stone-800 text-stone-100 placeholder:text-stone-600';

  const generate = async () => {
    if (!prompt.trim()) return;
    const isLocalEndpoint = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i.test(selected.endpoint);
    if (!selected.apiKey && !isLocalEndpoint) {
      setStatus(`生成失败：请先在“大内系统设置”中为 ${selected.name} 配置 API Key，或选择本地中转站。`);
      return;
    }
    setGenerating(true);
    setStatus('');
    setImageUrl('');
    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: selected.endpoint,
          apiKey: selected.apiKey,
          model,
          prompt: finalPrompt,
          size,
          quality,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      setImageUrl(data.imageUrl);
      setRevisedPrompt(data.revisedPrompt || '');
      setStatus(`生成完成：${selected.name} / ${data.model}`);
    } catch (error: any) {
      setStatus(`生成失败：${error?.message || 'unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full h-full overflow-auto p-5 animate-fadeIn font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${inputClass}`}>
            <ArrowLeft className="w-3.5 h-3.5" /> 返回
          </button>
          <div className="flex items-center gap-2 text-fuchsia-400 text-xs font-bold">
            <ImageIcon className="w-4 h-4" /> AI 图像创作
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
          <section className={`border rounded-xl p-5 space-y-4 ${panelClass}`}>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-stone-500">图像 Provider</span>
              <select value={providerId} onChange={(event) => setProviderId(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs ${inputClass}`}>
                {configs.length ? configs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="openai">OpenAI</option>}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-stone-500">图像模型</span>
              <input value={model} onChange={(event) => setModel(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs ${inputClass}`} />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-stone-500">创作需求</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="描述主体、场景、构图、光线、色彩和用途" className={`w-full rounded-lg border px-3 py-2 text-xs resize-y ${inputClass}`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">创作任务</span>
                <select value={task} onChange={(event) => setTask(event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${inputClass}`}>
                  <option>概念设计</option><option>产品展示</option><option>海报主视觉</option><option>UI 配图</option><option>角色设定</option><option>场景设定</option><option>照片风格化</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">风格</span>
                <select value={style} onChange={(event) => setStyle(event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${inputClass}`}>
                  <option>写实</option><option>电影感</option><option>国风工笔</option><option>水墨</option><option>动漫</option><option>产品渲染</option><option>UI 插画</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">尺寸</span>
                <select value={size} onChange={(event) => setSize(event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${inputClass}`}>
                  <option>1024x1024</option><option>1536x1024</option><option>1024x1536</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-stone-500">质量</span>
                <select value={quality} onChange={(event) => setQuality(event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-xs ${inputClass}`}>
                  <option value="standard">standard</option><option value="high">high</option><option value="low">low</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-stone-500">Negative Prompt</span>
              <textarea value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} rows={3} className={`w-full rounded-lg border px-3 py-2 text-xs resize-y ${inputClass}`} />
            </label>
            <button onClick={generate} disabled={generating || !prompt.trim()} className="w-full px-4 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-stone-950 text-xs font-bold flex items-center justify-center gap-1.5">
              <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? '生成中' : '生成图片'}
            </button>
            {status && <p className="text-[11px] leading-relaxed text-amber-500">{status}</p>}
          </section>

          <section className={`border rounded-xl p-5 min-h-[560px] flex flex-col ${panelClass}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold">生成结果</span>
              {imageUrl && (
                <div className="flex gap-2">
                  <a href={imageUrl} download="cabinet-image.png" className={`p-2 rounded-lg border ${inputClass}`} title="下载图片"><Download className="w-4 h-4" /></a>
                  <a href={imageUrl} target="_blank" rel="noreferrer" className={`p-2 rounded-lg border ${inputClass}`} title="打开原图"><ExternalLink className="w-4 h-4" /></a>
                </div>
              )}
            </div>
            <div className={`flex-1 min-h-[460px] rounded-lg border flex items-center justify-center overflow-hidden ${inputClass}`}>
              {imageUrl ? <img src={imageUrl} alt="AI 生成图片" className="max-w-full max-h-[720px] object-contain" /> : <div className="text-center text-stone-500 text-xs"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />等待生成图片</div>}
            </div>
            {revisedPrompt && <p className="mt-3 text-[10px] text-stone-500 leading-relaxed">{revisedPrompt}</p>}
          </section>
        </div>
      </div>
    </div>
  );
};
