from __future__ import annotations

from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
SYNAPSE_DIR = ROOT / '.synapse'
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    client = TestClient(app)

    room_resp = client.post('/room/create', json={
        'title': 'History Validate Room',
        'owner_user': 'User',
        'host_agent': {'name': 'Mock GPT', 'provider': 'mock', 'role': 'host'},
    })
    assert_true(room_resp.status_code == 200, f'create room failed: {room_resp.text}')
    room_id = room_resp.json()['room']['room_id']

    msg_resp = client.post(f'/room/{room_id}/message', json={'content': 'history store hello message'})
    assert_true(msg_resp.status_code == 200, f'post message failed: {msg_resp.text}')

    room_file = SYNAPSE_DIR / 'rooms' / f'{room_id}.json'
    assert_true(room_file.exists(), 'room json not saved under .synapse/rooms')

    list_resp = client.get('/history/rooms')
    assert_true(list_resp.status_code == 200, f'history list failed: {list_resp.text}')
    rooms = list_resp.json().get('rooms', [])
    assert_true(any(item.get('room_id') == room_id for item in rooms), 'history list missing created room')

    rename_resp = client.post(f'/history/rooms/{room_id}/rename', json={'title': 'Renamed History Room'})
    assert_true(rename_resp.status_code == 200, f'rename failed: {rename_resp.text}')

    search_resp = client.get('/history/search', params={'q': 'hello message'})
    assert_true(search_resp.status_code == 200, f'search failed: {search_resp.text}')
    found = search_resp.json().get('rooms', [])
    assert_true(any(item.get('room_id') == room_id for item in found), 'search did not find room by message')

    load_resp = client.get(f'/history/rooms/{room_id}')
    assert_true(load_resp.status_code == 200, f'load history room failed: {load_resp.text}')
    loaded_messages = load_resp.json()['room']['messages']
    assert_true(len(loaded_messages) > 0, 'loaded history room has no messages')

    export_resp = client.get(f'/history/rooms/{room_id}/export')
    assert_true(export_resp.status_code == 200, f'export failed: {export_resp.text}')
    content = export_resp.json().get('content', '')
    assert_true('## Messages' in content and 'history store hello message' in content, 'export markdown content invalid')

    archive_resp = client.post(f'/history/rooms/{room_id}/archive', json={'archived': True})
    assert_true(archive_resp.status_code == 200, f'archive failed: {archive_resp.text}')

    delete_resp = client.delete(f'/history/rooms/{room_id}')
    assert_true(delete_resp.status_code == 200, f'delete failed: {delete_resp.text}')

    # Security checks
    if room_file.exists():
        saved_text = room_file.read_text(encoding='utf-8', errors='ignore')
        assert_true('API_KEY' not in saved_text, 'history file contains API_KEY text')
        assert_true('.env' not in saved_text.lower(), 'history file contains .env content')

    print('Validation passed: history store APIs and persistence checks are working.')


if __name__ == '__main__':
    main()
