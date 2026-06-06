from __future__ import annotations

import re
from pathlib import Path

from backend.core.project_index import project_index_store
from backend.core.token_meter import estimate_payload_tokens
from backend.schemas import CodeSnippet, ProjectContext, ProjectIndex, RelevantFile


DEPENDENCY_FILES = {"package.json", "requirements.txt", "pyproject.toml", "dockerfile", "readme.md"}


def extract_keywords(question: str) -> list[str]:
    # Keep english/chinese/numeric tokens and technical symbols in names.
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_./-]*|[\u4e00-\u9fff]{2,}|[0-9]+", question)
    keywords: list[str] = []
    seen = set()
    for token in tokens:
        normalized = token.strip().lower()
        if len(normalized) < 2:
            continue
        if normalized not in seen:
            seen.add(normalized)
            keywords.append(normalized)
    return keywords[:30]


def _read_file_lines(path: str) -> list[str]:
    try:
        content = Path(path).read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    return content.splitlines()


def _match_positions(lines: list[str], keywords: list[str]) -> list[int]:
    positions: list[int] = []
    if not keywords:
        return positions
    lowered_lines = [line.lower() for line in lines]
    for idx, line in enumerate(lowered_lines):
        if any(keyword in line for keyword in keywords):
            positions.append(idx)
    return positions


def _extract_snippets(lines: list[str], positions: list[int], max_snippets: int = 3) -> list[CodeSnippet]:
    snippets: list[CodeSnippet] = []
    for pos in positions[:max_snippets]:
        start = max(0, pos - 20)
        end = min(len(lines), pos + 21)
        content = "\n".join(lines[start:end]).strip()
        snippets.append(CodeSnippet(start_line=start + 1, end_line=end, content=content[:3000]))
    return snippets


def _fallback_snippet(lines: list[str]) -> list[CodeSnippet]:
    end = min(len(lines), 80)
    if end <= 0:
        return []
    content = "\n".join(lines[:end]).strip()
    return [CodeSnippet(start_line=1, end_line=end, content=content[:3000])]


def _score_file(file_item, keywords: list[str], manual_selected_paths: set[str]) -> tuple[float, str]:
    if file_item.is_sensitive:
        return -999.0, "sensitive file excluded"
    score = 0.0
    reasons: list[str] = []

    filename_lower = file_item.filename.lower()
    path_lower = file_item.relative_path.lower()
    keyword_hits_name = [key for key in keywords if key in filename_lower]
    keyword_hits_path = [key for key in keywords if key in path_lower]
    if keyword_hits_name:
        score += 5
        reasons.append(f"filename matched: {', '.join(keyword_hits_name[:3])}")
    if keyword_hits_path:
        score += 4
        reasons.append(f"path matched: {', '.join(keyword_hits_path[:3])}")
    if filename_lower in DEPENDENCY_FILES:
        score += 2
        reasons.append("dependency/background file")
    if file_item.relative_path in manual_selected_paths:
        score += 5
        reasons.append("manually selected")
    if file_item.is_too_large:
        score -= 3
        reasons.append("large file downgraded")
    return score, "; ".join(reasons) if reasons else "no direct keyword match"


def select_relevant_files(
    index: ProjectIndex,
    question: str,
    top_k: int = 8,
    manual_selected_paths: list[str] | None = None,
) -> list[RelevantFile]:
    keywords = extract_keywords(question)
    manual = set(manual_selected_paths or [])
    scored = []

    for file_item in index.files:
        if not file_item.is_readable or file_item.is_sensitive:
            continue
        score, reason = _score_file(file_item, keywords, manual)
        if score <= 0 and file_item.filename.lower() not in DEPENDENCY_FILES and file_item.relative_path not in manual:
            continue

        lines = _read_file_lines(file_item.path)
        positions = _match_positions(lines, keywords)
        content_hits = len(positions)
        if content_hits:
            score += min(4, content_hits) * 2
            reason = f"{reason}; content hits={content_hits}"
        snippets = _extract_snippets(lines, positions)
        if not snippets:
            snippets = _fallback_snippet(lines)
        token_estimate = estimate_payload_tokens([snippet.model_dump() for snippet in snippets])
        scored.append(
            RelevantFile(
                relative_path=file_item.relative_path,
                language=file_item.language,
                reason=reason,
                score=round(score, 2),
                snippets=snippets,
                token_estimate=token_estimate,
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    limit = min(max(top_k, 5), 10)
    return scored[:limit]


def build_project_context(project_id: str, question: str, selected_paths: list[str] | None = None) -> ProjectContext:
    index = project_index_store.get(project_id)
    if selected_paths:
        relevant = select_relevant_files(
            index=index,
            question=question,
            top_k=max(5, min(10, len(selected_paths))),
            manual_selected_paths=selected_paths,
        )
        selected_set = set(selected_paths)
        relevant = [item for item in relevant if item.relative_path in selected_set]
    else:
        relevant = select_relevant_files(index=index, question=question, top_k=8, manual_selected_paths=[])

    dependency_files = [
        item.relative_path
        for item in index.files
        if item.filename.lower() in DEPENDENCY_FILES
    ][:6]
    file_tree = sorted(item.relative_path for item in index.files)[:200]
    warnings = list(index.warnings)
    if len(relevant) >= len(index.files):
        warnings.append("Context includes too many files; consider reducing selection.")

    context_token_estimate = estimate_payload_tokens([item.model_dump() for item in relevant])
    context = ProjectContext(
        project_id=index.project_id,
        project_name=index.project_name,
        project_path=index.project_path,
        file_tree=file_tree,
        relevant_files=relevant,
        dependency_files=dependency_files,
        user_question=question,
        context_token_estimate=context_token_estimate,
        warnings=warnings,
    )
    project_index_store.set_context(project_id, context)
    return context
