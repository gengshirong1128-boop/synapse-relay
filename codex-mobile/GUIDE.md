# CodexMobile 项目状态与连接指南

## 项目概述

CodexMobile 让你在手机上远程操控电脑里的 AI 编程 agent（Claude Code / Codex CLI）。
手机 App 通过 WebSocket 连到电脑上的 relay-server，relay-server 再调用本地 CLI。

```
手机 App  ──WebSocket──>  relay-server（你的电脑）  ──>  Claude Code / Codex CLI
```

- **不需要租服务器**：relay-server 内置 Cloudflare Tunnel，免费拿到公网地址
- **用户用自己的 API/账号**：密钥存在自己设备，relay 不经手
- **电脑端是本地程序**：双击 `start.bat` 即可运行（不是网页、不是插件）

---

## 当前已实现功能

### 后端（relay-server）

- WebSocket 服务端（端口 8765），配对码 + JWT 认证
- Cloudflare Tunnel 免服务器公网接入
- 管理 Claude Code / Codex CLI 子进程，解析 stream-json 输出
- 心跳保活（容忍一次漏拍，避免 tunnel 延迟误杀连接）
- 一键启动脚本 `start.bat`

### 前端（mobile-app）

- Expo (React Native)，iOS / Android
- 对话页、会话管理、文件浏览、设置（主题 + 语言）
- 扫码连接（相机扫 relay 二维码自动填地址 + 配对码）
- WebSocket 自动重连（连过即无限重连 + pong 超时自愈）

---

## 如何连接手机

### 前提条件

- 电脑安装 Node.js 20+ 和 Claude Code CLI（`npm i -g @anthropic-ai/claude-code`）
- 手机安装 Expo Go（iOS App Store / Android Play Store）
- 手机和电脑在同一 WiFi（或用 tunnel，任意网络均可）

### 步骤 1：启动 relay-server（电脑端）

**最简单**：双击 `relay-server/start.bat`，它会自动检查 Node、装依赖、构建、启动。

手动启动（开发用）：
```bash
cd codex-mobile/relay-server
node dist/index.js      # 先 npm run build 生成 dist
```
> 注意：开发时别用 `npm run dev`（tsx watch），改文件会热重载抢占 8765 端口导致
> EADDRINUSE。稳定运行用 `node dist/index.js`。

启动后终端显示：
```
+--------------------------------------+
| CodexMobile Relay Server             |
| Port:    8765                        |
| Code:    575504                      |  <- 配对码（每次重启会变）
| LAN:     ws://10.60.101.84:8765      |  <- 局域网地址
+--------------------------------------+

Connect URL : wss://xxx.trycloudflare.com   <- tunnel 公网地址（任意网络可连）
Pairing code: 575504
```

### 步骤 2：启动 mobile-app 开发服务器

```bash
cd codex-mobile/mobile-app
npm run start:tunnel     # = expo start --tunnel，绕开校园网/设备隔离
```

Expo 会建立 tunnel。给手机 Expo Go 用时，优先用 `exp://` deep link：

- 直连地址格式：`exp://<random>-anonymous-<port>.exp.direct`
- iPhone：Safari 打开 `https://<random>-anonymous-<port>.exp.direct/_expo/link?platform=ios`
  会自动跳 Expo Go
- 安卓：Expo Go 里 "Enter URL manually" 粘贴 `exp://...`

> **取 exp 地址的可靠方法**：Expo SDK 54 在非交互终端里不打印二维码/地址。
> 浏览器打开 `http://localhost:8081/`（带 header `expo-platform: ios`），
> 读返回 JSON 的 `extra.expoClient.hostUri`，拼成 `exp://<hostUri>`。
>
> 辅助二维码页：`preview/qr.html`（更新里面的 tunnel 地址后用电脑浏览器打开，手机扫码）。

### 步骤 3：手机配对

1. App 启动后进入「连接」页
2. 输入**服务器地址**：
   - 同 WiFi：`ws://你电脑的局域网IP:8765`（如 `ws://10.60.101.84:8765`）
   - 任意网络：步骤 1 显示的 `wss://xxx.trycloudflare.com`
