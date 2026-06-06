# Security Policy

## Supported Versions

The latest main branch is supported.

## Reporting a Vulnerability

Please open a private security report with:

- affected component
- reproduction steps
- potential impact
- suggested mitigation (optional)

## Security Principles

1. Never expose raw API keys in frontend responses.
2. Keep runner default in dry-run mode.
3. Require explicit confirmation token for non-dry-run execution.
4. Restrict runner execution to attached project path.
