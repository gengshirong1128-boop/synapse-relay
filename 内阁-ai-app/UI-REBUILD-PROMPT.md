# 内阁前端 UI 重构指令（喂给 Codex CLI，在 D:\内阁\内阁-ai-app 运行）

你是资深 React + TypeScript 前端工程师 + UI/UX 设计师。重构「内阁」(court-council) 的 Web 前端。中文 UI。**这一轮只改前端 UI/交互结构，不改后端、不改 API 调用的数据契约。**

## 产品背景（重要，决定 UI 形态）
「内阁」是一个**多 AI agent 协作工作台**。新的产品方向是做成**群聊式协作**(像钉钉/Discord 的多人协作):
- 检测用户电脑本地已装的 agent 工具(Codex / Claude Code / Gemini CLI / OpenCode 等)，把它们当成可参与的「成员/大臣」——**不需要用户填 API key**。
- 用户能**私聊**单个 agent，也能开**群聊**让多个 agent 协作。
- 群聊里能**拉人/踢人**(动态增减参与的 agent)。
- 有一个**主持人(首辅)**角色：给各 agent 分配**工作区、边界(可读/可写路径)、验收标准**。
- 有**审查**角色(都察院)：审查产出。
- 古风命名(首辅/六部/都察院)只是角色皮肤，不要做成满屏古风，**保持现代专业的协作工具观感**，国外用户也能看懂。

## 现状（你要改的）
- 前端是**单个 1268 行的 `src/App.tsx`** + 28KB 的 `src/index.css`，`components/` 目录是空的。这是难维护、难看的根因。
- 现有形态是「任务编排」(Plan/Task/Wave/边界报告/验收/监工)，数据模型在 App.tsx 顶部(Plan/PlanTask/ManagerReport 等)。
- API 调用通过 `src/api.ts` 的 `requestJson`。**后端端点和数据结构这轮不要动**，UI 仍消费现有数据。

## 任务（分阶段，每阶段跑 `npm run build` + `npm test` 确保不挂）

### 阶段 A：拆分组件（先安全拆，不改功能）
把 1268 行 App.tsx 按职责拆成 `src/components/` 下的多个组件，App.tsx 只留布局和状态编排：
- 把类型定义(Plan/PlanTask/ManagerReport/ResultReport 等)抽到 `src/types.ts`
- 按现有功能区拆组件(如 AgentList、TaskBoard、WaveView、ManagerReportPanel、BoundaryReport、AcceptancePanel 等，按实际功能命名)
- 拆完**功能完全不变**，只是文件组织变清晰。跑 build + test 确认无回归。

### 阶段 B：建立设计系统
- 新建 `src/theme.ts`：颜色 token(深色为主 + 浅色)、间距、圆角、字号。参考 Linear/Discord/Things 的克制专业风，**无渐变、无 emoji 滥用、无花哨古风**。
- 把 index.css 里散落的硬编码颜色/尺寸收敛到 token。
- 建基础组件 `src/components/ui/`：Button、Card、Avatar(agent 头像/角色徽章)、Badge、Input、Modal、ListItem。

### 阶段 C：重做成群聊式布局（核心）
三栏布局(响应式，窄屏可折叠)：
- **左栏**：会话列表 — 私聊(单 agent) + 群聊(多 agent)，每项显示名称/角色/状态(在线/思考中/空闲)。顶部有「检测本地工具」按钮、「+ 新建群聊」。
- **中栏**：当前会话的消息流 — 每条消息显示发言 agent 的头像+角色名+内容。群聊里不同 agent 用不同标识区分。底部输入框。
- **右栏(群聊时显示)**：成员与分工面板 — 成员列表(可拉人/踢人)、主持人(首辅)给每个成员分配的工作区/边界(可读/可写路径)/验收标准、审查状态。
- 保留现有的边界报告/验收/监工数据，作为右栏或可展开面板呈现(这些后端已有，别丢)。

### 阶段 D：丝滑与质感
- 所有可点元素 pressed/hover 反馈、加载态、消息出现的轻过渡。
- 状态用颜色语义化(思考中/完成/失败/越界告警)。
- 空状态友好提示。

## 约束
- **这轮不改后端、不改 api.ts 的请求路径和数据结构**。UI 先用现有数据渲染；群聊/私聊/拉人踢人等需要新后端的功能，先做 UI 骨架 + 用现有数据或占位，标注 `// TODO: 待后端支持`，下一轮我给后端指令再接通。
- 不引入重型 UI 库(保持现有技术栈：React + lucide-react 图标 + CSS)。可继续用 lucide-react。
- 每阶段跑 `npm run build`(在 内阁-ai-app 下) + 现有测试(api.test/planLogic.test/translations.test)，保持通过。
- 拆分阶段(A)严禁改变功能行为，纯搬运。

每阶段做完停下报告：拆/建/改了哪些文件、测试与 build 结果、视觉变化描述。先做阶段 A（拆组件），这是后续一切的基础，也最安全。
