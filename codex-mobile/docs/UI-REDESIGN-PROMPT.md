# UI 重构指令（喂给 Codex CLI，在 D:\内阁\codex-mobile 运行）

你是资深移动端 UI 工程师 + 设计系统专家。重构 mobile-app 的 UI 排版，目标：**1:1 对齐官方 OpenAI Codex 手机版和 Anthropic Claude 手机版的设计语言**，做到组件分级合理、间距规范、反馈丝滑、事无巨细。中文 UI。

## 重要：你打不开外部链接

你（Codex CLI）和我都无法访问 openai.com / apple.com 等站点（网络策略拦截）。所以**不要尝试抓取链接**，直接按下面我精确描述的官方设计语言来做。这是基于官方应用的真实特征总结。

## 官方设计语言（必须还原）

### OpenAI Codex 手机版（= ChatGPT 设计语言，深色为主）
- **背景纯黑/极深灰**，对话区**无边框、无卡片包裹**——消息直接浮在背景上，靠间距和对齐区分，不是一个个框
- **大量垂直留白**，消息之间间距大（16-24pt）
- **单色**：白/灰阶为主，**零彩色装饰**，强调也只用白或浅灰
- 用户消息：右对齐，**深灰圆角气泡**（不是亮色块），圆角 18pt
- AI 回复：**左对齐、无气泡**，纯文字直接铺在背景上（这是关键差异——Codex 的 AI 回复不套气泡）
- 代码块：深一档的背景 + 等宽字体 + 细边框，有语言标签和复制按钮
- 字体：系统字体（SF Pro），标题 17pt/600，正文 15pt/400，次要信息 13pt
- 顶部栏：极简，只有标题 + 必要操作图标（线性单色图标，非 emoji）
- 输入框：底部，圆角，发送按钮在内部右侧

### Anthropic Claude 手机版（暖色调）
- 背景：深色用 #1A1816，浅色用暖米白 #F7F5F0
- 强调色：赤陶/橙棕 #DA7756
- 比 Codex **温暖、圆润**，标题字重略轻
- 用户气泡用赤陶色，AI 回复同样偏无框或浅框

## 当前 App 的问题（你要改的）
- 排版不合理：间距不统一（有的挤有的空）、层级不清
- AI 回复目前套了气泡（`AgentRow` 用 `assistantBubbleBg`）——Codex 风格应去掉气泡，改成无框纯文字流
- 缺少丝滑反馈：按钮按下无态、消息出现无过渡、加载态生硬
- 组件未分级、间距硬编码散落各处

## 已有的基础设施（必须用，别另起炉灶）
- `theme/colors.ts`：双主题颜色 token（Codex/Claude × 深/浅），4 套各 35 个 token。`getTheme(brand, mode)` 取色。
- `theme/tokens.ts`：已建好 spacing(4/8/12/16/20/28)、radius(6/10/16/pill22/bubble18)、fontSize(11/12/14/15/17/22)、fontWeight。**所有间距/圆角/字号改用这些 token，禁止硬编码数字。**
- 组件目录：`components/agent/`（AgentMessageRow/AgentThread/AgentHeader/AgentComposer/AgentRunStatus/ApprovalBanner）、`components/settings/`、`components/navigation/AppTabBar.tsx`、`components/FileTree.tsx`

## 任务（分阶段，每阶段跑测试，全绿再下一步）

### 阶段 1：消息流重构（最核心，对齐 Codex）
- `AgentMessageRow.tsx`：AI 回复(`AgentRow`)去掉气泡背景，改为无框纯文字左对齐流（保留 code/tool/thinking 的独立卡片，因为需要等宽边框）。用户消息(`UserRow`)保持右对齐气泡但用 token 化的圆角/间距。
- `AgentThread.tsx`：消息间距统一用 spacing token，加大垂直留白到官方水准。
- 代码块：加语言标签 + 复制按钮（点击复制到剪贴板，用 expo-clipboard，已装）。

### 阶段 2：顶部栏 + 输入框
- `AgentHeader.tsx`：精简成官方那种——标题 + 模型小标签 + 连接点 + 新对话/设置图标，全部用 token 间距，线性单色图标。
- `AgentComposer.tsx`：输入框圆角化、发送按钮内置右侧、按下有反馈态（Pressable 的 pressed 透明度或缩放）。

### 阶段 3：组件分级 + 丝滑反馈
- 抽出/规范基础组件：Button(primary/secondary/danger)、Card、Chip、Badge、ListItem、SectionHeader，统一用 token。
- 所有可点击元素加按下反馈（pressed 态 opacity 0.6 或轻微 scale）。
- 消息追加、流式输出、列表项出现：加 LayoutAnimation 或 Reanimated 的轻过渡（已装 react-native-reanimated）。注意性能，别过度。

