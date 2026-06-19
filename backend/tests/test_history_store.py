from __future__ import annotations

from pathlib import Path

import pytest

from backend.core.history_store import HistoryStore


@pytest.mark.parametrize(
    "evil_id",
    [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\x",
        "a/../../b",
        "sub/dir",
        "..",
        "",
        "with\x00null",
    ],
)
def test_room_file_rejects_path_traversal(tmp_path: Path, evil_id: str):
    store = HistoryStore(base_dir=tmp_path)
    with pytest.raises(ValueError):
        store._room_file(evil_id)


def test_room_file_accepts_plain_id(tmp_path: Path):
    store = HistoryStore(base_dir=tmp_path)
    path = store._room_file("abc-123-DEF")
    assert path.parent == store.rooms_dir.resolve()
    assert path.name == "abc-123-DEF.json"


def test_load_room_with_traversal_id_raises_value_error(tmp_path: Path):
    store = HistoryStore(base_dir=tmp_path)
    with pytest.raises(ValueError):
        store.load_room("../../secret")


def test_delete_room_with_traversal_id_raises_value_error(tmp_path: Path):
    store = HistoryStore(base_dir=tmp_path)
    with pytest.raises(ValueError):
        store.delete_room("../../../important")
