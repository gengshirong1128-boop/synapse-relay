# Contributing

## Development Flow

1. Create a feature branch.
2. Keep changes incremental and backward compatible.
3. Run release checks before opening PR:
   - `python scripts\\validate_all.py`
   - `python scripts\\validate_release_ready.py`
   - `powershell -ExecutionPolicy Bypass -File .\\release_check.ps1`

## Pull Request Checklist

- [ ] No secrets in code or logs
- [ ] Existing workflows still pass
- [ ] New behavior has validation coverage
- [ ] UI labels are clear and non-breaking

## Code Style

- Python: keep functions small and explicit
- Frontend: avoid implicit global state mutation without render refresh
- Keep mock fallback behavior available for demo
