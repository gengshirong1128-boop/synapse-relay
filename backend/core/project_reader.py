from __future__ import annotations

from pathlib import Path

from backend.schemas import ProjectFile


IGNORED_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    "dist",
    "build",
    "venv",
    ".venv",
    ".idea",
    ".vscode",
    "target",
    "out",
    "logs",
    ".cache",
    ".next",
    ".nuxt",
    "coverage",
}

BLOCKED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".mov",
    ".avi",
    ".mp3",
    ".wav",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".pt",
    ".pth",
    ".onnx",
    ".bin",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
}

SUPPORTED_FILES = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".html",
    ".css",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".txt",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".java",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
}

SUPPORTED_FILENAMES = {"requirements.txt", "package.json", "pyproject.toml", "dockerfile", "readme.md"}


def detect_language(path: Path) -> str:
    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".html": "html",
        ".css": "css",
        ".md": "markdown",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
        ".txt": "text",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".php": "php",
        ".rb": "ruby",
        ".sql": "sql",
        ".sh": "shell",
        ".bat": "batch",
        ".ps1": "powershell",
    }
    return ext_map.get(path.suffix.lower(), "text")


def is_sensitive_file(path: Path) -> bool:
    name = path.name.lower()
    return name == ".env" or name.endswith(".env")


def is_supported_file(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_FILES or path.name.lower() in SUPPORTED_FILENAMES


def is_path_allowed(project_path: Path) -> tuple[bool, str | None]:
    normalized = str(project_path.resolve()).lower()
    blocked_prefixes = [
        "c:\\",
        "c:\\windows",
        "\\\\?\\c:\\windows",
        "/etc",
        "/usr",
        "/bin",
        "/system",
    ]
    if normalized in {"c:\\", "c:\\"}:
        return False, "Root drive scanning is blocked."
    if "\\appdata" in normalized:
        return False, "AppData scanning is blocked."
    for prefix in blocked_prefixes:
        if normalized.startswith(prefix):
            return False, f"Scanning blocked for sensitive path: {project_path}"
    return True, None


def safe_read_text(path: Path, max_chars: int = 2000) -> str:
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    return content[:max_chars]


def file_keywords(path: Path, content: str) -> list[str]:
    base = path.stem.replace("-", "_").replace(".", "_")
    tokens = [item for item in base.split("_") if item]
    content_tokens = []
    for raw in content.replace("\n", " ").split(" "):
        word = raw.strip(" ,.:;()[]{}\"'`")
        if len(word) >= 4 and any(ch.isalpha() for ch in word):
            content_tokens.append(word.lower())
        if len(content_tokens) >= 20:
            break
    merged = tokens + content_tokens
    seen = set()
    result = []
    for item in merged:
        lowered = item.lower()
        if lowered not in seen:
            seen.add(lowered)
            result.append(lowered)
    return result[:30]


def scan_project_files(project_path: str, max_file_size_bytes: int) -> tuple[list[ProjectFile], list[str], list[str], list[str]]:
    root = Path(project_path).resolve()
    allowed, reason = is_path_allowed(root)
    if not allowed:
        raise ValueError(reason)

    files: list[ProjectFile] = []
    ignored_files: list[str] = []
    ignored_dirs: list[str] = []
    warnings: list[str] = []
    env_exists = False

    for path in root.rglob("*"):
        if path.is_dir():
            if path.name in IGNORED_DIRS:
                ignored_dirs.append(str(path.relative_to(root)))
            continue

        relative = str(path.relative_to(root))
        if any(part in IGNORED_DIRS for part in path.parts):
            ignored_files.append(relative)
            continue

        extension = path.suffix.lower()
        if extension in BLOCKED_EXTENSIONS:
            ignored_files.append(relative)
            continue

        size = path.stat().st_size
        too_large = size > max_file_size_bytes
        sensitive = is_sensitive_file(path)
        supported = is_supported_file(path)

        if sensitive:
            env_exists = True

        is_readable = supported and (not too_large) and (not sensitive)
        preview = safe_read_text(path, max_chars=2000) if is_readable else ""
        line_count = preview.count("\n") + 1 if preview else 0
        summary = preview.splitlines()[0][:140] if preview else ""
        item = ProjectFile(
            path=str(path),
            relative_path=relative,
            filename=path.name,
            extension=extension,
            language=detect_language(path),
            size_bytes=size,
            line_count=line_count,
            is_readable=is_readable,
            is_sensitive=sensitive,
            is_too_large=too_large,
            summary=summary,
            keywords=file_keywords(path, preview),
            selected=False,
        )
        files.append(item)

    if env_exists:
        warnings.append(".env exists but content is not read.")
    if not files:
        warnings.append("No supported files indexed under current rules.")
    return files, ignored_files, ignored_dirs, warnings
