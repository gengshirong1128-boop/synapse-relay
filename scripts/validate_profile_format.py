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

    profiles = client.get('/provider-profiles')
    assert_true(profiles.status_code == 200, 'provider profiles endpoint failed')
    data = profiles.json().get('profiles', [])
    assert_true(len(data) > 0, 'no provider profiles returned')

    required_fields = {
        'profile_id', 'name', 'provider', 'api_format', 'base_url', 'default_model', 'models',
        'credential_id', 'enabled', 'target_apps', 'headers', 'extra_body', 'model_mapping',
        'system_prompt_template', 'timeout_seconds', 'max_retries', 'stream_supported',
        'tool_call_supported', 'notes'
    }
    for item in data:
        missing = required_fields - set(item.keys())
        assert_true(not missing, f'missing fields in profile: {missing}')
        assert_true('api_key' not in item and 'secret' not in item, 'profile should not include key material')

    creds = client.get('/credentials')
    assert_true(creds.status_code == 200, 'credentials endpoint failed')
    for item in creds.json().get('credentials', []):
        assert_true('api_key' not in item and 'key' not in item and 'secret' not in item, 'credential leaked key')

    diagnose = client.post('/provider-profiles/deepseek_default_profile/diagnose', json={'smoke_test': False})
    assert_true(diagnose.status_code == 200, 'diagnose endpoint failed')

    print('Validation passed: provider profile format and diagnostics are working.')


if __name__ == '__main__':
    main()