### 阶段 4：其余页面对齐
- sessions/files/settings/connect 页：统一间距 token、卡片圆角、字号层级，向官方极简看齐。

## 约束（违反就是错）
- 双主题必须都正常（Codex 黑白 + Claude 暖色，各深浅）
- 禁止 emoji 图标、禁止彩色渐变、禁止紫色
- 间距/圆角/字号一律用 `theme/tokens.ts`，不硬编码
- 不碰业务逻辑（store/services/hooks 的数据流）、不碰 relay-server
- 不改 App 名称/图标
- 每阶段跑 `cd mobile-app && npx tsc --noEmit && npx vitest run`，保持 47 passed 不变红
- 改动大的组件先小步、可回退

每个阶段做完停下，报告改了哪些文件 + 测试结果 + 截图描述（你描述改成什么样）。先做阶段 1。

---

# 阶段 2 + 阶段 3 详尽指令（阶段 1 已完成并提交，接着做）

阶段 1 已完成：AgentMessageRow 的 AI 回复去气泡、代码块加复制、全面 token 化；AgentThread 间距统一。现在做阶段 2 和 3。仍遵守全部约束（双主题/tokens.ts/不碰业务逻辑/每阶段跑 tsc+vitest 保持 47 passed/不硬编码数字/无 emoji 图标）。

## 阶段 2：顶部栏 + 输入框（对齐 Codex 极简）

### AgentHeader.tsx
现状：标题 + 模型 pill + 模式标签 + 工作区 + token/cost + 新对话按钮，信息偏挤。
改为官方那种克制的单行/双行栏：
- 第一行：agent 名称（17pt/700）+ 运行中小圆点 + 右侧"新对话"和"设置"图标按钮
- 第二行（次要，13pt，textTertiary）：模型名 · 模式 · 工作区名，用 `·` 分隔，过长省略
- token/cost 移到次要行末尾或点击模型 pill 后展开，不要和标题抢视觉
- 所有间距/字号用 tokens；图标用线性单色字符或 SVG path，不要 emoji
- 图标按钮加 pressed 反馈（opacity 0.6）和 accessibilityLabel

### AgentComposer.tsx
现状：附件 `+`、发送 `↑`、停止 `■` 是裸字符，硬编码尺寸。
改为：
- 输入框圆角用 radius.lg，背景 inputBg，多行自适应高度（已有 maxHeight）
- 发送/停止/附件按钮：尺寸用 token 化常量，加 pressed 反馈（pressed 时 opacity 0.6 或 scale 0.96）
- canSend=false 时发送按钮明显禁用态（降低对比，已有雏形，token 化）
- 把裸字符图标换成更精致的（可用 SF Symbols 风格的线性字符，或简单 SVG，但**不要 emoji**）；保留 accessibilityLabel
- 间距/圆角/字号全部 tokens

## 阶段 3：组件分级 + 丝滑反馈（建可复用组件库）

### 新建 components/ui/ 目录，抽出基础组件（这是用户要的"组件库"）
每个组件接收 `colors` + 必要 props，全部用 tokens，在两套主题都正常：
- `Button.tsx`：variant = primary（accent 底 + bg 字）/ secondary（border 框 + text 字）/ danger（danger 底）/ ghost（无底）；size = sm/md；pressed 反馈；disabled 态；可选 accessibilityLabel。
- `Card.tsx`：surface 底 + border + radius.lg + 可选 padding。
- `Chip.tsx`：选中/未选中态（选中 accentSoft 底 + accent 字），pressed 反馈。
- `Badge.tsx`：小标签（如会话状态 运行中/空闲），用 token 配色。
- `ListItem.tsx`：左内容 + 右附属 + 可选分隔线 + pressed 反馈。
- `SectionHeader.tsx`：分组标题（caption 字号、textTertiary、letterSpacing）。
- 导出一个 `components/ui/index.ts` barrel。

### 用新组件替换现有重复样式（小步、不破坏功能）
- settings 页的卡片/chips → 用 Card/Chip（保留现有 SettingsCard/OptionChips 也可，但向 ui/ 看齐）
- sessions 页卡片 → Card + Badge（状态）
- connect 页按钮 → Button
- 各处"保存/连接/删除"按钮 → Button 的对应 variant

