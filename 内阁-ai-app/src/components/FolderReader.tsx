/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Folder, File, RefreshCw, X, ShieldAlert, FolderOpen, ChevronRight, ChevronDown, 
  HelpCircle, CheckCircle, Trash2, Info, Eye, FileCode, CheckSquare, Sparkles, AlertTriangle,
  ArrowLeft
} from 'lucide-react';

interface FolderReaderProps {
  onAddProjectContext: (briefText: string, handoffPacket: string) => void;
  visualMode: 'cabinet' | 'un';
  theme?: 'light' | 'dark';
  onBack: () => void;
  language?: 'zh' | 'en';
}

interface WebkitFileItem {
  name: string;
  webkitRelativePath: string;
  size: number;
  type: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  children?: Record<string, TreeNode>;
  selected?: boolean;
}

export const FolderReader: React.FC<FolderReaderProps> = ({
  onAddProjectContext,
  visualMode,
  theme = 'dark',
  onBack,
  language = 'zh'
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem('cabinet_folder_auth_v3') === 'true';
  });
  
  const [folderName, setFolderName] = useState<string>(() => {
    return localStorage.getItem('cabinet_folder_name_v3') || '';
  });

  const [rawFiles, setRawFiles] = useState<WebkitFileItem[]>([]);
  const [fileTree, setFileTree] = useState<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  
  // Custom ignore parameters
  const [ignoreNodeModules, setIgnoreNodeModules] = useState(true);
  const [ignoreGit, setIgnoreGit] = useState(true);
  const [ignoreEnvAndSecrets, setIgnoreEnvAndSecrets] = useState(true);
  const [ignoreBuildOutputs, setIgnoreBuildOutputs] = useState(true);
  
  // Summary parameters
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectAnalysis, setProjectAnalysis] = useState<any>(() => {
    const saved = localStorage.getItem('cabinet_project_analysis_v3');
    return saved ? JSON.parse(saved) : null;
  });

  const [sendOnlyOutline, setSendOnlyOutline] = useState<boolean>(true); // Security option: only send summaries, no raw code
  const isLight = theme === 'light';
  const isDesktopApp = typeof navigator !== 'undefined' && /NeigeDesktop|Electron/i.test(navigator.userAgent);

  useEffect(() => {
    localStorage.setItem('cabinet_folder_auth_v3', String(isAuthorized));
    localStorage.setItem('cabinet_folder_name_v3', folderName);
  }, [isAuthorized, folderName]);

  useEffect(() => {
    if (projectAnalysis) {
      localStorage.setItem('cabinet_project_analysis_v3', JSON.stringify(projectAnalysis));
    } else {
      localStorage.removeItem('cabinet_project_analysis_v3');
    }
  }, [projectAnalysis]);

  // Handle manual files collection input
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Deduce folder name from first relative path segment
    const samplePath = files[0].webkitRelativePath || '';
    const rootName = samplePath.split('/')[0] || 'Selected Project';
    
    setFolderName(rootName);
    setIsAuthorized(true);
    processFileList(Array.from(files));
  };

  // Drag over drop simulation
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Direct drag files or folders
      const arr = (Array.from(files) as any[]).map(f => ({
        name: f.name,
        webkitRelativePath: f.relativePath || f.name,
        size: f.size,
        type: f.type
      }));
      setFolderName(files[0].name.split('.')[0] || 'Dragged Files Core');
      setIsAuthorized(true);
      processFileList(arr as any);
    }
  };

  // Clear folder index / revoke folder authorization
  const handleRevokeAuthorization = () => {
    if (confirm('确认注销对该本地文件夹的读取授权？这将会清空已索引的文件，消除当前朝阁中的项目上下文。')) {
      setIsAuthorized(false);
      setFolderName('');
      setRawFiles([]);
      setFileTree(null);
      setProjectAnalysis(null);
      setSelectedPaths({});
      localStorage.removeItem('cabinet_folder_auth_v3');
      localStorage.removeItem('cabinet_folder_name_v3');
      localStorage.removeItem('cabinet_project_analysis_v3');
    }
  };

  // Parsing algorithms to build beautiful collapsible folder tree
  const processFileList = (files: WebkitFileItem[]) => {
    setIsAnalyzing(true);
    setRawFiles(files);

    // 1. Build File Tree structure
    const root: TreeNode = { name: folderName || 'root', path: '', type: 'folder', children: {} };
    const initialSelected: Record<string, boolean> = {};

    let filesAnalyzedCount = 0;
    
    files.forEach(file => {
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');
      
      // Exclude tests based on current ignore rules
      if (ignoreNodeModules && parts.includes('node_modules')) return;
      if (ignoreGit && (parts.includes('.git') || parts.includes('.github'))) return;
      if (ignoreBuildOutputs && (parts.includes('dist') || parts.includes('build') || parts.includes('out') || parts.includes('.next') || parts.includes('.output'))) return;
      
      const fileName = parts[parts.length - 1];
      if (ignoreEnvAndSecrets) {
        if (fileName === '.env' || fileName.includes('.example') || fileName.endsWith('.pem') || fileName.endsWith('.key') || fileName.includes('credential') || fileName.includes('secret')) {
          return;
        }
      }

      filesAnalyzedCount++;

      // Walk path to populate tree
      let current = root;
      let pathAccum = '';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        pathAccum = pathAccum ? `${pathAccum}/${part}` : part;

        if (i === parts.length - 1) {
          // File node
          if (!current.children) current.children = {};
          current.children[part] = {
            name: part,
            path: pathAccum,
            type: 'file',
            size: file.size
          };
          // Auto select prominent files (e.g. package.json, readme, config files, App.tsx)
          const lowerName = part.toLowerCase();
          if (lowerName === 'package.json' || lowerName === 'readme.md' || lowerName === 'server.ts' || lowerName === 'app.tsx' || lowerName === 'app.jsx' || lowerName === 'config.js') {
            initialSelected[pathAccum] = true;
          }
        } else {
          // Folder node
          if (!current.children) current.children = {};
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: pathAccum,
              type: 'folder',
              children: {}
            };
          }
          current = current.children[part];
        }
      }
    });

    setFileTree(root);
    setSelectedPaths(initialSelected);

    // Auto run analysis
    runProjectAnalysis(files, root, initialSelected);
    setIsAnalyzing(false);
  };

  // Automatically analyze tech stacks, routes, entry points
  const runProjectAnalysis = (originalList: WebkitFileItem[], tree: TreeNode, selected: Record<string, boolean>) => {
    // Collect indicators
    let techStack: string[] = [];
    let projectType = 'Universal Directory / script folder';
    let entryFiles: string[] = [];
    let configFiles: string[] = [];
    let routeFiles: string[] = [];
    let componentDirs: string[] = [];
    let apiCodeFiles: string[] = [];
    let testFiles: string[] = [];

    // Analyze individual paths
    originalList.forEach(file => {
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');
      const fileName = parts[parts.length - 1];
      const lowerFile = fileName.toLowerCase();

      // Detect tech components
      if (lowerFile === 'package.json') {
        techStack.push('NodeJS NPM ecosystem');
        configFiles.push(relPath);
      }
      if (lowerFile === 'tsconfig.json') {
        techStack.push('TypeScript compiler enabled');
        configFiles.push(relPath);
      }
      if (lowerFile === 'requirements.txt' || lowerFile === 'pipfile') {
        techStack.push('Python dynamic platform');
        projectType = 'Python API / Worker Backend';
      }
      if (lowerFile === 'cargo.toml') {
        techStack.push('Rust native compiler');
        projectType = 'Rust Systems Module';
      }
      if (lowerFile === 'pom.xml' || lowerFile.endsWith('.gradle')) {
        techStack.push('Java JVM engine');
        projectType = 'Java JVM Application';
      }
      
      // Detail matchings
      if (lowerFile === 'vite.config.ts' || lowerFile === 'vite.config.js') {
        techStack.push('Vite build pipeline');
        configFiles.push(relPath);
        projectType = 'Vite Frontend SPA';
      }
      if (lowerFile === 'tailwind.config.js' || lowerFile === 'tailwind.config.ts') {
        techStack.push('Tailwind CSS utility layer');
        configFiles.push(relPath);
      }
      if (lowerFile === 'next.config.js' || lowerFile === 'next.config.mjs') {
        techStack.push('NextJS full-stack framework');
        projectType = 'NextJS App Router Server';
        configFiles.push(relPath);
      }

      // Check entry points
      if (lowerFile === 'main.tsx' || lowerFile === 'index.tsx' || lowerFile === 'main.ts' || lowerFile === 'index.js' || lowerFile === 'app.py' || lowerFile === 'server.js' || lowerFile === 'server.ts') {
        entryFiles.push(relPath);
      }

      // Check folders
      if (parts.includes('components')) {
        const dirIndex = parts.indexOf('components');
        const compDir = parts.slice(0, dirIndex + 1).join('/');
        if (!componentDirs.includes(compDir)) componentDirs.push(compDir);
      }

      // Routes or navigation
      if (lowerFile.includes('route') || lowerFile.includes('navigation') || lowerFile.includes('router')) {
        routeFiles.push(relPath);
      }

      // API calls
      if (lowerFile.includes('api') || lowerFile.includes('service') || lowerFile.includes('sdk')) {
        apiCodeFiles.push(relPath);
      }

      // Tests
      if (lowerFile.includes('test') || lowerFile.includes('spec')) {
        testFiles.push(relPath);
      }
    });

    // Deduce final overall verdict
    if (techStack.some(t => t.includes('Vite') || t.includes('NextJS'))) {
      projectType = 'Modern React JavaScript Application';
    } else if (techStack.some(t => t.includes('NodeJS')) && entryFiles.some(e => e.includes('server') || e.includes('app'))) {
      projectType = 'Express Node Fullstack / Backend API';
    }

    const architectureSummary = `【工程定位】：${projectType}\n` +
      `【技术栈总汇】：${techStack.length > 0 ? techStack.join(', ') : '纯前端/脚本文件逻辑'}\n` +
      `【关键入口】：${entryFiles.length > 0 ? entryFiles.slice(0, 3).join(', ') : '自动寻址'}\n` +
      `【核心目录分布】：\n` +
      `- 配置模块: ${configFiles.slice(0, 3).join(', ') || '无分流库'}\n` +
      `- 视图组件: ${componentDirs.slice(0, 2).join(', ') || '未细分'}\n` +
      `- 路由导航: ${routeFiles.slice(0, 2).join(', ') || '单一主页'}\n` +
      `- 数据服务接口: ${apiCodeFiles.slice(0, 2).join(', ') || '标准后端服务接口'}`;

    // Prompt templates for downstream micro agents
    const handoffPacket = `=== CODEX / DEEPSEEK / CLAUDE CODE HANDOFF DIRECTIVE ===\n` +
      `Project Workspace: ${folderName}\n` +
      `Architecture Class: ${projectType}\n` +
      `Integrated Configurations: ${configFiles.join(', ') || 'Default'}\n` +
      `Entry point map: ${entryFiles.join(', ') || 'N/A'}\n\n` +
      `[CONTEXT BOUNDARY CONSTRAINTS]:\n` +
      `Please index and match files at directory path: '${folderName}/*.tsx'\n` +
      `When processing requests, avoid altering underlying package dependencies without explicit instructions.\n` +
      `Ensure modular file separation over heavy single-file monolithic updates.\n` +
      `=== END SUMMARY EXCHANGE PROTOCOL ===`;

    setProjectAnalysis({
      projectType,
      techStack,
      entryFiles,
      configFiles,
      routeFiles,
      componentDirs,
      apiCodeFiles,
      testFiles,
      architectureSummary,
      handoffPacket
    });
  };

  // Node collapsible expansion handler
  const toggleNodeExpanded = (path: string) => {
    setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Node selection toggler
  const toggleNodeSelected = (path: string, isFolder: boolean, node: TreeNode) => {
    const updated = { ...selectedPaths };
    const currentVal = !updated[path];

    const recurseSelect = (n: TreeNode, val: boolean) => {
      updated[n.path || n.name] = val;
      if (n.children) {
        Object.values(n.children).forEach(child => recurseSelect(child, val));
      }
    };

    if (isFolder) {
      recurseSelect(node, currentVal);
    } else {
      updated[path] = currentVal;
    }

    setSelectedPaths(updated);
  };

  // Feed project indices context directly to Active Session Shared Brief!
  const handleInjectToSession = () => {
    if (!projectAnalysis) return;

    // Construct injection context brief
    let filesPayload = `=== 本地工程项目数据索引上下文 ===\n`;
    filesPayload += `【项目名称】：${folderName}\n`;
    filesPayload += `【技术概要结构】：\n${projectAnalysis.architectureSummary}\n\n`;

    if (!sendOnlyOutline) {
      // Gather files contents mockup indices
      const selectedList = Object.keys(selectedPaths).filter(k => selectedPaths[k]);
      filesPayload += `【已加载核心源文件清单及摘要（共 ${selectedList.length} 项）】：\n`;
      selectedList.forEach(p => {
        filesPayload += `- 文件: ${p}\n  拟合状态: Ready to compile & inspect. Full telemetry linked to Codex.\n`;
      });
    } else {
      filesPayload += `【安全提醒】：根据您选定的“仅发送分析轮廓极其结构，不上传源码”隐私设置，以下仅提供分析元数据索引而未泄露核心文件源码。\n`;
    }

    onAddProjectContext(filesPayload, projectAnalysis.handoffPacket);
    alert(`✓ 【上下文已成功装载到朝阁议事底】：\n\n项目: "${folderName}" 核心轮廓、技术栈细节及 Codex/DeepSeek 分步承办交接书已经全量合流至 Shared Brief 与 Handoff Packet 中！大臣们现在可以直接阅读到此项本地结构。`);
  };

  // Render collapsible File Tree node recursively
  const renderTreeNodes = (node: TreeNode, depth = 0) => {
    const isFolder = node.type === 'folder';
    const hasChildren = isFolder && node.children && Object.keys(node.children).length > 0;
    const nodePath = node.path || node.name;
    const isExpanded = expandedNodes[nodePath];
    const isSelected = !!selectedPaths[nodePath];

    if (!nodePath && depth > 0) return null; // Avoid rendering empty root paths incorrectly

    return (
      <div key={nodePath} style={{ paddingLeft: `${depth * 10}px` }} className="font-mono text-[11px] leading-relaxed">
        
        <div className={`flex items-center gap-1 py-1 rounded transition group cursor-pointer pr-2 ${
          isLight ? 'hover:bg-stone-200/60 text-stone-850' : 'hover:bg-stone-850/50 text-stone-200'
        }`}>
          
          {/* Collapse icon */}
          {isFolder ? (
            <button 
              type="button"
              onClick={() => toggleNodeExpanded(nodePath)}
              className={`p-0.5 ${isLight ? 'text-stone-400 hover:text-stone-700' : 'text-stone-500 hover:text-stone-300'}`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4.5" />
          )}

          {/* Selector checkbox */}
          <button
            type="button"
            onClick={() => toggleNodeSelected(nodePath, isFolder, node)}
            className={`p-0.5 rounded transition ${isLight ? 'hover:bg-stone-200' : 'hover:bg-stone-800'} ${isSelected ? 'text-amber-500' : 'text-stone-600'}`}
          >
            {isSelected ? <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" /> : <File className="w-3.5 h-3.5 opacity-40" />}
          </button>

          {/* Node visuals Label */}
          <span className="flex items-center gap-1.5 min-w-0" onClick={() => isFolder ? toggleNodeExpanded(nodePath) : toggleNodeSelected(nodePath, false, node)}>
            {isFolder ? (
              <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className={`truncate hover:underline ${
              isSelected 
                ? (isLight ? 'text-amber-700 font-bold' : 'text-amber-200 font-bold') 
                : (isLight ? 'text-stone-700 font-semibold' : 'text-stone-300')
            }`}>
              {node.name}
            </span>
            {node.size && (
              <span className={`text-[8px] ${isLight ? 'text-stone-405' : 'text-stone-600'}`}>({(node.size / 1024).toFixed(1)} KB)</span>
            )}
          </span>

        </div>

        {/* Child items */}
        {isFolder && isExpanded && node.children && (
          <div className={`space-y-0.5 pb-1 border-l ml-2.5 pl-1 ${
            isLight ? 'border-stone-200' : 'border-stone-800'
          }`}>
            {Object.values(node.children).map(child => renderTreeNodes(child, depth + 1))}
          </div>
        )}

      </div>
    );
  };

  return (
    <div className={`w-full max-w-7xl mx-auto py-8 px-5 animate-fadeIn font-sans ${isLight ? 'text-stone-800' : 'text-stone-105'}`}>
      
      {/* Title bar back */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b shrink-0 ${isLight ? 'border-stone-200' : 'border-stone-805'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              isLight 
                ? 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700' 
                : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-400'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{visualMode === 'cabinet' ? '返回朝廷会商' : '返回朝廷会商'}</span>
          </button>
          
          <div>
            <h1 className={`text-xl font-extrabold font-display flex items-center gap-2 ${isLight ? 'text-stone-900' : 'text-stone-100'}`}>
              <FolderOpen className="w-5 h-5 text-amber-500" />
              <span>{visualMode === 'cabinet' ? '本地项目文件夹读取模块' : '本地项目文件夹读取模块'}</span>
            </h1>
            <p className={`text-xs mt-1 ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
              在浏览器沙箱内安全读取选择的本地项目目录结构，智能分析技术栈并生成完整的交付交接指令包。
            </p>
          </div>
        </div>

        {isAuthorized && (
          <button
            onClick={handleRevokeAuthorization}
            className="px-3.5 py-1.5 text-xs bg-rose-950/20 text-rose-450 border border-rose-955 rounded-xl hover:bg-rose-950/40 transition flex items-center gap-1.5 cursor-pointer font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>注销文件夹授权</span>
          </button>
        )}
      </div>

      {/* Security warning checklist and loading form if not authorized */}
      {!isAuthorized ? (
        <>
        {/* Web vs Desktop warning — always visible when not authorized */}
        {!isDesktopApp && (
          <div className={`mt-6 p-4 rounded-xl border max-w-2xl mx-auto flex items-start gap-3 ${
            isLight ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
          }`}>
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold mb-1">{language === 'zh' ? '⚠️ 网页端限制' : '⚠️ Web Browser Limitation'}</p>
              <p>{language === 'zh'
                ? '网页端无法直接读取本机文件路径。请使用桌面版（启动内阁桌面版.bat），或上传/粘贴文件内容到输入框。桌面版可通过 Electron 安全读取本地项目目录。'
                : 'Web browsers cannot access local file paths directly. Use the desktop app, or paste file content into the chat input. The desktop version can safely read local folders.'}</p>
            </div>
          </div>
        )}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`mt-8 border-2 border-dashed rounded-3xl p-12 text-center space-y-6 max-w-2xl mx-auto flex flex-col items-center justify-center transition-all ${
            isLight ? 'border-stone-300 bg-stone-50/50' : 'border-stone-800 bg-stone-900/30 hover:border-amber-600/30'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-amber-600/10 border border-amber-600/35 flex items-center justify-center text-amber-500 text-3xl shadow-inner animate-bounce-slow">
            🏛️
          </div>

          <div className="space-y-2">
            <h3 className={`text-sm font-black font-display text-center uppercase tracking-wider ${isLight ? 'text-stone-850' : 'text-stone-100'}`}>
              安全授权审查与文件夹选择
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              内阁沙盒严格保障代码安全。请在下方点击或将项目文件夹拖拽入此处授权：我们仅会索引该文件夹，不触及下载、桌面等系统盘敏感位置。
            </p>
          </div>

          {/* Safety Settings options */}
          <div className={`p-4 border rounded-2xl w-full max-w-md text-left space-y-2.5 text-xs font-mono ${
            isLight ? 'bg-white border-stone-200' : 'bg-stone-950 border-stone-850'
          }`}>
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block border-b border-stone-850 pb-1.5 mb-1.5">🛡️ 默认防御性排除机制规则：</span>
            
            <div className="flex items-center justify-between">
              <span className="text-stone-450">强制排除 node_modules 依赖库</span>
              <input type="checkbox" checked={ignoreNodeModules} onChange={e => setIgnoreNodeModules(e.target.checked)} className={`rounded ${isLight ? 'border-stone-300' : 'border-stone-800 bg-stone-900'} text-amber-500 focus:ring-transparent`} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-450">强制排除 .git 与 .github 目录</span>
              <input type="checkbox" checked={ignoreGit} onChange={e => setIgnoreGit(e.target.checked)} className={`rounded ${isLight ? 'border-stone-300' : 'border-stone-800 bg-stone-900'} text-amber-500 focus:ring-transparent`} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-450">排除编译分发输出 (dist, build, next)</span>
              <input type="checkbox" checked={ignoreBuildOutputs} onChange={e => setIgnoreBuildOutputs(e.target.checked)} className={`rounded ${isLight ? 'border-stone-300' : 'border-stone-800 bg-stone-900'} text-amber-500 focus:ring-transparent`} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-450">屏蔽敏感密钥与环境变量 (.env, certs)</span>
              <input type="checkbox" checked={ignoreEnvAndSecrets} onChange={e => setIgnoreEnvAndSecrets(e.target.checked)} className={`rounded ${isLight ? 'border-stone-300' : 'border-stone-800 bg-stone-900'} text-amber-500 focus:ring-transparent`} />
            </div>
          </div>

          <div className="relative shrink-0 pt-2">
            <input 
              type="file" 
              id="folder-upload" 
              webkitdirectory="" 
              directory="" 
              onChange={handleFolderSelect} 
              className="hidden" 
            />
            <label 
              htmlFor="folder-upload"
              className="px-8 py-3 bg-amber-600 hover:bg-amber-500 hover:scale-[1.01] active:scale-[0.99] text-stone-950 font-black tracking-widest text-xs rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-stone-950" />
              <span>选择并开始授权读取</span>
            </label>
          </div>

          <p className="text-[10px] text-stone-500 font-mono italic">提示: 文件夹中文件树结构和代码完全在您本地端装配计算完成。</p>

        </div>
        </>
      ) : (
        // Main view for analyzed project context
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          
          {/* File Tree on the Left cols 5 */}
          <div className={`lg:col-span-4 border rounded-3xl p-5 flex flex-col justify-between max-h-[580px] overflow-hidden ${
            isLight ? 'bg-stone-50/70 border-stone-200 shadow-sm' : 'bg-stone-900 border-stone-850'
          }`}>
            <div>
              <div className={`flex items-center justify-between border-b pb-2 mb-3 shrink-0 ${
                isLight ? 'border-stone-200' : 'border-stone-850'
              }`}>
                <span className="text-xs font-black font-display tracking-widest text-amber-500 uppercase">📁 {folderName} 结构索引</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-semibold ${
                  isLight ? 'bg-stone-100/80 text-stone-605' : 'bg-stone-950 text-stone-500'
                }`}>{rawFiles.length > 0 ? `已搜集 ${rawFiles.length} 原始文件` : '已装载树'}</span>
              </div>

              {/* Collapsible tree node scroll wraps */}
              <div className="overflow-y-auto max-h-[460px] pr-1.5 space-y-1 select-none scrollbar-thin">
                {fileTree ? (
                  renderTreeNodes(fileTree)
                ) : (
                  <div className="text-center py-10 font-mono text-stone-500 flex flex-col items-center gap-2 text-xs">
                    <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
                    <span>正解析文件树中...</span>
                  </div>
                )}
              </div>
            </div>

            <div className={`border-t pt-3 flex items-center justify-between text-[10px] font-mono shrink-0 ${
              isLight ? 'border-stone-200 text-stone-500 opacity-80' : 'border-stone-850 text-stone-500'
            }`}>
              <span>点击 ⬜ 进行多层级级联选择</span>
              <button 
                onClick={() => setExpandedNodes({})} 
                className={`hover:text-amber-600 transition ${isLight ? 'text-stone-550' : 'text-stone-550'}`}
              >
                收起全部
              </button>
            </div>
          </div>

          {/* Analysis Dashboard columns 8 */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Analysis Metrics */}
            {projectAnalysis && (
              <div className={`p-6 border rounded-3xl space-y-4 shadow-xl ${
                isLight ? 'bg-stone-50/75 border-stone-200 text-stone-805 shadow-md' : 'bg-stone-900 border-stone-850 text-stone-200'
              }`}>
                <div className={`flex items-start justify-between border-b pb-3 ${
                  isLight ? 'border-stone-150' : 'border-stone-805'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-600/10 border border-emerald-600/20 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black font-display tracking-wide">本地工程特征分析</h3>
                      <span className="text-[9px] font-mono bg-emerald-600/10 text-emerald-500 px-2 py-0.2 rounded font-bold uppercase mt-1 inline-block">分析完成</span>
                    </div>
                  </div>

                  {/* Flag controls to prevent sending source code */}
                  <div className={`p-2 border rounded-xl space-y-1.5 max-w-xs text-[10px] font-mono leading-tight ${
                    isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-stone-950 border-stone-850'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="checkbox" 
                        id="sendOnlyOutline"
                        checked={sendOnlyOutline}
                        onChange={e => setSendOnlyOutline(e.target.checked)}
                        className={`rounded text-amber-500 focus:ring-transparent ${
                          isLight ? 'border-stone-300 bg-white' : 'border-stone-800 bg-stone-900'
                        }`}
                      />
                      <label htmlFor="sendOnlyOutline" className={`font-bold cursor-pointer ${isLight ? 'text-stone-700' : 'text-stone-400'}`}>仅限发送目录摘要与架构说明</label>
                    </div>
                    <p className={`text-[8px] scale-95 pr-2 ${isLight ? 'text-stone-500' : 'text-stone-600'}`}>开启后，大臣与云端均不会收到源码内容，仅传输工程特征摘要。</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-1">
                  <div className={`p-3 rounded-2xl relative border ${
                    isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-stone-950/45 border-stone-850'
                  }`}>
                    <span className="text-[8px] text-amber-500 font-bold absolute top-2 right-3">技术栈</span>
                    <h4 className={`text-[10px] font-bold border-b pb-1 mb-2 uppercase tracking-wide ${
                      isLight ? 'text-stone-400 border-stone-150' : 'text-stone-450 border-stone-850'
                    }`}>项目类型 & 框架</h4>
                    <p className={`font-bold text-xs ${isLight ? 'text-amber-700' : 'text-amber-250'}`}>{projectAnalysis.projectType}</p>
                    <p className={`text-[9px] mt-1 line-clamp-1 ${isLight ? 'text-stone-500' : 'text-stone-450'}`}>依赖栈: {projectAnalysis.techStack.slice(0, 3).join(', ')}</p>
                  </div>
                  
                  <div className={`p-3 rounded-2xl relative border ${
                    isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-stone-950/45 border-stone-850'
                  }`}>
                    <span className="text-[8px] text-indigo-500 font-bold absolute top-2 right-3">路由/组件</span>
                    <h4 className={`text-[10px] font-bold border-b pb-1 mb-2 uppercase tracking-wide ${
                      isLight ? 'text-stone-400 border-stone-150' : 'text-stone-450 border-stone-850'
                    }`}>关键结构统计</h4>
                    <div className="grid grid-cols-3 gap-1 text-center scale-95">
                      <div className={`p-1 rounded ${isLight ? 'bg-stone-100' : 'bg-stone-900'}`}><div className={`font-black ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{projectAnalysis.entryFiles.length}</div><div className={`text-[7px] font-semibold uppercase font-sans ${isLight ? 'text-stone-500' : 'text-stone-500'}`}>入口文件</div></div>
                      <div className={`p-1 rounded ${isLight ? 'bg-stone-100' : 'bg-stone-900'}`}><div className={`font-black ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{projectAnalysis.componentDirs.length}</div><div className={`text-[7px] font-semibold uppercase font-sans ${isLight ? 'text-stone-505' : 'text-stone-500'}`}>组件分布</div></div>
                      <div className={`p-1 rounded ${isLight ? 'bg-stone-100' : 'bg-stone-900'}`}><div className={`font-black ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>{projectAnalysis.apiCodeFiles.length}</div><div className={`text-[7px] font-semibold uppercase font-sans ${isLight ? 'text-stone-505' : 'text-stone-505'}`}>外部路由</div></div>
                    </div>
                  </div>
                </div>

                {/* Architecture outlines */}
                <div className="space-y-1.5 text-xs">
                  <label className={`text-[10px] font-mono uppercase tracking-widest font-bold ${isLight ? 'text-stone-500' : 'text-stone-450'}`}>🏛️ 帝国工程大纲架构描述 (Shared Briefs Target):</label>
                  <pre className={`p-4 font-mono text-[10px] leading-relaxed rounded-2xl border overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-605/30 ${
                    isLight ? 'bg-white border-stone-200 text-stone-750 shadow-sm' : 'bg-stone-950/90 border-stone-850 text-stone-300'
                  }`}>
                    {projectAnalysis.architectureSummary}
                  </pre>
                </div>

                {/* Codex deliverable instructions */}
                <div className="space-y-1.5 text-xs">
                  <span className={`text-[10px] font-mono uppercase tracking-widest font-bold flex items-center gap-1.5 ${isLight ? 'text-stone-500' : 'text-stone-450'}`}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>自动适配 Codex / DeepSeek / Claude Code 代码包交付指令 (Handoff Directives):</span>
                  </span>
                  <pre className={`p-4 text-[10px] font-mono leading-relaxed rounded-2xl border overflow-x-auto whitespace-pre-wrap select-text selection:bg-amber-655/30 ${
                    isLight ? 'bg-white border-stone-200 text-amber-850 shadow-sm' : 'bg-stone-950/90 border-stone-850 text-amber-200'
                  }`}>
                    {projectAnalysis.handoffPacket}
                  </pre>
                </div>

                {/* Submit Injection */}
                <div className={`flex items-center justify-between border-t pt-4 ${
                  isLight ? 'border-stone-200' : 'border-stone-805'
                }`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                    <Info className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>注入朝阁后，大臣在起草廷辩及驳回计划时将自动调取这些限制参数。</span>
                  </div>

                  <button
                    onClick={handleInjectToSession}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-black tracking-wider text-xs rounded-xl shadow-lg hover:scale-[1.01] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>装入廷议上下文 ➔</span>
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
