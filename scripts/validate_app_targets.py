from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    client = TestClient(app)

    resp = client.get('/app-targets')
    assert_true(resp.status_code == 200, 'app-targets list failed')

    preview = client.post('/app-targets/claude-code/preview', json={
        'target_app': 'claude_code',
        'profile_id': 'claude_default_profile',
        'export_mode': 'env',
        'dry_run': True,
        'write_config': False,
    })
    assert_true(preview.status_code == 200, 'claude preview failed')

    preview_codex = client.post('/app-targets/codex/preview', json={
        'target_app': 'codex',
        'profile_id': 'deepseek_default_profile',
        'export_mode': 'env',
        'dry_run': True,
        'write_config': False,
    })
    assert_true(preview_codex.status_code == 200, 'codex preview failed')

    export_dry = client.post('/app-targets/export-config', json={
        'target_app': 'claude_code',
        'profile_id': 'claude_default_profile',
        'export_mode': 'settings_json',
        'dry_run': True,
        'write_config': True,
        'confirm_write': False,
    })
    assert_true(export_dry.status_code == 200, 'dry-run export failed')
    assert_true(export_dry.json().get('written') is False, 'dry-run export should not write config')

    # build room + project for runner confirm-token validation
    room = client.post('/room/create', json={
        'title': 'app target run validate',
        'owner_user': 'User',
        'host_agent': {'name': 'Mock GPT', 'provider': 'mock', 'role': 'host'},
    }).json()['room']

    scan = client.post('/project/scan', json={'project_path': str(ROOT), 'max_file_size_bytes': 1048576}).json()
    project_id = scan['project_id']
    client.post(f'/project/{project_id}/context-build', json={'question': 'validate', 'selected_paths': []})
    client.post(f"/room/{room['room_id']}/project/attach", json={'project_id': project_id, 'question': 'validate', 'selected_paths': []})

    room_data = client.get(f"/room/{room['room_id']}").json()['room']
    project_path = room_data['attached_project_path']

    run = client.post('/executor/run/codex', json={
        'executor_type': 'codex',
        'project_path': project_path,
        'prompt': 'test prompt',
        'dry_run': False,
        'timeout_seconds': 5,
        'allow_write': False,
        'extra_args': [],
    })
    assert_true(run.status_code == 200, 'runner request failed')
    run_json = run.json()
    assert_true(run_json.get('require_confirmation_token') is True or 'not available' in (run_json.get('error') or ''), 'non-dry-run without token should be rejected unless binary missing')

    print('Validation passed: app-target previews/exports and confirmation-token guard are working.')


if __name__ == '__main__':
    main()
