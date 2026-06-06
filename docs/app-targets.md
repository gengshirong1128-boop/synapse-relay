# App Targets

Synapse Relay supports app-target config preview/export for:

- `claude_code`
- `codex`
- `gemini_cli`
- `opencode`
- `generic_cli`

Core endpoints:

- `GET /app-targets`
- `POST /app-targets/preview-config`
- `POST /app-targets/export-config`
- `POST /app-targets/check`

Target shortcuts:

- `POST /app-targets/claude-code/preview`
- `POST /app-targets/claude-code/export`
- `POST /app-targets/codex/preview`
- `POST /app-targets/codex/export`

Notes:

- Default behavior is dry-run preview.
- Writing config files requires `dry_run=false` and explicit `confirm_write=true`.
- Output includes `env_script`, `command_preview`, `profile_json`, and `warnings`.
