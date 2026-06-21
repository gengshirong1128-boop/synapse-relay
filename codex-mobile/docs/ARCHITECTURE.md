# CodexMobile 架构说明

## 目录结构

```text
codex-mobile/
  mobile-app/                      Expo React Native 手机端，负责连接电脑 relay、展示会话、设置和文件浏览。
    app/                           expo-router 页面入口。
      _layout.tsx                  根布局，初始化自动连接、relay 消息订阅、push、前后台重连。
      connect.tsx                  连接页，支持扫码或手动输入 LAN/VPN/tunnel 地址和配对码。
      scan.tsx                     QR 扫码页，解析 relay 打印的 pairing payload。
      profiles.tsx                 API profile 管理页。
      (tabs)/                      主 Tab 页面组。
        _layout.tsx                Tab 导航布局。
        index.tsx                  聊天页，承载输入、消息流、运行状态、审批和停止。
        sessions.tsx               会话列表，按 backend 和 transportMode 分组。
        files.tsx                  工作区文件浏览和只读文件查看。
        settings.tsx               agent、模型、连接模式、workspace、权限、外观设置。
    assets/                        Expo 图标等静态资源。
    components/                    可复用 UI 组件。
      agent/                       聊天线程、消息行、输入框、审批、运行状态、头部组件。
      navigation/                  自定义底部 TabBar。
      settings/                    设置页卡片、选项 chips、agent/workspace selector。
      FileTree.tsx                 文件列表/目录导航组件。
    hooks/                         业务 hooks。
      useAgentSession.ts           组装当前会话上下文，发送 command/stop/approval。
      useRelayMessages.ts          监听 relay WebSocket 消息并写入 zustand store。
      usePushNotifications.ts      注册 Expo push token。
      useTheme.ts                  主题读取封装。
    i18n/                          简单中英文文案入口。
    services/                      客户端基础服务。
      websocket.ts                 RelayClient，候选地址探测、心跳、重连、消息分片合并。
      auth.ts                      自动 token 登录、pairingCode 配对和保存。
      pairing.ts                   解析 QR payload，生成 LAN/VPN 优先、tunnel 兜底的候选地址。
      relayUrl.ts                  校验 ws:// 和 wss:// relay 地址。
      reconnect.ts                 重连策略纯函数。
      storage.ts                   SecureStore/localStorage 持久化 token、server URLs、主题和 API 配置。
      profiles.ts                  API profile 存取。
    store/                         zustand 全局状态。
      index.ts                     连接、sessions、backend、transport、workspace、审批、模型状态。
      index.test.ts                store 行为测试。
    theme/                         双主题颜色定义。
      colors.ts                    Codex/Claude 及深浅主题颜色 token。
    app.json                       Expo 应用配置。
    eas.json                       EAS build 配置。
    package.json                   mobile 脚本和依赖。
    tsconfig.json                  TypeScript 配置。

  relay-server/                    Node/TypeScript WebSocket 中继，运行在用户自己的电脑上。
    src/
      index.ts                     入口，加载配置、启动 WebSocket、枚举 LAN/VPN IP、启动 tunnel、打印 QR。
      ws-server.ts                 WebSocket 协议层，处理 auth、command、session、file、approval 消息。
      process-manager.ts           agent 执行层，启动 Claude/Codex CLI 或 Codex app-server。
      codex-app-server-client.ts   Codex official-remote 客户端，连接/拉起 39877 app-server。
      claude-session-reader.ts     读取 Claude Code 历史 jsonl 会话。
      session-store.ts             relay 本地会话和消息持久化。
      file-service.ts              工作区内安全文件列表/读取。
      auth.ts                      一次性 pairingCode 和 JWT token。
      tunnel.ts                    Cloudflare quick tunnel 管理。
      agent-info.ts                探测本机 agent、模型、能力。
      workspace-discovery.ts       发现可选工作区。
      heartbeat.ts                 relay 心跳判断逻辑。
      token-tracker.ts             token 使用统计辅助。
      push-service.ts              push token 注册/通知占位服务。
      logger.ts                    日志封装。
      config.ts                    .env 配置加载。
      types.d.ts                   类型补充。
      *.test.ts                    relay 侧 vitest 测试。
    .codex-mobile/                 relay 本地运行数据目录。
    .env.example                   relay 配置模板。
    start.bat                      Windows 一键启动脚本。
    test-e2e.ts                    relay 端到端测试脚本。
    package.json                   relay 脚本和依赖。
    tsconfig.json                  TypeScript 配置。

  preview/                         静态预览页面。
  GUIDE.md                         现有使用指南。
```

## 数据流

1. 手机端 `app/(tabs)/index.tsx` 使用 `useAgentSession.send()` 读取当前 `backend`、`transportMode`、`model`、`workspacePath` 和输入文本。
2. `useAgentSession.send()` 复用当前 session，或创建新的本地 `session-${Date.now()}`，再调用 `relayClient.send({ type: 'command', sessionId, payload })`。
3. `services/websocket.ts` 把消息序列化为 WebSocket JSON 发到用户电脑上的 relay。
4. `relay-server/src/ws-server.ts` 校验 token/pairing 后进入 `handleCommand()`，写入 `SessionStore`，再调用 `ProcessManager.runCommand()`。
5. `ProcessManager` 按 `backend + transportMode` 分流：
   - `claude-code + bridge`：运行 `claude --print --verbose --output-format stream-json --bare ... -- <prompt>`。
   - `codex + bridge`：运行 `codex ... exec --json`，并通过 stdin 写入 prompt。
   - `codex + official-remote`：连接或拉起本机 `codex app-server --listen ws://127.0.0.1:39877`，调用 `thread/start|resume` 和 `turn/start`。
   - `claude-code + official-remote`：当前只做能力探测，不真正控制，发消息会返回错误提示切回 CLI。
