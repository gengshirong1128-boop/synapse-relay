# Safety Notes

## Provider Safety

- `/credentials` never returns raw key values.
- Profiles reference env variable names only.

## Executor Safety

- Default execution mode is dry-run.
- Non-dry-run requires confirmation token.
- Execution is restricted to attached project path.
- Commands use `shell=False`.

## Context Safety

- `.env` content is never read by project reader.
- Selected files/snippets are visible before context build.
