# Provider Profile Format

`ProviderProfile` fields:

- `profile_id`
- `name`
- `provider`
- `api_format`: `openai_compatible | anthropic | gemini | qwen | openrouter | newapi | mock`
- `base_url`
- `default_model`
- `models`
- `credential_id`
- `enabled`
- `target_apps`: `synapse | claude_code | codex | gemini_cli | opencode | generic_cli`
- `headers`
- `extra_body`
- `model_mapping`
- `system_prompt_template`
- `timeout_seconds`
- `max_retries`
- `stream_supported`
- `tool_call_supported`
- `auth_env_name` (optional for Anthropic gateways)
- `notes`

Security:

- Profile data does not contain raw API key values.
- Keys are managed by `Credential` entries via env variable names.