6. CLI stdout JSON 或 Codex app-server notification 被解析为 `output`、`thinking`、`tool_use`、`tool_update`、`approval_request`、`usage`、`exit`。
7. `ws-server.ts` 只向订阅该 `sessionId` 的手机端广播事件；大于 64KB 的消息用 `__chunk` 分片。
8. 手机端 `useRelayMessages.ts` 收到事件后更新 zustand store：追加消息、更新流式输出、工具状态、审批队列、token、session 状态。
9. UI 由 `AgentThread`、`ApprovalBanner`、`AgentRunStatus`、`AgentComposer` 渲染最新状态。
10. 审批操作从 `ApprovalBanner` 发出 `approval_response`，relay 转给 `CodexAppServerClient.resolveApproval()`，再回复 Codex app-server。

## 连接机制

relay 启动时，`index.ts` 调用 `getLanIps()` 枚举本机 IPv4 地址：

- 过滤 `169.254.*`、内部地址、VMware/VirtualBox/Docker/Hyper-V 等虚拟容器网卡。
- 物理 WiFi/Ethernet 排在最前。
- ZeroTier/Tailscale/WireGuard 等虚拟局域网地址排在其次。
- 其他可用 IPv4 地址排在最后。

如果 `TUNNEL_ENABLED=true`，`TunnelManager` 会启动 Cloudflare quick tunnel，并把 `https://*.trycloudflare.com` 转成 `wss://*.trycloudflare.com`。

relay 打印的 QR payload：

```json
{
  "lanUrls": ["ws://192.168.x.x:8765", "ws://10.x.x.x:8765"],
  "tunnelUrl": "wss://xxx.trycloudflare.com",
  "code": "123456"
}
```

App 扫码后，`services/pairing.ts` 生成候选地址顺序：

1. 局域网直连 `ws://<LAN IP>:8765`
2. ZeroTier/Tailscale 等虚拟局域网 `ws://<VPN IP>:8765`
3. Cloudflare tunnel `wss://*.trycloudflare.com`

`RelayClient.connect()` 按候选顺序探测。只要当前地址后面还有 fallback，就给当前地址 3 秒 `LAN_PROBE_MS`；未连上则关闭 socket 并尝试下一个地址。连接成功后每 30 秒发 `ping`，relay 回 `pong`。如果缺失 `pong`，App 主动断开并重连。

首次连接最多重试 10 次；只要曾经成功连接过，后续断线会持续重试，并且每一轮都从 LAN/VPN 候选重新开始，再落到 tunnel。

## 运行方式

### relay-server

relay-server 是跑在用户自己的电脑上的本地中继，不是租的云服务器。

```powershell
cd codex-mobile\relay-server
npm install
npm run build
npm start
```

等价于：

```powershell
npx tsc
node dist/index.js
```

Windows 用户也可以直接运行：

```powershell
codex-mobile\relay-server\start.bat
```

常用 `.env`：

```env
PORT=8765
JWT_SECRET=change-this
AUTH_TOKEN_EXPIRY=30d
TUNNEL_ENABLED=false
CLAUDE_CODE_PATH=claude
CODEX_PATH=codex
SESSION_TIMEOUT_MS=3600000
CODEX_APP_SERVER_PORT=39877
```

如果需要 Cloudflare tunnel 兜底：

```env
TUNNEL_ENABLED=true
```

### mobile-app

```powershell
cd codex-mobile\mobile-app
npm install
npm run start:tunnel
```

手机用 Expo Go 扫 Expo 终端二维码加载 App。

### 手机连接电脑

同 WiFi：

1. 在电脑运行 relay。
2. 手机打开 App 的连接页扫码。
3. App 优先连接 `ws://<电脑局域网 IP>:8765`。

ZeroTier/Tailscale：

1. 电脑和手机加入同一个虚拟局域网。
2. 运行 relay 并扫码。
3. App 会在 LAN 地址之后尝试 `ws://<ZeroTier/Tailscale IP>:8765`。

Cloudflare tunnel：

1. relay `.env` 设置 `TUNNEL_ENABLED=true`。
2. 运行 relay，等待终端打印 `Tunnel URL`。
3. 手机扫码后，如果 LAN/VPN 都不可达，会自动尝试 `wss://*.trycloudflare.com`。

## 部署说明

CodexMobile 的部署模型是：

```text
手机 App <-> 用户电脑上的 relay-server <-> 用户电脑上的 Claude Code CLI / Codex CLI / Codex app-server
```

relay-server 必须在用户自己的电脑上运行，因为它需要访问本机 CLI、工作区文件、Codex app-server 和 Claude/Codex 本地会话数据。不需要租云服务器。Cloudflare tunnel 只负责把用户电脑上的本地 relay 暴露给手机访问，不承载 agent 运行逻辑。
