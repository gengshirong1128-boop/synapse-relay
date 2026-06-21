# 内阁前端 阶段C 实现指令（喂给 Codex CLI，在 D:\内阁\内阁-ai-app 运行）

你是资深 React + TypeScript 前端工程师。执行 UI 重构**阶段 C：把现有界面重组成「群聊式三栏」布局**（方案甲，已选定）。中文 UI。**这一轮只改前端，不改后端、不改 api.ts 的请求路径和数据结构。**

## 前置（已完成，复用，别重做）
- 阶段A：已拆出 `src/components/`(AppHeader/HeroSection/Sidebar/PlanForm/ManagerReportPanel/TaskDraftEditor/ExecutionPlanPanel/ResultReportPanel/ActivityCenter/SupervisorPanel/StatusPill) + `src/types.ts`。
- 阶段B：已有 `src/theme.ts`(token) + `src/components/ui/`(Button/Card/Avatar/Badge/Input/ListItem/Modal)。**新布局必须用这些 token 和 ui 组件，不要硬编码颜色/尺寸、不要重造基础组件。**

## 选定方案：方案甲「群聊式三栏」（见 UI-OPTIONS.md 方案甲）
三栏布局（响应式）：
```
+-- 左栏：会话列表 --+-- 中栏：当前会话 --------+-- 右栏：成员与分工 --+
| [检测本地工具]      | 顶部: 会话名/目标/状态    | 成员列表(头像+状态)    |
| [+ 新建群聊]        |--------------------------| - Codex   thinking    |
| 私聊                | 消息流:                  | - Claude  waiting     |
|  - Codex            |  头像+名称+角色+内容      |                       |
|  - Claude           |  审批卡片(允许/拒绝)      | 首辅分工:             |
| 群聊                |  监工/边界事件            |  工作区/read/write/验收|
|  - 前端重构         |--------------------------|                       |
|  - 后端审查         | 底部输入区 @agent 发送    | 边界报告/验收/监工     |
+--------------------+--------------------------+----------------------+
```

## 这一轮做什么（务实，分清"能真接"和"先占位"）

### 能用现有数据真接的（优先做实）：
- **左栏 - 本地工具检测**：复用现有 `agents` 数据和 detect 逻辑(Sidebar 里已有 agent-panel)，搬到左栏顶部。
- **左栏 - 会话列表**：现有 `recentPlans`(历史 Plan)就是"群聊会话"的数据源——每个 Plan 当成一个群聊会话项显示(goal 当标题、status 当状态)。私聊分组这一轮可先放**单 agent 快捷入口**(从 agents 列表生成)。
- **中栏 - 消息流**：把现有 Plan 的 `events`(事件日志) + tasks 的发言/输出，渲染成"群聊消息流"样式——每条带发起方(agent/system)头像+名称+角色+内容。审批/边界异常事件渲染成**对话流内的审批卡片/提醒卡片**(复用已有 approval 数据，没有就先做卡片样式占位)。
- **右栏 - 成员与分工**：复用现有 ManagerReport 的 tasks 分工 + boundary_report + acceptance + supervisor 数据，重组成"成员列表 + 首辅分工 + 边界/验收/监工"面板。

### 需要后端、这一轮先占位（标 `// TODO: 待后端支持`）：
- 真正的私聊/群聊会话切换（当前后端是 Plan 不是 chat session）→ 先用 Plan 列表模拟，UI 骨架先搭。
- 拉人/踢人 → 右栏放按钮 + 交互骨架，点击暂存本地 state 或弹"待后端支持"提示。
- 点头像弹 **agent 配置抽屉**(切模型/skill/插件) → 抽屉 UI 做出来，模型/skill 列表可先用 agent.capabilities 或占位，真正切换标 TODO。
- @agent 提及 → 输入框支持 @ 选择，发送仍走现有创建 Plan/task 的 API。

## 关键约束
- **不改 api.ts 的路径和数据结构、不改后端**。新 UI 消费现有 `Plan/Task/Agent/events/boundary_report` 等数据(types.ts 已定义)。需要新后端的功能做 UI 骨架 + `// TODO: 待后端支持`。
- 用 theme.ts token + ui/ 组件，不硬编码、不引新 UI 库（可继续用 lucide-react）。
- 古风命名只作角色标签，整体保持 Discord/Linear 式现代专业深色风。
- 三栏要响应式：窄屏退化为"中栏消息流为主，左栏变顶部会话切换，右栏变底部抽屉"（见 UI-OPTIONS.md 方案甲的窄屏退化）。
- **保留所有现有功能数据**(边界报告/验收/监工/任务编排)，只是换布局呈现，不许丢功能。
- 每完成一部分跑 `npm run build` + `npm test`，保持 27 tests 通过、build 绿。

## 产出顺序（每步停下报告 + 截图描述）
1. 先搭三栏骨架(布局+响应式)，把现有内容塞进对应栏，build 通过。
2. 中栏消息流样式(头像/角色/审批卡片)。
3. 右栏成员+分工面板。
4. 左栏会话列表+工具检测。
5. 点头像配置抽屉骨架。

先做第 1 步(三栏骨架)，停下让我审。我会用浏览器实际打开看渲染效果。
