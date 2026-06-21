# CodexMobile 代码审查

## P1

### 【relay-server/src/ws-server.ts:344】【严重度：P1】【现象】已认证客户端可通过 `payload.cwd` 指向任意本机目录，再用 `file_list` / `file_content` 浏览和读取该目录内文件。

【根因】`FileService` 只保证 `path` 在传入的 `cwd` 内，但 `cwd` 本身完全信任客户端。`handleFileList()`、`handleFileContent()` 每次都用 `msg.payload.cwd || defaultWorkspacePath()` 创建 `FileService`，服务端没有校验该 `cwd` 是否来自已发现/已批准 workspace。

【修复建议】服务端维护 canonical workspace allowlist，仅允许 `discoverWorkspaces()` 返回或用户显式批准的根目录；文件接口优先使用服务端保存的 session cwd，不接受每次请求传入任意 cwd。

### 【mobile-app/components/agent/AgentThread.tsx:34】【严重度：P1】【现象】连接电脑或打开历史会话后，聊天记录先显示顶部，再肉眼可见滚到底部。

【根因】`setSessionMessages()` 一次性写入历史消息后，`FlatList` 首帧按默认顶部渲染；随后 `onContentSizeChange` 执行 `scrollToEnd({ animated: false })`。即使 `animated: false`，React Native 仍会先绘制顶部，再在下一帧跳到底部。`AgentThread` 没有 `initialScrollIndex`、反向列表或“首帧等待布局完成”的策略。

【修复建议】在任务 4 中改 `AgentThread` 的初始定位逻辑：对已有历史消息使用 `initialScrollIndex={messages.length - 1}` + `getItemLayout` 或改为 `inverted` 列表；同时用 session/message 批次 key 区分历史加载和实时追加，避免历史加载时先渲染顶部。

### 【relay-server/src/ws-server.ts:268】【严重度：P1】【现象】同一个 `sessionId` 可携带不同 `backend` / `transportMode` / `cwd` 再次发命令，服务端仍会把用户消息追加到旧 session，并按旧 backend/cwd 执行。

【根因】`handleCommand()` 只用 `sessionId` 判断是否已有 process session。已有 session 时不强制校验三元组，后续 `runCommand()` 使用 `ProcessManager` 里旧的 `SessionInfo`，但 `SessionStore` 追加的是新请求的用户文本，容易造成会话错乱。

【修复建议】服务端同样执行 `sessionId + backend + transportMode` 一致性校验，必要时连同 `cwd` 一起校验；不一致时拒绝请求或创建新 session，不能复用旧 session。

### 【relay-server/src/process-manager.ts:79】【严重度：P1】【现象】同一会话运行中再次发送消息，会中断当前 agent 任务并启动新任务。

【根因】`runCommand()` 遇到 `session.state === 'running'` 时调用 `stopRunningSession(session)`，随后继续启动新命令；但 `ws-server.ts:320` 的失败分支文案写的是 `Session busy`，说明预期行为应是拒绝并等待当前任务完成。实际行为会让用户重复点击发送、网络重发或队列消息导致当前任务被杀掉。

【修复建议】将运行中会话改为直接 `return false`，由 `ws-server.ts` 返回 busy 错误；如果需要“打断并发送”，应设计独立的显式 command 类型，不要复用普通发送。

### 【relay-server/src/auth.ts:18】【严重度：P1】【现象】6 位 pairing code 在被使用前长期有效，且没有失败次数限制；relay 暴露到 LAN 或 tunnel 后可被暴力尝试。

【根因】`verifyPairingCode()` 只比较字符串并在成功后清空，没有 TTL、attempt counter、IP/socket 级 backoff 或失败后轮换。

【修复建议】给 pairing code 加 2-5 分钟过期时间；按 socket/IP 统计失败次数，失败过多关闭连接并轮换 code；认证失败返回不应泄露更多状态。

### 【relay-server/src/ws-server.ts:111】【严重度：P1】【现象】`LOG_LEVEL=debug` 时会记录原始入站消息前 200 字符，可能包含 `token`、`pairingCode`、`apiConfig.apiKey`。

【根因】日志在 JSON parse 前直接记录 raw message，没有字段级脱敏。

【修复建议】只记录 `type`、`sessionId`、payload key 列表等非敏感字段；如需 payload，先 parse 并 redact `token`、`pairingCode`、`apiKey`。

### 【mobile-app/services/auth.ts:82】【严重度：P1】【现象】配对时候选地址有多个，某个候选先连上但认证失败或连接马上切换时，后续候选不会重新发送配对码。

【根因】`pairAndSave()` 用单个 `authSent` 标记控制发送 pairing auth。只要第一次进入 `connected` 就置为 true；如果该候选认证失败、被关闭、或随后 fallback 到下一个候选，后续连接不会再发送 `{ type: 'auth', payload: { pairingCode } }`。

