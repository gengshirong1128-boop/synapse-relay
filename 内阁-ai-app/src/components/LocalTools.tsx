/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CabinetMember, VisualModeType } from '../types';
import { 
  Check, X, RefreshCw, Plus, Edit2, Trash2, ArrowLeft, Bot, HelpCircle, 
  Terminal, ShieldCheck, Power, Settings2, Sparkles, Cpu, Radio, AlignLeft, Info
} from 'lucide-react';

interface LocalToolsProps {
  members: CabinetMember[];
  onAddLocalMember: (member: CabinetMember) => void;
  onUpdateMembersList: (members: CabinetMember[]) => void;
  onBack: () => void;
  visualMode: VisualModeType;
  theme?: 'light' | 'dark';
  language?: 'zh' | 'en';
}

export interface LocalDeviceItem {
  id: string;
  name: string;
  localType: string;
  status: 'available' | 'unavailable' | 'unchecked' | 'testing';
  address: string;
  capabilities: string[];
  isCallable: boolean;
  isAuthorized: boolean;
  lastChecked: string;
  errorReason: string;
  badge: string;
  desc: string;
}

const PRESET_DEVICES: LocalDeviceItem[] = [
  {
    id: 'local-ollama',
    name: 'Ollama Service',
    localType: 'Ollama',
    status: 'unchecked',
    address: 'http://localhost:11434',
    capabilities: ['代码补全', '自然语言交互', '离线长推理(CoT)', '代码重构'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: '本地开源模型',
    desc: '提供Llama 3, Qwen 2.5, DeepSeek R1等开源模型的本地加载及流畅运行。'
  },
  {
    id: 'local-lm-studio',
    name: 'LM Studio Engine',
    localType: 'LM Studio',
    status: 'unchecked',
    address: 'http://localhost:1234',
    capabilities: ['OpenAI-compatible接口', '多并发会话调试', '流式解答驱动'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: '模型沙盒后端',
    desc: '高度视觉化的本地模型托管后端，支持单机全功能加载与多卡分配。'
  },
  {
    id: 'local-codex',
    name: 'Codex Dev Assistant',
    localType: 'Codex',
    status: 'unchecked',
    address: 'http://localhost:1990',
    capabilities: ['源码热替换', '项目重构审查', '本地微调加速', 'API测试'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: '高级调试专班',
    desc: '专为内阁系统集成的热部署调试脚本引擎，支持高级操作系统挂钩。'
  },
  {
    id: 'local-claudecode',
    name: 'Claude Code Standalone',
    localType: 'Claude Code',
    status: 'unchecked',
    address: 'http://localhost:3000/api/claudecode',
    capabilities: ['终端审计', '合规检测', '自动漏洞修复', '测试用例开发'],
    isCallable: true,
    isAuthorized: false,
    lastChecked: '',
    errorReason: '尚未授权终端对本窗口的通信总线。',
    badge: '审计/审查专员',
    desc: '命令行交互Agent，专门负责生成漏洞阻断方案及对输出代码提供完整性核查。'
  },
  {
    id: 'local-cursor',
    name: 'Cursor Local Bridge',
    localType: 'Cursor',
    status: 'unchecked',
    address: 'http://localhost:6065',
    capabilities: ['多文件索引', 'AI编辑历史穿梭', '高并发自动修复'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: 'IDE辅助代理',
    desc: 'Cursor编辑器后台联动总线，便于在开朝时直接从编辑器中提取指定修改代码。'
  },
  {
    id: 'local-cline',
    name: 'Cline MCP Gateway',
    localType: 'Cline',
    status: 'unchecked',
    address: 'http://localhost:4567',
    capabilities: ['MCP协议总线', '自主指令链', '本地写文件/读终端'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: 'MCP自主Agent',
    desc: '功能全面的自主本地执行Agent门闸，内置对数十种本地微执行器的联动支持。'
  },
  {
    id: 'local-mcp-server',
    name: 'Local MCP Server Core',
    localType: 'Local MCP Server',
    status: 'unchecked',
    address: 'http://localhost:8500',
    capabilities: ['文件操作', '内置工具链清单', '本地SQLite数据库索引', 'Git集成'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: '工具总线中心',
    desc: '本地模型上下文协议(MCP)宿主，提供诸如本地知识库检索和代码写入服务。'
  },
  {
    id: 'local-openai-gateway',
    name: '本地 OpenAI 兼容 API',
    localType: '本地 OpenAI-compatible API',
    status: 'unchecked',
    address: 'http://localhost:8000/v1',
    capabilities: ['符合标准接口规范', '流式传输支持', '模型热切换支持'],
    isCallable: true,
    isAuthorized: true,
    lastChecked: '',
    errorReason: '',
    badge: '自定义OpenAI网关',
    desc: '用于路由本地方案、OneAPI/NewAPI中转后端或专网私有大模型的规范接入。'
  }
];

export const LocalTools: React.FC<LocalToolsProps> = ({
  members,
  onAddLocalMember,
  onUpdateMembersList,
  onBack,
  visualMode,
  theme = 'dark',
  language = 'zh'
}) => {
  const [devices, setDevices] = useState<LocalDeviceItem[]>(() => {
    const saved = localStorage.getItem('cabinet_local_devices_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return PRESET_DEVICES;
      }
    }
    return PRESET_DEVICES;
  });

  const [activeTab, setActiveTab] = useState<'all' | 'connected' | 'unconnected'>('all');
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<LocalDeviceItem | null>(null);
  const [showCapabilityDetails, setShowCapabilityDetails] = useState<LocalDeviceItem | null>(null);

  // Form Fields for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    localType: 'Ollama',
    address: 'http://localhost:11434',
    capabilities: '',
    badge: '自定义工具',
    desc: '',
    isAuthorized: true
  });

  const isLight = theme === 'light';

  useEffect(() => {
    localStorage.setItem('cabinet_local_devices_v3', JSON.stringify(devices));
  }, [devices]);

  // Single connection test
  const testConnection = async (device: LocalDeviceItem): Promise<LocalDeviceItem> => {
    const start = Date.now();
    const timestamp = new Date().toLocaleTimeString();
    
    // Check if it's Ollama or other local endpoints
    let url = device.address;
    if (device.localType === 'Ollama') {
      url = `${device.address}/api/tags`;
    } else if (device.localType === 'LM Studio') {
      url = `${device.address}/v1/models`;
    } else if (device.localType === '本地 OpenAI-compatible API') {
      url = `${device.address}/models`;
    }

    try {
      // Setup timeout abort controller
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(id);

      if (res.ok || res.status === 200 || res.status === 404 || res.status === 401) {
        return {
          ...device,
          status: 'available',
          isCallable: true,
          lastChecked: timestamp,
          errorReason: ''
        };
      } else {
        return {
          ...device,
          status: 'unavailable',
          isCallable: false,
          lastChecked: timestamp,
          errorReason: `连接异常。服务端返回状态码: ${res.status}`
        };
      }
    } catch (err: any) {
      // CORS block issues often happen. Let's explicitly check and tell the user!
      console.warn('Local tool connect failure, returning customized diagnostics: ', err);

      const isLikelyCors = err.message && (err.message.includes('CORS') || err.message.includes('cors') || err.message.includes('Failed to fetch'));
      let reason = '服务未启动，或端口未开放连接。';
      if (isLikelyCors) {
        reason = `CORS 跨域阻断。请配置该服务允许跨域接入。例如：启动 Ollama 时，请在环境变量加设 OLLAMA_ORIGINS="*"；LM Studio 请在设置页中勾选 "Enable CORS"。`;
      }

      return {
        ...device,
        status: 'unavailable',
        isCallable: false,
        lastChecked: timestamp,
        errorReason: reason
      };
    }
  };

  const handleTestConnection = async (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'testing' as const } : d));
    const target = devices.find(d => d.id === id);
    if (!target) return;

    const result = await testConnection(target);
    setDevices(prev => prev.map(d => d.id === id ? result : d));
  };

  const handleScanAll = async () => {
    setIsRefreshingAll(true);
    setDevices(prev => prev.map(d => ({ ...d, status: 'testing' as const })));

    const promises = devices.map(async (d) => {
      return await testConnection(d);
    });

    const results = await Promise.all(promises);
    setDevices(results);
    setIsRefreshingAll(false);
  };

  // CRUD commands
  const handleAddNewDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) return;

    const newDevice: LocalDeviceItem = {
      id: 'local-custom-' + Math.random().toString(36).substring(7),
      name: formData.name,
      localType: formData.localType,
      status: 'unchecked',
      address: formData.address,
      capabilities: formData.capabilities.split(/[，,]/).map(c => c.trim()).filter(Boolean),
      isCallable: true,
      isAuthorized: formData.isAuthorized,
      lastChecked: '',
      errorReason: '',
      badge: formData.badge,
      desc: formData.desc || '手动注册的本地连接助理工具。'
    };

    setDevices(prev => [newDevice, ...prev]);
    setShowAddModal(false);
    resetForm();
  };

  const handleStartEdit = (device: LocalDeviceItem) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      localType: device.localType,
      address: device.address,
      capabilities: device.capabilities.join(', '),
      badge: device.badge,
      desc: device.desc,
      isAuthorized: device.isAuthorized
    });
    setShowAddModal(true);
  };

  const handleConfirmEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;

    setDevices(prev => prev.map(d => {
      if (d.id === editingDevice.id) {
        return {
          ...d,
          name: formData.name,
          localType: formData.localType,
          address: formData.address,
          capabilities: formData.capabilities.split(/[，,]/).map(c => c.trim()).filter(Boolean),
          badge: formData.badge,
          desc: formData.desc,
          isAuthorized: formData.isAuthorized
        };
      }
      return d;
    }));

    setShowAddModal(false);
    setEditingDevice(null);
    resetForm();
  };

  const handleDeleteDevice = (id: string) => {
    if (confirm('确认要删除此本地工具检测配置吗？')) {
      setDevices(prev => prev.filter(d => d.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      localType: 'Ollama',
      address: 'http://localhost:11434',
      capabilities: '',
      badge: '自定义工具',
      desc: '',
      isAuthorized: true
    });
  };

  // Collaboration links: Mount as Cabinet Member
  const registerAsCabinetMember = (device: LocalDeviceItem, role: 'pm' | 'sg' | 'none', ministry: CabinetMember['ministry'] = 'none') => {
    // Generate corresponding CabinetMember structure
    const avatarMap: Record<string, string> = {
      'Ollama': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAn6mAg3rNe2VmjOj7nE8_oirPalrPiBSEZrRP0GGbKvoWM5T4EODqFXvcRVjLeS4dTGS_rPoaD0BLwrgpKKQbuD3BNmnJJFexVOfb3YqFMx523PCi7YXETWQ0b17zs4rSErZAfx925lKT8Wsf7dsbFmCberN_rfZoA3MNBS9iF1Prxd9yXfKT8UIgy0F4mgbCqHGjSgJNHF7F2jhMETIuzxLmHVfKKSw85v-2rdExVbUakWbK1n4ImLxNzt6DedltS4dIHMKDZQtQ',
      'LM Studio': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBg5T6819Ag5OTby-VZSzDo0mf-Gnl1ESaOF6pR5G6hU9V0KONWtvA1pr1SMG_ZtQgATpk6U1zCIx94Uqf1kgJCrxHipCowdPRsoL6Yqk4ywSSdE5JCBhn2k8XOv17FcOPHJHjIPy1JR-o9s-oAFhFgwFu-6We-Hu3tltVxuwVylC-4bW4WwmTwSrGVbNoq5A0EyN3IEYZH3MtBJjsmHqIYkstyTtmcPD3AJ8H4pYu_XskqgmnL-tqhmoS4Y3LYFnp5PH5pQiO_nhg',
      'Claude Code': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJQyT7HJoLLvQtYjm9SYYNmvPaP-r30oBJ-sdvhg4127p0rKQ16Q1LoRy1s7N1cmWRY7cVBzZN2dvhvnKoQi31e0-zjqNRYZRCoxTgm0J5fWtPjSwuMySPX6kxKqnZnD-_bcMM8zWKUOI92XPAZrxdHMuY5JenAm5xyjtgyoD8IbIcP2pKA-YxIPJ3Mc8Bu6HV5Q7ms5mGPOhzq9wIyRGO1BrDagwzVXduuboEvDDVcIUBJ3ChiNkmY7lQ1xtBiMMI0GJwfpt6To8',
      'Codex': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBdh2q97JKJtQi9Rt0RNq6WpuWEDH1-jiYuw_FUpnYS46pHeR-ZrLXf7VHzYMFKbc-1o-XO8_VkigtAgRpf5VcvYaLyDSJDKxrld61wUQa21zbppYanE9G7ebeO8o8X1dRjoMiUsx3ydAn-vCQmmSeJXj7wJZ1JwdWejh9jtLV_gNNsqEHdTVIrboi1paxu7xcrWneKXZ8iU13rBWakoExfDOFhBiRfz5ziiaJUHiwkgRGevJogGu4aVkSN2XUoYCpjEy45JioFwAA'
    };

    const isExist = members.some(m => m.id === device.id);
    const newMember: CabinetMember = {
      id: device.id,
      name: `${device.name}`,
      avatar: avatarMap[device.localType] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuB64vO2Y9w4r2T9e8zI0UlyWPu7pG_e67uH81k0J7I9N1X8J0s8Y8mK8H8J8s8W8-W8r7T4e_5gY1_eW3L-UpyG8J9_T6V8W9A',
      type: 'tool',
      selected: true,
      role: role,
      ministry: ministry,
      badge: device.badge,
      desc: device.desc,
      isLocal: true,
      localUrl: device.address,
      localType: device.localType,
      capabilities: device.capabilities,
      authorized: device.isAuthorized,
      lastChecked: device.lastChecked || new Date().toLocaleTimeString()
    };

    if (isExist) {
      // Modify role/ministry
      const updated = members.map(m => m.id === device.id ? { ...newMember, avatar: m.avatar } : m);
      if (role !== 'none') {
        // clear old PM of same role
        const cleared = updated.map(m => m.id !== device.id && m.role === role ? { ...m, role: 'none' as const } : m);
        onUpdateMembersList(cleared);
      } else {
        onUpdateMembersList(updated);
      }
    } else {
      // Add or update
      onAddLocalMember(newMember);
    }
  };

  const filteredDevices = devices.filter(d => {
    if (activeTab === 'connected') return d.status === 'available';
    if (activeTab === 'unconnected') return d.status === 'unavailable' || d.status === 'unchecked';
    return true;
  });

  return (
    <div className={`w-full max-w-7xl mx-auto py-8 px-5 animate-fadeIn font-sans ${isLight ? 'text-stone-800 bg-transparent' : 'text-stone-200 bg-transparent'}`}>
      
      {/* Header section with back btn */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b shrink-0 ${isLight ? 'border-stone-200' : 'border-stone-800'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              isLight 
                ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700' 
                : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-400'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{visualMode === 'cabinet' ? '返回廷议会商' : '返回廷议会商'}</span>
          </button>
          
          <div>
            <h1 className={`text-xl font-extrabold font-display flex items-center gap-2 ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>
              <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
              <span>{visualMode === 'cabinet' ? '大内本地工具检测总台' : '本地工具检测总台'}</span>
            </h1>
            <p className={`text-xs mt-1 ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              自动或手动侦读您电脑上运行的 Ollama, LM Studio, Cline, Claude Code, 本地 MCP 等，将其作为“阁臣”召入会审。
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleScanAll}
            disabled={isRefreshingAll}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all duration-300 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
            <span>{isRefreshingAll ? '正在扫描设备...' : '一键检测本地工具'}</span>
          </button>

          <button
            onClick={() => { resetForm(); setEditingDevice(null); setShowAddModal(true); }}
            className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
              isLight
                ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-705'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-850 text-stone-300 hover:text-stone-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>手动添加工具</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu rows */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pb-2">
        <div className={`flex gap-1.5 border p-1.5 rounded-xl max-w-xs text-xs font-mono ${
          isLight ? 'border-stone-200 bg-stone-100/60' : 'border-stone-800 bg-stone-950/20'
        }`}>
          <button onClick={() => setActiveTab('all')} className={`px-3.5 py-1 rounded-lg transition cursor-pointer ${activeTab === 'all' ? 'bg-amber-600/10 text-amber-600 border border-amber-600/20 font-bold' : (isLight ? 'text-stone-500 hover:text-stone-800 border border-transparent' : 'text-stone-500 hover:text-stone-300 border border-transparent')}`}>全部 ({devices.length})</button>
          <button onClick={() => setActiveTab('connected')} className={`px-3.5 py-1 rounded-lg transition cursor-pointer ${activeTab === 'connected' ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 font-bold' : (isLight ? 'text-stone-500 hover:text-stone-800 border border-transparent' : 'text-stone-500 hover:text-stone-300 border border-transparent')}`}>可用 ({devices.filter(d => d.status === 'available').length})</button>
          <button onClick={() => setActiveTab('unconnected')} className={`px-3.5 py-1 rounded-lg transition cursor-pointer ${activeTab === 'unconnected' ? (isLight ? 'bg-stone-200/80 text-stone-700 border border-stone-300 font-bold' : 'bg-stone-850 text-stone-400 font-bold') : (isLight ? 'text-stone-500 hover:text-stone-800 border border-transparent' : 'text-stone-500 hover:text-stone-300 border border-transparent')}`}>未检/不可用 ({devices.filter(d => d.status !== 'available').length})</button>
        </div>

        <div className={`text-[10px] font-mono flex items-center gap-1.5 ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>本地连接完全运行于同机环沙盒。数据无需流出外网，绝不涉及敏感文件。</span>
        </div>
      </div>

      {/* Grid of tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {filteredDevices.map((device) => {
          const isRegistered = members.some(m => m.id === device.id && m.selected);
          
          return (
            <div 
              key={device.id}
              className={`rounded-2xl p-5 border transition-all duration-350 flex flex-col justify-between h-72 shadow ${
                isLight 
                  ? 'bg-stone-50/70 border-stone-200 hover:shadow-md' 
                  : 'bg-stone-900 border-stone-850 hover:border-stone-800 shadow-stone-950/20'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-stone-200' : 'bg-stone-950 border-stone-800'}`}>
                      <Terminal className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className={`text-xs font-bold leading-none font-display ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>
                        {device.name}
                      </h3>
                      <span className="text-[9px] text-amber-500 font-bold font-mono uppercase tracking-wider block mt-1">
                        {device.localType}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex flex-col items-end gap-1 font-mono text-[9px]">
                    {device.status === 'available' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600/10 text-emerald-500 font-bold border border-emerald-600/10 font-mono">可用</span>
                    )}
                    {device.status === 'unavailable' && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600/10 text-rose-500 font-bold border border-rose-600/10 font-mono">不可用</span>
                    )}
                    {device.status === 'testing' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-600/10 text-amber-500 font-bold border border-amber-600/10 animate-pulse font-mono">检测中</span>
                    )}
                    {device.status === 'unchecked' && (
                      <span className={`px-2 py-0.5 rounded-full font-bold ${isLight ? 'bg-stone-100 text-stone-400 border border-stone-200' : 'bg-stone-800 text-stone-500 border border-transparent'}`}>未连接</span>
                    )}
                    {device.lastChecked && (
                      <span className="text-stone-600 scale-90">{device.lastChecked}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 my-3 text-[11px] font-sans">
                  <p className={`line-clamp-2 leading-relaxed text-[11px] ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>
                    {device.desc}
                  </p>
                  
                  <div className={`p-1.5 rounded-lg border text-[10px] font-mono select-all shrink-0 ${
                    isLight ? 'bg-white border-stone-200 text-stone-600' : 'bg-stone-950 border-stone-850 text-stone-400'
                  }`}>
                    地址: <strong className="font-bold">{device.address}</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Action controllers */}
              <div>
                
                {/* Trouble error text block */}
                {device.errorReason && (
                  <div className="mb-2 p-1.5 rounded bg-rose-950/10 text-rose-500 border border-rose-900/20 text-[9px] leading-relaxed font-mono font-bold max-h-12 overflow-y-auto">
                    ⚠️ {device.errorReason}
                  </div>
                )}

                <div className={`flex items-center justify-between border-t pt-3 gap-2 ${isLight ? 'border-stone-200' : 'border-stone-850'}`}>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleTestConnection(device.id)}
                      className={`p-1 px-2.5 text-[10px] font-mono rounded-lg transition cursor-pointer font-bold border ${isLight ? 'bg-white border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100' : 'bg-stone-950 border-stone-800 text-stone-300 hover:text-stone-100'}`}
                      title="单独测试服务连通性"
                    >
                      测试
                    </button>
                    <button
                      onClick={() => handleStartEdit(device)}
                      className={`p-1 px-1.5 text-[10px] rounded transition cursor-pointer ${isLight ? 'hover:bg-stone-100 text-stone-500 hover:text-stone-800' : 'hover:bg-stone-800 text-stone-400 hover:text-stone-100'}`}
                      title="修改连接及描述"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className={`p-1 px-1.5 text-[10px] rounded transition cursor-pointer hover:text-rose-500 ${isLight ? 'hover:bg-stone-100 text-stone-400' : 'text-stone-400 hover:bg-rose-950/10'}`}
                      title="删除该条设备记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-1 text-[10px] font-mono">
                    <button
                      onClick={() => { setShowCapabilityDetails(device); }}
                      className={`px-2 py-1 rounded font-bold cursor-pointer transition ${isLight ? 'hover:bg-stone-100 text-stone-550 hover:text-stone-800' : 'hover:bg-stone-850 text-stone-300 hover:text-white'}`}
                    >
                      能力
                    </button>

                    <button
                      onClick={() => registerAsCabinetMember(device, 'none')}
                      className={`px-3 py-1 font-bold rounded-xl shadow cursor-pointer border ${
                        isRegistered
                          ? 'bg-amber-600/15 text-amber-500 border-amber-600/20'
                          : 'bg-amber-600 hover:bg-amber-500 text-stone-950 border-amber-600 hover:scale-[1.01]'
                      }`}
                    >
                      {isRegistered ? '已在大臣列' : '钦点为大臣'}
                    </button>

                    {device.status === 'available' && (
                      <button
                        onClick={() => registerAsCabinetMember(device, visualMode === 'cabinet' ? 'pm' : 'sg')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold cursor-pointer border border-indigo-700 hidden sm:block font-mono"
                        title={visualMode === 'cabinet' ? '命此本地服务为领衔首辅' : '命此本地服务为领衔首辅'}
                      >
                        首辅
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Modal windows for capability detail views */}
      {showCapabilityDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className={`border rounded-3xl p-6 max-w-md w-full relative space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-stone-200 text-stone-805' : 'bg-stone-900 border-stone-800 text-stone-200'
          }`}>
            <button 
              onClick={() => setShowCapabilityDetails(null)} 
              className={`absolute top-4 right-4 text-sm font-bold p-1 rounded-lg transition-colors ${
                isLight ? 'text-stone-400 hover:text-stone-800 hover:bg-stone-100' : 'text-stone-500 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              ×
            </button>
            <div className="flex items-center gap-3">
              <Bot className="w-6 h-6 text-amber-500" />
              <div>
                <h3 className={`text-sm font-black font-display ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>{showCapabilityDetails.name}</h3>
                <span className={`text-[10px] font-mono ${isLight ? 'text-stone-450' : 'text-stone-500'}`}>接口性能与可用技术栈列表</span>
              </div>
            </div>
            
            <p className={`text-xs leading-relaxed font-sans mt-2 ${isLight ? 'text-stone-600' : 'text-stone-400'}`}>{showCapabilityDetails.desc}</p>

            <div className="space-y-2">
              <h4 className={`text-[10px] font-mono uppercase tracking-wider pb-1.5 border-b font-bold ${isLight ? 'text-stone-500 border-stone-150' : 'text-stone-500 border-stone-800'}`}>已授权支持核心能力：</h4>
              <div className="flex flex-wrap gap-2 pt-1">
                {showCapabilityDetails.capabilities.map((cap, i) => (
                  <span key={i} className={`px-2 py-1 text-[10px] font-mono rounded-lg border font-semibold ${
                    isLight ? 'bg-stone-100 text-emerald-700 border-stone-200' : 'bg-stone-950 text-emerald-400 border-stone-850'
                  }`}>
                    ✓ {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className={`p-3 border rounded-xl text-[10px] font-mono leading-relaxed space-y-1 ${
              isLight ? 'bg-stone-50 border-stone-150 text-stone-550' : 'bg-stone-950/80 border-stone-850 text-stone-450'
            }`}>
              <div>通信协议: <strong className={isLight ? 'text-stone-850' : 'text-stone-300'}>{showCapabilityDetails.localType} RESTful</strong></div>
              <div>连接通道: <strong className="text-amber-500 select-all">{showCapabilityDetails.address}</strong></div>
              <div>安全审计状态: <span className="text-emerald-500 font-bold">✓ 内卷沙盒隔离 (安全)</span></div>
            </div>
          </div>
        </div>
      )}

      {/* MANUALLY CONFIG ADD MODAL */}
      {showAddModal && (
        <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>
          <div className={`border rounded-3xl p-6 max-w-lg w-full relative space-y-5 shadow-2xl ${
            isLight ? 'bg-white border-stone-200' : 'bg-stone-900 border-stone-800'
          }`}>
            <button 
              onClick={() => { setShowAddModal(false); setEditingDevice(null); }} 
              className={`absolute top-4 right-4 text-sm font-bold p-1 rounded-lg transition-colors ${
                isLight ? 'text-stone-400 hover:text-stone-800 hover:bg-stone-100' : 'text-stone-505 hover:text-stone-200 hover:bg-stone-850'
              }`}
            >
              ×
            </button>
            
            <div className={`border-b pb-2 ${isLight ? 'border-stone-150' : 'border-stone-850'}`}>
              <h3 className="text-sm font-black font-display text-amber-500 uppercase tracking-widest">
                {editingDevice ? '✒️ 编辑本地连接参数' : '➕ 注册新本地 Agent / 助理连接'}
              </h3>
              <p className={`text-[10px] mt-1 leading-relaxed ${isLight ? 'text-stone-500' : 'text-stone-450'}`}>
                添加运行于您开发机上的 API 中转或自定义 Agent 宿主。
              </p>
            </div>

            <form onSubmit={editingDevice ? handleConfirmEdit : handleAddNewDevice} className="space-y-4 text-xs font-sans">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>工具显示名称 / Display Name</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="例: DeepSeek 本地网关"
                    className={`w-full rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 border ${
                      isLight 
                        ? 'bg-stone-50 border-stone-200 text-stone-800 focus:border-amber-500' 
                        : 'bg-stone-950 border-stone-800 text-stone-200 focus:border-amber-600 focus:ring-amber-600'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>网关类目 / Core Type</label>
                  <select 
                    value={formData.localType} 
                    onChange={e => setFormData({...formData, localType: e.target.value, address: e.target.value === 'Ollama' ? 'http://localhost:11434' : e.target.value === 'LM Studio' ? 'http://localhost:1234' : formData.address})}
                    className={`w-full rounded-xl p-2.5 focus:outline-none border ${
                      isLight
                        ? 'bg-stone-50 border-stone-200 text-stone-800'
                        : 'bg-stone-950 border-stone-800 text-stone-200'
                    }`}
                  >
                    <option value="Ollama">Ollama API</option>
                    <option value="LM Studio">LM Studio API</option>
                    <option value="Claude Code">Claude Code Bridge</option>
                    <option value="Cursor">Cursor Linker</option>
                    <option value="Local MCP Server">Local MCP Server</option>
                    <option value="本地 OpenAI-compatible API">OpenAI-compatible Entry</option>
                    <option value="本地 Anthropic-compatible Gateway">Anthropic-compatible Entry</option>
                    <option value="Custom">Custom Agent Gateway</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>本地 API 通道接口地址 / HTTP URL</label>
                <input 
                  type="text" 
                  required 
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="http://localhost:11434"
                  className={`w-full rounded-xl p-2.5 focus:outline-none border ${
                    isLight 
                      ? 'bg-stone-50 border-stone-200 text-stone-800' 
                      : 'bg-stone-950 border-stone-800 text-stone-200'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>已开启能力集 (Comma split)</label>
                <input 
                  type="text" 
                  value={formData.capabilities} 
                  onChange={e => setFormData({...formData, capabilities: e.target.value})}
                  placeholder="代码重构, 异常审查, 安全分析..."
                  className={`w-full rounded-xl p-2.5 focus:outline-none border ${
                    isLight 
                      ? 'bg-stone-50 border-stone-200 text-stone-800' 
                      : 'bg-stone-950 border-stone-800 text-stone-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>卡片徽章 / Badge</label>
                  <input 
                    type="text" 
                    value={formData.badge} 
                    onChange={e => setFormData({...formData, badge: e.target.value})}
                    placeholder="本地审查端"
                    className={`w-full rounded-xl p-2.5 focus:outline-none border ${
                      isLight 
                        ? 'bg-stone-50 border-stone-200 text-stone-800' 
                        : 'bg-stone-950 border-stone-800 text-stone-200'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>安全授权开启</label>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="isAuthorized"
                      checked={formData.isAuthorized} 
                      onChange={e => setFormData({...formData, isAuthorized: e.target.checked})}
                      className={`rounded w-4 h-4 text-emerald-650 focus:ring-transparent ${
                        isLight ? 'border-stone-300 bg-white' : 'border-stone-800 bg-stone-950'
                      }`}
                    />
                    <label htmlFor="isAuthorized" className={`font-mono scale-95 cursor-pointer ${isLight ? 'text-stone-600 font-semibold' : 'text-stone-400'}`}>授权云端/内阁读取本地分析参数</label>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-mono uppercase mb-1.5 font-bold ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>详细功能描述 / Summary Description</label>
                <textarea 
                  value={formData.desc} 
                  onChange={e => setFormData({...formData, desc: e.target.value})}
                  rows={2}
                  maxLength={120}
                  placeholder="请输入对本地助理职能的规划介绍（例：针对本地React代码结构进行极高精度的AST还原分析）。"
                  className={`w-full rounded-xl p-2.5 focus:outline-none resize-none border ${
                    isLight 
                      ? 'bg-stone-50 border-stone-200 text-stone-800 focus:border-amber-500 font-sans' 
                      : 'bg-stone-950 border-stone-800 text-stone-200 focus:border-amber-600 focus:ring-amber-600 font-sans'
                  }`}
                />
              </div>

              <div className={`pt-2 flex justify-end gap-3.5 border-t ${isLight ? 'border-stone-150' : 'border-stone-850'}`}>
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); setEditingDevice(null); }}
                  className={`px-5 py-2.5 rounded-xl border font-bold font-mono text-xs cursor-pointer ${
                    isLight 
                      ? 'border-stone-200 hover:bg-stone-100 text-stone-600' 
                      : 'border-stone-800 hover:bg-stone-850 hover:text-stone-100 text-stone-300'
                  }`}
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{editingDevice ? '确认保存修改' : '确认钦召加入'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
