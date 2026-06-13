# Agent Relay

本地 Agent 协作调度器。它解决多个 coding agents 同时处理一个项目时的信息差和文件冲突问题。

Local agent collaboration scheduler that prevents information gaps and conflicting edits.

## 核心流程 / Core Flow

1. 检测本地 `Codex`、`Claude Code`、`Gemini CLI`、`OpenCode` 等工具。
2. 每个 Agent 执行前必须声明 `read_paths`、`write_paths` 和 `depends_on`。
3. 无冲突任务自动进入同一 wave 并行执行；冲突任务强制串行。
4. 监工 Agent 只读取共享计划和运行状态，并将建议同步给执行 Agent。
5. 执行结束后审计项目改动；未声明修改会阻止计划显示完成。

1. Detect local coding agents.
2. Require declared reads, writes, and dependencies before execution.
3. Run independent tasks concurrently and serialize conflicting tasks.
4. Let a read-only supervisor agent monitor progress and publish shared advice.
5. Audit changed files and flag undeclared modifications.

## 可验证数据 / Verified Data

- `114` backend tests pass.
- Frontend production bundle: about `66.05 kB` gzip JavaScript.
- Frontend and desktop npm audits: `0 vulnerabilities`.
- Portable Windows build verified.
- Removed about `9,600` lines of obsolete meeting, image, and tool-dashboard frontend code.

## 安全边界 / Safety Boundaries

- Agent tasks cannot declare writes to `.git`, `.synapse`, `.venv`, or `node_modules`.
- Later waves cannot start before earlier waves complete.
- Active write paths are locked against overlapping tasks.
- Shared plans and events are stored under `.synapse/collaboration/`.
- Agent CLIs are not OS-level sandboxes. Agent Relay detects undeclared writes after execution, but cannot prove which process performed a concurrent write.

## 启动 / Run

```powershell
python launch.py
```

或运行 Windows portable：

```text
dist-desktop/Agent Relay 0.2.0.exe
```

## 验证 / Verify

```powershell
powershell -ExecutionPolicy Bypass -File .\release_check.ps1
python -m pytest backend\tests -q
npm run lint --prefix 内阁-ai-app
npm run build --prefix 内阁-ai-app
```

## API

- `GET /orchestration/agents`
- `POST /orchestration/plans`
- `GET /orchestration/plans/{plan_id}`
- `POST /orchestration/plans/{plan_id}/tasks/{task_id}/start`
- `POST /orchestration/plans/{plan_id}/supervisor/start`
- `POST /orchestration/plans/{plan_id}/advice`

License: MIT
