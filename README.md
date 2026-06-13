# Synapse Relay（内阁）

一个本地优先的多 AI 协作桌面应用。它把不同模型、CC Switch 中转站、本地 coding CLI、项目文件和可复用 Skill 组织成一个可操作的“内阁会审”工作台。

项目默认支持 Mock 模式，无 API Key 也能体验基础流程。真实模型调用可通过 CC Switch、本地中转站或 OpenAI-compatible API 接入。

## English Overview

Synapse Relay is a local-first multi-AI collaboration desktop app. It combines model providers, CC Switch, local coding CLIs, project context, reusable Skills, structured debate, and final execution handoff in one workflow.

Why it is useful:

- Local-first: Mock mode works without an API key; runtime secrets and user data stay out of Git.
- Provider-flexible: use CC Switch or OpenAI-compatible endpoints instead of locking the workflow to one model vendor.
- Execution-oriented: discussions end with a concrete decision and a handoff to a local coding Agent.
- Verifiable: release checks cover backend tests, frontend type checking/build, workflow validators, secret scanning, and desktop packaging.

## 可复现发布数据 / Reproducible Release Evidence

以下数据来自仓库内命令，不是营销估算：

- Backend test suite：`102` tests
- Frontend production build：`1678` modules transformed，gzip JavaScript 约 `133 kB`
- Route Reasoning Skill：`37` decision cards，`13` scenario test cases
- Claude Cabinet：`15/15` deterministic routing cases；示例路线比全程 Fable 估算低 `62.93%`

“能火”不能由代码保证；这些数据能让用户快速验证价值、降低试用成本，并让 GitHub 项目更容易被信任和传播。

## 核心功能

### 多 AI 会审与私聊

- 新建私聊：选择一个 AI 成员进行一对一对话。
- 新建会审：选择多个 AI 成员，自动分配主持、实现、审查、总结等职责。
- 多轮辩论：围绕同一任务连续讨论，并保留每轮上下文。
- 最终定案：汇总不同成员意见，生成可执行结论。
- 会话历史：支持搜索、重命名、置顶、删除、导出和继续会话。

### AI 成员与 Skill

- 管理默认成员和自定义成员。
- 为成员指定 Provider、model、API profile、本地工具和职责。
- 内置综合判断、系统化调试、TDD、代码实现、安全审查、前端设计、图像创作、网页测试等 Skill。
- Skill 会作为结构化职责提示注入会审上下文。

### CC Switch 集成