【修复建议】把 auth 发送绑定到具体 WebSocket 连接或候选 URL，而不是全局一次性布尔值；每次新 socket 进入 `connected` 都应发送 pairing auth，直到收到成功 token 或整体超时。

## P2

### 【mobile-app/hooks/useRelayMessages.ts:34】【严重度：P2】【现象】自动连接、手动配对、全局消息监听都可能覆盖 `RelayClient` 的 state listener，导致连接状态或连接后初始化消息丢失。

【根因】`RelayClient` 只有一个 `onStateChange` 函数；`useRelayMessages()`、`attemptAutoConnect()`、`pairAndSave()` 都调用 `setStateListener()`。后调用者会覆盖先调用者。配对完成后如果 listener 没恢复，全局 `useRelayMessages()` 中连接成功后发送 `agent_info/list_workspaces/session_list` 的逻辑可能不再执行。

【修复建议】把 `RelayClient` 状态监听改成 `Set<(state) => void>`，返回 unsubscribe；连接页和全局 hook 都订阅同一个状态流，互不覆盖。

### 【mobile-app/app/(tabs)/settings.tsx:71】【严重度：P2】【现象】Settings 里的服务器地址“保存”只改内存状态，未持久化也未重连；重启后仍使用旧地址。

【根因】`saveConnection` 只调用 `setServerUrl(localUrl)`，没有复用 `validateRelayUrl()`，也没有写入 `storage.setServerUrl()` / `storage.setServerUrls()` 或触发重连。

【修复建议】保存时校验地址并持久化；如果是单地址手动模式，更新候选列表后调用 `relayClient.connect()` 或引导用户走 pairing flow。

### 【mobile-app/hooks/usePushNotifications.ts:48】【严重度：P2】【现象】生产环境 push token 获取使用全零 `projectId`，会导致 Expo push 注册失败并被静默吞掉，relay 收不到 `pushToken`。

【根因】`Notifications.getExpoPushTokenAsync()` 硬编码 `00000000-0000-0000-0000-000000000000`，没有读取 EAS/Expo 配置；catch 块也没有对 UI 暴露失败状态。

【修复建议】从 `Constants.easConfig?.projectId` 或 `Constants.expoConfig?.extra?.eas?.projectId` 读取真实 project id；失败时设置可见状态或日志，避免生产功能静默失效。

### 【relay-server/src/session-store.ts:149】【严重度：P2】【现象】流式输出每个 delta 都会同步写完整 `sessions.json`，高频输出时会阻塞 Node event loop，影响 WebSocket 响应和 heartbeat。

【根因】`updateStreamingMessage()` 每次追加文本后直接调用 `save()`，而 `save()` 使用 `writeFileSync()` 写完整 sessions 数组。

【修复建议】内存更新即时生效，持久化改为 debounce、turn 完成时保存，或使用 async write + atomic rename。

### 【mobile-app/store/index.ts:315】【严重度：P2】【现象】远端刷新可能保留一个不属于当前 backend/transportMode 的 activeSessionId，随后 `useAgentSession` 找不到 exact session，又回退到另一个 latest session。

【根因】`mergeRemoteSessions()` 的 `activeStillValid` 只判断 `activeSessionId` 是否存在于 merged，不校验 session 的 `backend` 和 `transportMode` 是否仍匹配当前选择。当前会话三元组约束要求三者一致。

【修复建议】`activeStillValid` 应校验 active session 同时满足当前 `activeBackend` 和对应 transport mode；否则从 `inScope` 选择最新会话或置空。

### 【mobile-app/app/(tabs)/sessions.tsx:62】【严重度：P2】【现象】当前 backend 没有会话、另一个 backend 有会话时，会话页显示空白列表而不是空状态。

【根因】空状态判断使用 `sessions.length === 0`，但渲染数据使用过滤后的 `sections`。当全局 sessions 非空但当前 backend 的 sections 为空时，`SectionList` 没有 `ListEmptyComponent`。

【修复建议】改为判断 `sections.length === 0`，并按当前 backend 展示“暂无 Codex/Claude 会话”的空状态；刷新中也应有明确反馈。

### 【mobile-app/app/_layout.tsx:21】【严重度：P2】【现象】用户在设置里切换深浅主题后，系统主题变化或页面重新挂载会覆盖用户选择。

【根因】根布局 `useEffect(() => { if (systemScheme) setTheme(systemScheme); }, [systemScheme])` 无条件把系统主题写入全局 store。`storage.ts` 有 theme 持久化接口，但当前根布局没有先读用户选择，也没有区分“跟随系统”和“手动选择”。

【修复建议】增加 theme source 状态：`system`/`manual`；仅首次无用户偏好时跟随系统。设置页手动切换后写入 storage，并阻止系统变化覆盖。

### 【relay-server/src/codex-app-server-client.ts:297】【严重度：P2】【现象】Codex app-server 请求超时后，底层 timeout 仍会执行，可能对已完成请求重复删除/拒绝，长期运行下也会积累无意义 timer。