3. 输入**配对码**：终端显示的 6 位数字
4. 点「配对连接」，或用扫码功能扫终端二维码自动填
5. 成功后自动跳到对话页

> 注意：Expo tunnel 只负责把手机 App 打开，**不代理 relay-server 的 WebSocket**。
> App 里仍必须能连到 relay（局域网 IP 或 relay 的 tunnel 地址）。

### 步骤 4：开始对话

- 在输入框输入任何问题，Claude Code / Codex 会在电脑上执行并返回结果
- 顶部 Claude/Codex pill 可切换后端
- 同一会话内有多轮对话上下文

---

## 网络问题排查

### 校园网/公共 WiFi（设备隔离）

校园网（如 `web.wlan.bjtu`）通常隔离设备，手机连不到电脑局域网 IP。解决：
- **用 relay 的 tunnel 地址**（`wss://xxx.trycloudflare.com`），不受局域网限制
- 或**手机开热点让电脑连**，热点下无隔离，可用局域网 IP

### Shadowrocket 配置（若手机挂代理）

必须让手机直连电脑内网地址，不走代理。在 Shadowrocket 中：
1. 确保全局路由模式为「配置」（不是「代理」）
2. 编辑当前配置 → `[Rule]` 部分添加：
   ```
   IP-CIDR,10.0.0.0/8,DIRECT
   ```
3. 保存后规则生效

### Windows 防火墙

首次启动 relay 时 Windows 会弹窗，点「允许」放行 TCP 8765。
（用 tunnel 地址连则不受防火墙影响。）

### 你的电脑信息（参考）

- 局域网 IP：`10.60.101.84`（网卡 `WLAN`）
- `192.168.x.1` 是 VMware 虚拟网卡，**不是真实 WiFi**，别用

---

## 已知问题 & 下一步

### 当前限制

- 免费 Cloudflare tunnel 对长连接不稳定，会掉线（已加客户端重连 + 服务端心跳容错缓解）
- tunnel 地址每次重启都变，需看终端最新输出
- relay-server 需在用户自己电脑运行，配套 CLI 需自行安装登录

### 未来优化方向

1. 真机长时间验证断连修复效果
2. 二维码连接体验打磨
3. 固定 tunnel 域名（需 Cloudflare 账号）
4. 上架准备（Apple 开发者账号 + EAS build + 隐私政策）
5. Markdown 渲染 + 代码块语法高亮

---

## 项目文件结构

```
codex-mobile/
├── relay-server/
│   ├── src/
│   │   ├── index.ts          # 入口：启动服务、显示配对码、tunnel
│   │   ├── config.ts         # 配置管理（端口、JWT、TLS 等）
│   │   ├── auth.ts           # 认证：配对码生成、JWT 签发/验证
│   │   ├── ws-server.ts      # WebSocket 服务端主逻辑
│   │   ├── process-manager.ts # CLI 进程管理 + stream-json 解析
│   │   ├── heartbeat.ts      # 心跳存活判定（纯函数，有测试）
│   │   ├── tunnel.ts         # Cloudflare Tunnel 管理
│   │   └── logger.ts         # 结构化日志
│   ├── start.bat             # 一键启动脚本（双击运行）
│   └── .env.example
└── mobile-app/
    ├── app/
    │   ├── (tabs)/
    │   │   ├── index.tsx      # 对话页
    │   │   ├── sessions.tsx   # 会话管理
    │   │   ├── files.tsx      # 文件浏览
    │   │   └── settings.tsx   # 设置（主题/语言）
    │   ├── connect.tsx        # 配对连接页
    │   └── scan.tsx           # 扫码连接页
    ├── services/
    │   ├── websocket.ts       # WebSocket 客户端
    │   ├── reconnect.ts       # 重连状态机（纯函数，有测试）
    │   ├── pairing.ts         # 扫码解析（纯函数，有测试）
    │   └── storage.ts         # SecureStore 封装
    ├── store/index.ts         # Zustand 全局状态
    └── theme/colors.ts        # 主题配色
```
