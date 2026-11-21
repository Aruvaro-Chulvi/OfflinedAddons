"""Shared helpers for the Offlined Addons tools (standard library only).

- The addon manifest rules (what `addon.json` may and must contain).
- Deterministic packaging: the same addon folder always gives a byte-identical
  .zip, so a release can be rebuilt and checked by anyone.
- The signing payload, identical to the one Offlined checks when it installs an
  addon (backend/addon_sign.py in Offlined).

Licence: MIT (see LICENSE).
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

for _s in (sys.stdout, sys.stderr):   # Windows consoles default to cp1252
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass

ROOT = Path(__file__).resolve().parent.parent
ADDONS_DIR = ROOT / "addons"
CATALOG_FILE = ROOT / "catalog.json"
OFFICIAL_FILE = ROOT / "tools" / "official.json"

REPO = "Aruvaro-Chulvi/OfflinedAddons"
REPO_URL = f"https://github.com/{REPO}"

# Offlined's public key for addon signatures (the private key never leaves the
# maintainer's computer). Same value as PUBLIC_KEY_B64 in Offlined.
PUBLIC_KEY_B64 = "13RbPjlJPu7T0VNjci2128gD/SVbHtw6nZMktYVU9C4="
SIG_FILE = "offlined-signature.json"

LANGS = ("en", "es", "fr", "pt", "it", "de", "zh", "hi", "ar", "ru")
CATEGORIES = ("office", "productivity", "education", "games", "media", "tools", "lifestyle", "reference")
LICENSES = ("MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "Unlicense", "CC0-1.0", "0BSD", "Zlib")

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")
SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
# Ids Offlined uses itself or used in the past: an addon with one of these
# names would collide with app routes or old migrations.
RESERVED_IDS = {"music-player", "learn-geo", "learn-astro", "pomodoro", "offlined", "addons", "sdk", "test", "example", "hello-world", "my-addon"}

REQUIRED = ("id", "name", "version", "author", "description", "icon", "license", "min_offlined")
OPTIONAL = ("category", "permissions", "name_i18n", "description_i18n", "homepage", "image", "author_url", "enabled")
FORBIDDEN = ("_dir", "signed", "_has_panel", "_has_image")

# What a package may contain. Anything else (programs, scripts for the system,
# archives) is refused: an addon is a web page that runs inside Offlined.
ALLOWED_EXT = {
    ".html", ".htm", ".css", ".js", ".mjs", ".json", ".map", ".txt", ".md",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".avif",
    ".woff", ".woff2", ".ttf", ".otf",
    ".mp3", ".ogg", ".oga", ".wav", ".m4a", ".mp4", ".webm",
    ".wasm", ".csv", ".tsv", ".xml", ".pdf",
}
# Files that live in the repository next to the addon but are not shipped.
REPO_ONLY = {"README.md", "README.es.md", "CHANGELOG.md", "screenshot.png", "screenshot.jpg", "screenshot.webp"}
MAX_FILE = 25 * 2**20
MAX_TOTAL = 50 * 2**20
FIXED_TIME = (2020, 1, 1, 0, 0, 0)


def semver(v: str) -> Tuple[int, int, int]:
    m = SEMVER_RE.match(v or "")
    if not m:
        raise ValueError(f"not a version X.Y.Z: {v!r}")
    return tuple(int(x) for x in m.groups())  # type: ignore[return-value]


def addon_dirs(only: Optional[Iterable[str]] = None) -> List[Path]:
    if not ADDONS_DIR.is_dir():
        return []
    dirs = sorted(d for d in ADDONS_DIR.iterdir() if d.is_dir() and not d.name.startswith("."))
    if only:
        wanted = {Path(x).name for x in only}
        dirs = [d for d in dirs if d.name in wanted]
    return dirs


def load_manifest(d: Path) -> dict:
    return json.loads((d / "addon.json").read_bytes().decode("utf-8"))


def shipped_files(d: Path) -> List[Path]:
    """The files that go into the package: addon.json, frontend/**, and a LICENSE
    file if there is one. Sorted, with forward-slash relative paths."""
    out = [d / "addon.json"]
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "NOTICE.md"):
        if (d / name).is_file():
            out.append(d / name)
    fe = d / "frontend"
    if fe.is_dir():
        out += sorted(p for p in fe.rglob("*") if p.is_file())
    return sorted(out, key=lambda p: p.relative_to(d).as_posix())


def payload_entries(files: Dict[str, bytes]) -> bytes:
    """What Offlined signs and checks: the sorted list of [path, sha256]."""
    entries = sorted([rel, hashlib.sha256(data).hexdigest()] for rel, data in files.items() if rel != SIG_FILE)
    return json.dumps(entries, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def read_files(d: Path) -> Dict[str, bytes]:
    return {p.relative_to(d).as_posix(): p.read_bytes() for p in shipped_files(d)}


def content_hash(d: Path) -> str:
    """One hash for everything an addon ships; it changes when any file changes."""
    return hashlib.sha256(payload_entries(read_files(d))).hexdigest()


def build_zip(files: Dict[str, bytes], signature: Optional[bytes] = None) -> bytes:
    """Deterministic zip: sorted entries, fixed timestamps, fixed permissions."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        items = sorted(files.items())
        if signature is not None:
            items.append((SIG_FILE, signature))
        for rel, data in items:
            info = zipfile.ZipInfo(rel, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            info.create_system = 3
            zf.writestr(info, data)
    return buf.getvalue()


def load_catalog() -> dict:
    try:
        return json.loads(CATALOG_FILE.read_bytes().decode("utf-8"))
    except FileNotFoundError:
        return {"format": 1, "addons": []}


def official_ids() -> set:
    try:
        return set(json.loads(OFFICIAL_FILE.read_text("utf-8")).get("official", []))
    except FileNotFoundError:
        return set()


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return str(n)
