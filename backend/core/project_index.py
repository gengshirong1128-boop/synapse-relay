from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from backend.core.project_reader import scan_project_files
from backend.schemas import ProjectContext, ProjectIndex


class ProjectIndexStore:
    def __init__(self) -> None:
        self._indices: dict[str, ProjectIndex] = {}
        self._contexts: dict[str, ProjectContext] = {}

    def scan(self, project_path: str, max_file_size_bytes: int) -> ProjectIndex:
        files, ignored_files, ignored_dirs, warnings = scan_project_files(project_path, max_file_size_bytes)
        now = datetime.utcnow()
        project_path_obj = Path(project_path).resolve()
        project_id = str(uuid4())
        index = ProjectIndex(
            project_id=project_id,
            project_path=str(project_path_obj),
            project_name=project_path_obj.name,
            files=files,
            ignored_files=ignored_files,
            ignored_dirs=sorted(set(ignored_dirs)),
            total_files=len(files),
            total_size_bytes=sum(item.size_bytes for item in files),
            created_at=now,
            updated_at=now,
            warnings=warnings,
        )
        self._indices[index.project_id] = index
        return index

    def get(self, project_id: str) -> ProjectIndex:
        index = self._indices.get(project_id)
        if index is None:
            raise KeyError(f"Unknown project_id: {project_id}")
        return index

    def set_context(self, project_id: str, context: ProjectContext) -> None:
        self._contexts[project_id] = context

    def get_context(self, project_id: str) -> ProjectContext | None:
        return self._contexts.get(project_id)

    def file_tree(self, project_id: str) -> list[str]:
        index = self.get(project_id)
        return sorted(item.relative_path for item in index.files)


project_index_store = ProjectIndexStore()
PROJECTS = project_index_store._indices