### 丝滑反馈（全局，注意性能）
- 所有 Pressable 加 pressed 态（opacity 或轻 scale）。可封装在 Button/ListItem 里统一处理。
- 列表项/消息出现：可选用 react-native-reanimated（已装）的 FadeIn 轻过渡，或 LayoutAnimation。**仅在低成本处用，长列表不要每项动画导致卡顿。**
- Tab 切换、页面进入：保持系统默认，不强加动画。

## 验证（每阶段）
cd mobile-app && npx tsc --noEmit && npx vitest run  → 保持 47 passed 不变红。
阶段 3 新建组件可补少量单元测试（如 Button variant 渲染），非强制。

每阶段做完停下报告：改/建了哪些文件、测试结果、视觉变化描述。先做阶段 2，再做阶段 3。

---

# 阶段 3 余项 + 阶段 4（组件库已建好，接着做）

重要进度：阶段 1、2 已完成提交。阶段 3 的**组件库基础已经由我建好**，在 `components/ui/`：
- `Button`（variant: primary/secondary/danger/ghost；size: sm/md；disabled；fullWidth；pressed opacity+scale）
- `Card`（surface 底 + border + radius.lg，可 highlight）
- `Badge`（tone: neutral/accent/danger）
- `SectionHeader`（大写分组标题）
- 从 `components/ui` 这个 barrel 导入。

**所以你不要重新造这些组件**，直接复用它们去替换各页的手写样式。

## 总原则：1:1 复刻官方，不要自由发挥
用户的硬要求是**像素级接近官方 Codex（ChatGPT 内）和 Claude 手机版**。不要加你自己的设计风格、不要彩色装饰、不要 emoji、不要渐变。布局/间距/字号/配色全部向官方的克制极简看齐。所有数值用 `theme/tokens.ts`，颜色用 `theme/colors.ts` 的 `colors.*`。

## 阶段 3 余项：用 components/ui 替换各页重复样式（机械去重，逐文件小步）

1. `app/connect.tsx`：扫码按钮（现在还是手写 Pressable）改用 `Button`（variant primary 或 secondary）。"连接"按钮已经换过了，参考它。
2. `app/profiles.tsx`：添加/更新、取消、删除按钮 → `Button`（primary / secondary / danger）。卡片 → `Card`。
3. `app/(tabs)/sessions.tsx`：会话卡片外层 → `Card`；状态（运行中/空闲）→ `Badge`（运行中用 tone accent，异常用 danger）；"新建对话"bar → `Button`（fullWidth）。
4. `app/(tabs)/settings.tsx`：现有 `SettingsCard`/`SectionLabel` 可保留（它们已 token 化），但"保存"按钮 → `Button`；如果 SettingsCard 和新 Card 风格差异大，让 SettingsCard 内部复用 ui/Card。
5. 替换后删除各文件里不再使用的本地 button/card StyleSheet 条目。

每替换一个文件就 `npx tsc --noEmit && npx vitest run`，保持 47 passed。

## 阶段 4：各页排版对齐官方 + 丝滑反馈

1. **统一间距节奏**：各页 padding/gap 用 tokens（lg=16 作主边距，md=12 作卡片内距，sm=8 作元素间距），消除散落的硬编码数字和不一致留白。
2. **字号层级**：标题 fontSize.title(17)、正文 body(14)/bodLg(15)、次要 small(12)/caption(11)，统一替换硬编码。
3. **列表/会话项**：向官方看齐——减少边框感，多用留白和次要色分隔，而非粗边框卡片。
4. **丝滑反馈**：
   - 所有可点元素确保有 pressed 态（ui/Button 已内置；其余 Pressable 补 opacity 0.6）。
   - 列表项出现可选用 react-native-reanimated（已装）的 FadeInDown 轻过渡，**仅短列表用，长会话列表不要每项动画**。
   - 连接状态变化（连接中→已连接）、运行状态点，可加轻微透明度过渡。
5. **空状态**：各页空状态文案 + 居中排版统一风格（参考 sessions 已有的"暂无 X 会话"）。

## 约束（重申，违反就是错）
- 复用 components/ui，不重造组件
- 双主题都要正常（Codex 黑白 + Claude 暖色 × 深浅）
- tokens.ts / colors.ts，禁止硬编码数字和颜色
- 无 emoji、无渐变、无紫色
- 不碰 store/services/hooks 业务逻辑、不碰 relay-server
- 每文件改完跑 tsc + vitest，保持 47 passed 不变红
- 动画注意性能，长列表不逐项动画

每改完几个文件停下报告。先做阶段 3 余项的 sessions.tsx（最能体现组件库价值），再逐页推进。