【根因】`request()` 为每个 pending 创建 `setTimeout`，但收到响应时只 `pending.delete(id)`，没有 `clearTimeout(timer)`。超时回调依赖 `pending.has(id)` 避免重复 reject，但 timer 本身仍会保留到 30 秒。

【修复建议】把 timer 存进 pending 结构，响应或 close 时统一 `clearTimeout()`。

### 【relay-server/src/codex-app-server-client.ts:468】【严重度：P2】【现象】停止或删除 Codex official-remote session 后，`threadToSession` 和 pending approvals 仍可能残留，后续同 thread 通知可能路由到已不存在的 session。

【根因】`ProcessManager.killSession()` 删除自己的 session map，但 `CodexAppServerClient` 没有公开清理 session/thread 映射和 approval 的方法。`interruptSession()` 只中断 turn，不清理 `threadToSession`、`sessions`、`pendingApprovals`。

【修复建议】新增 `disposeSession(sessionId)`，清理 Codex client 内部 `sessions`、对应 `threadToSession`、该 session 的 pending approvals，并在 `killSession()` 调用。

## P3

### 【mobile-app/components/agent/AgentMessageRow.tsx:52】【严重度：P3】【现象】工具失败色硬编码为 `#ff453a`，可能在 Claude/Codex 深浅主题下对比不一致。

【根因】组件绕过 `theme/colors.ts`，直接写平台红色。

【修复建议】在 `ThemeColors` 增加 `danger`/`dangerText` token，所有失败、删除、停止状态统一使用主题色。

### 【mobile-app/components/agent/AgentComposer.tsx:72】【严重度：P3】【现象】停止按钮硬编码 `#ff3b30/#fff`，违反双主题颜色约束。

【根因】`stopBtn` 和 `stopIcon` 直接写颜色，没有使用 `colors.*`。

【修复建议】同上，使用 `colors.danger` 和适配的前景色。

### 【mobile-app/app/scan.tsx:75】【严重度：P3】【现象】扫码页黑白覆盖层和按钮文字硬编码颜色，不随 Codex/Claude 主题变化。

【根因】`scan.tsx` 的 `container`、`btnText`、`frame`、`hint`、`cancel` 使用 `#000/#fff/rgba(...)`。虽然相机覆盖层需要强对比，但仍应通过 theme token 表达。

【修复建议】补充 scanner overlay 颜色 token，或复用 `colors.bg/text/surface/accent` 加透明度工具函数。

### 【mobile-app/app/profiles.tsx:121】【严重度：P3】【现象】删除按钮颜色硬编码为 `#ff453a`，和主题体系不一致。

【根因】profile 页面没有使用统一 danger token。

【修复建议】同 `AgentMessageRow`，统一接入 `ThemeColors.danger`。

### 【mobile-app/components/FileTree.tsx:25】【严重度：P3】【现象】每次 render 都复制并排序文件列表，大目录下滚动和搜索会产生额外开销。

【根因】`const sorted = [...files].sort(...)` 写在组件渲染体内，没有 `useMemo`。搜索输入每次变化都会触发排序。

【修复建议】用 `useMemo([files])` 缓存排序结果；后续任务 5 可顺手加 `initialNumToRender`、`windowSize`、`getItemLayout`。

### 【mobile-app/components/agent/AgentThread.tsx:30】【严重度：P3】【现象】长会话中每次流式输出都会触发 `onContentSizeChange` 和可能的 `scrollToEnd`，低端设备上容易抖动。

【根因】流式文本追加改变 content size；当前策略只用 `atBottomRef` 控制，但没有节流，也没有区分“新增消息”和“同一条流式消息增长”。

【修复建议】任务 5 中对 `scrollToEnd` 做 `requestAnimationFrame` 合并，消息行 `React.memo`，并让流式输出仅在用户靠近底部时跟随。

## 上架风险

### 【mobile-app/app/scan.tsx:37】【严重度：P2】【现象】相机权限用途只在 UI 中提示，App Store 审核还会看 `app.json` 权限文案是否明确。

【根因】扫码功能依赖 `expo-camera`；如果 `NSCameraUsageDescription` 只是泛泛描述，外区审核可能要求说明“用于扫描电脑 relay 连接二维码”。

【修复建议】确认 `app.json` 的 `ios.infoPlist.NSCameraUsageDescription` 使用面向用户的明确文案。后续任务 3/6 做 UI 状态分析时一起检查真实配置。

### 【relay-server/src/config.ts:30】【严重度：P2】【现象】未配置 `JWT_SECRET` 时每次 relay 重启都会生成随机 secret，旧 token 全部失效，用户需要重新扫码配对。

【根因】`loadConfig()` 在缺失 secret 时使用 `randomBytes(32)`，但没有持久化或明显提示。开发环境可接受，面向普通用户会表现为“重启电脑后 App 登不上”。

【修复建议】启动时明确打印 warning；`start.bat` 首次运行可生成本地 `.env` 或提示用户配置。注意不要改真实 `.env`。