项目参考 [farion1231/cc-switch](https://github.com/farion1231/cc-switch) 的本地代理方式，默认连接：

```text
http://127.0.0.1:15721/v1
```

应用会：

- 检测 CC Switch 服务和当前 provider。
- 真实调用 `/v1/responses` 验证路由，而不是只检查端口。
- 自动尝试可用模型，并保存检测成功的 model。
- 支持 CC Switch 返回的 SSE 流式 Responses API。
- 将可调用的 CC Switch 路由计入系统 API readiness。

当前默认候选 model：

```text
gpt-5.5
gpt-5
gpt-4o
```

使用步骤：

1. 安装并启动 CC Switch。
2. 在 CC Switch 中添加并启用可用 provider。
3. 打开内阁的“系统设置”。
4. 在 CC Switch 配置中确认 endpoint 为 `http://127.0.0.1:15721/v1`。
5. 点击“检查”，应用会真实调用并自动选择可用 model。

### Provider 与中转站

支持内置或自定义 OpenAI-compatible provider：

- OpenAI
- Claude / Anthropic
- DeepSeek
- Gemini
- Qwen
- OpenRouter
- NewAPI
- CC Switch
- 自定义 OpenAI-compatible 中转站

Provider profile 支持 endpoint、model、credential env、headers、extra body、model mapping、连接测试和诊断。

### 自动检测与就绪状态

“系统设置”中的自动检测会检查：

- Backend 和 frontend build
- Desktop shell
- Provider profile 和真实 API 可调用状态
- CC Switch 服务、当前 provider 和真实路由
- 本地 coding CLI
- 项目文件读取
- Mock 会审、API 会审和最终定案
- Web AI adapter 与登录状态
- 问题反馈和图像生成 endpoint

检测结果区分：

- `coreReady`：核心本地流程可用
- `apiReady`：至少一个真实 API 或 CC Switch 路由可用
- `webAIReady`：至少一个支持的 Web AI 已登录且可调用
- `fullReady`：全部能力就绪

Web AI 登录是可选能力，不影响 CC Switch/API 核心流程。

### AI 图像创作

图像工作台支持：

- 选择已配置的 provider
- 自定义图像 model
- 创作任务、视觉风格、尺寸和质量
- Negative Prompt
- OpenAI-compatible `/images/generations` 调用
- 生成结果预览、打开原图和下载

图像 provider 必须支持 OpenAI-compatible image generation endpoint。

### 本地工程与 coding CLI

- 扫描并读取允许范围内的本地项目文件。
- 构建项目上下文、Shared Brief 和 Handoff Packet。
- 检测 Codex、Claude Code、Gemini CLI、Cursor 等本地工具。
- 预览或导出 Codex / Claude Code 配置。
- Executor 默认 dry-run；真实执行需要显式 confirmation token。

### Web AI

应用包含 ChatGPT、Claude、Gemini、DeepSeek、Qwen 等 Web AI 入口和 adapter 状态检测。

Web AI 依赖用户自行登录，网站结构变化时 adapter 可能需要更新。账号密码不会提交到仓库。

### 问题反馈

“问题反馈”页面会自动收集 Backend 和 CC Switch 运行状态，并生成可复制的问题报告。

- 报告默认保存到本机 `.synapse/runtime/issue_reports/`。
- 配置 SMTP 后可发送到指定反馈邮箱。
- 未配置 SMTP 时会打开本机邮件客户端。
- 反馈邮箱通过 `FEEDBACK_EMAIL` 配置，不需要写入公开代码。

## 隐私与 API Key 安全

- `.env`、`.synapse/`、本地配置、构建产物和运行日志均被 `.gitignore` 排除。
- 仓库只保留 `.env.example` 的空变量模板。
- API Key 不应写入源码、README、Issue、日志或 commit message。
- `/credentials` 仅返回 credential metadata 和 `key_available`，不返回原始 Key。
- 发布前运行 secret scan，它会扫描 tracked files 和 Git commit metadata。

```powershell
python scripts\validate_secret_scan.py
```

发现 Key 已经进入 Git 历史时，仅删除当前文件是不够的，必须撤销 Key、重写历史并 force push。

## Windows 快速启动

### 方式一：使用源码

环境要求：

- Python 3.11+
- Node.js 20+

```powershell
git clone <your-fork-url> synapse-relay
cd synapse-relay

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Copy-Item .env.example .env
npm install --prefix 内阁-ai-app
npm run build --prefix 内阁-ai-app

.\start_windows.bat
```

默认地址：

- Web UI：`http://127.0.0.1:3000`
- Backend：`http://127.0.0.1:8000`
- Backend API docs：`http://127.0.0.1:8000/docs`

### 方式二：构建 Portable 桌面版

```powershell
npm install --prefix desktop
npm run build --prefix 内阁-ai-app
npm run desktop:pack:portable
```

输出文件：

```text
dist-desktop/内阁 0.1.0.exe
```

## API 配置

复制 `.env.example` 为 `.env`，按需填写环境变量：

```dotenv
OPENAI_API_KEY_1=
CLAUDE_API_KEY_1=
DEEPSEEK_API_KEY_1=
GEMINI_API_KEY_1=
QWEN_API_KEY_1=
OPENROUTER_API_KEY_1=
NEWAPI_API_KEY_1=

CCSWITCH_API_KEY_1=
CCSWITCH_BASE_URL=http://127.0.0.1:15721

FEEDBACK_EMAIL=
FEEDBACK_SMTP_HOST=
FEEDBACK_SMTP_PORT=587
FEEDBACK_SMTP_USER=
FEEDBACK_SMTP_PASSWORD=
FEEDBACK_SMTP_FROM=
FEEDBACK_SMTP_TLS=true
```

CC Switch 本地路由通常不需要填写 `CCSWITCH_API_KEY_1`。第三方中转站是否需要 Key 取决于中转站配置。

## 开发与验证

Backend tests：

```powershell
python -m pytest backend/tests -q
```

Frontend：

```powershell
npm run lint --prefix 内阁-ai-app
npm run build --prefix 内阁-ai-app
```

完整验证：

```powershell
npm run validate
python scripts\validate_secret_scan.py
powershell -ExecutionPolicy Bypass -File .\release_check.ps1
```

## 主要目录

```text
backend/             FastAPI backend、Provider、会审和执行逻辑
内阁-ai-app/         React frontend
desktop/             Electron desktop shell
scripts/             验证、打包和安全扫描脚本
docs/                架构、Provider、App Target 和安全说明
```

## 当前限制

- Web AI 必须由用户自行登录，且受第三方网站页面变化影响。
- 图像生成依赖 provider 支持 `/images/generations`。
- Portable 桌面版不会内置任何用户 API Key。
- 首次源码运行需要安装 Python 和 Node.js dependencies。

## License

[Apache License 2.0](LICENSE)
