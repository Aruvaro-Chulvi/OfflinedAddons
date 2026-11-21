#!/usr/bin/env python3
"""Check addons against the rules in docs/sdk/06-publishing.md.

    python tools/validate.py                 # every addon
    python tools/validate.py addons/my-addon # one or more addons
    python tools/validate.py --report out.md # also write a Markdown report (used by CI)

Errors block a pull request; warnings are things the maintainer looks at by hand
during the review (they are listed in the report). Standard library only.

Licence: MIT (see LICENSE).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addonkit as K  # noqa: E402

TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".md", ".xml", ".csv", ".tsv"}

# Things that would make an addon reach the internet. Offlined is an offline
# app: everything an addon needs must travel inside its package (or come from
# Offlined's own /vendor/ folder).
REMOTE = [
    (re.compile(r"<script\b[^>]*\bsrc\s*=\s*[\"']?(?:https?:)?//", re.I), "loads a script from the internet"),
    (re.compile(r"<link\b[^>]*\bhref\s*=\s*[\"']?(?:https?:)?//", re.I), "loads a stylesheet or font from the internet"),
    (re.compile(r"<(?:iframe|img|audio|video|source|embed|object)\b[^>]*\b(?:src|data)\s*=\s*[\"']?(?:https?:)?//", re.I), "loads content from the internet"),
    (re.compile(r"\bimport\s*(?:[^;\"'()]*\bfrom\s*)?\(?\s*[\"'](?:https?:)?//", re.I), "imports a module from the internet"),
    (re.compile(r"@import\s+(?:url\()?\s*[\"']?(?:https?:)?//", re.I), "imports CSS from the internet"),
    (re.compile(r"url\(\s*[\"']?(?:https?:)?//", re.I), "uses a file from the internet in CSS"),
    (re.compile(r"\bfetch\s*\(\s*[\"'`](?:https?:)?//", re.I), "calls a server on the internet"),
    (re.compile(r"\b(?:new\s+WebSocket|new\s+EventSource)\s*\(\s*[\"'`](?:wss?|https?):", re.I), "opens a connection to a server"),
    (re.compile(r"\bnavigator\.sendBeacon\s*\(", re.I), "sends data with sendBeacon"),
]
# Worth a look by the reviewer, not wrong by themselves.
CAREFUL = [
    (re.compile(r"\beval\s*\("), "uses eval()"),
    (re.compile(r"\bnew\s+Function\s*\("), "uses new Function()"),
    (re.compile(r"\bdocument\.cookie\b"), "reads or writes cookies"),
    (re.compile(r"\bwindow\.(?:top|parent)\.document\b"), "tries to reach the Offlined page itself"),
    (re.compile(r"\bXMLHttpRequest\b"), "uses XMLHttpRequest (check where it goes)"),
    (re.compile(r"(?:atob|fromCharCode)\s*\([^)]{200,}"), "decodes a long hidden string"),
]
# Offlined APIs that touch personal data. Using them is allowed when the addon
# needs it, and the review checks that it does.
SENSITIVE_API = {
    "/api/vault": "the Safe (passwords, documents)", "/api/mail": "mail", "/api/contacts": "contacts",
    "/api/calendar": "calendar", "/api/users": "user profiles", "/api/parental": "parental control",
    "/api/privacy": "privacy settings", "/api/chat": "AI chats", "/api/media": "photos and media",
    "/api/files": "files", "/api/workspace": "files on the computer", "/api/open_url": "the system browser",
    "/api/settings": "settings", "/api/agents": "AI agents", "/api/locations": "places and locations",
}
API_RE = re.compile(r"[\"'`](/api/[A-Za-z0-9_\-/]+)")


class Result:
    def __init__(self, name: str):
        self.name = name
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.apis: Dict[str, str] = {}
        self.size = 0
        self.files = 0
        self.status = ""

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def check_manifest(d: Path, r: Result) -> dict:
    p = d / "addon.json"
    if not p.is_file():
        r.err("missing `addon.json`")
        return {}
    raw = p.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        r.err("`addon.json` must be UTF-8 without BOM")
    try:
        m = json.loads(raw.decode("utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        r.err(f"`addon.json` is not valid JSON: {e}")
        return {}
    if not isinstance(m, dict):
        r.err("`addon.json` must be a JSON object")
        return {}

    for k in K.REQUIRED:
        if k not in m or m[k] in ("", None):
            r.err(f"`{k}` is required in addon.json")
    for k in K.FORBIDDEN:
        if k in m:
            r.err(f"`{k}` must not be in addon.json (Offlined writes it itself)")
    for k in m:
        if k not in K.REQUIRED and k not in K.OPTIONAL and k not in K.FORBIDDEN:
            r.warn(f"unknown field `{k}` in addon.json (Offlined ignores it)")

    aid = str(m.get("id", ""))
    if aid and not K.ID_RE.match(aid):
        r.err(f"`id` {aid!r} must be 2–40 characters: lowercase letters, digits and hyphens")
    if aid and aid != d.name:
        r.err(f"`id` {aid!r} must be the same as the folder name {d.name!r}")
    if aid in K.RESERVED_IDS:
        r.err(f"`id` {aid!r} is reserved by Offlined")

    for k in ("name", "author", "description"):
        v = m.get(k)
        if v is not None and not isinstance(v, str):
            r.err(f"`{k}` must be text")
    if isinstance(m.get("name"), str) and len(m["name"]) > 40:
        r.err("`name` is longer than 40 characters")
    if isinstance(m.get("description"), str) and len(m["description"]) > 300:
        r.err("`description` is longer than 300 characters")

    for k in ("version", "min_offlined"):
        if k in m:
            try:
                K.semver(str(m[k]))
            except ValueError:
                r.err(f"`{k}` must be a version like 1.0.0, not {m[k]!r}")

    icon = m.get("icon")
    if isinstance(icon, str):
        if not icon or len(icon) > 8 or re.search(r"[A-Za-z0-9<>]", icon):
            r.err("`icon` must be one emoji")
    elif icon is not None:
        r.err("`icon` must be one emoji")

    lic = m.get("license")
    if lic is not None and lic not in K.LICENSES:
        r.err(f"`license` {lic!r} is not one of the accepted licences: {', '.join(K.LICENSES)}")
    cat = m.get("category")
    if cat is not None and cat not in K.CATEGORIES:
        r.err(f"`category` {cat!r} must be one of: {', '.join(K.CATEGORIES)}")
    elif cat is None:
        r.warn("no `category`: the addon will be listed under «tools»")

    if "permissions" in m and not (isinstance(m["permissions"], list) and all(isinstance(x, str) for x in m["permissions"])):
        r.err("`permissions` must be a list of strings")

    for k in ("name_i18n", "description_i18n"):
        v = m.get(k)
        if v is None:
            if k == "name_i18n":
                r.warn("no `name_i18n`: the name will be shown in English in every language")
            continue
        if not isinstance(v, dict):
            r.err(f"`{k}` must be an object {{\"es\": \"…\"}}")
            continue
        for lang, txt in v.items():
            if lang not in K.LANGS:
                r.err(f"`{k}` has language {lang!r}; Offlined's languages are {', '.join(K.LANGS)}")
            if not isinstance(txt, str) or not txt.strip():
                r.err(f"`{k}.{lang}` must be non-empty text")
            elif k == "name_i18n" and len(txt) > 40:
                r.err(f"`{k}.{lang}` is longer than 40 characters")
            elif k == "description_i18n" and len(txt) > 300:
                r.err(f"`{k}.{lang}` is longer than 300 characters")

    for k in ("homepage", "author_url"):
        v = m.get(k)
        if v is not None and not (isinstance(v, str) and v.startswith("https://")):
            r.err(f"`{k}` must be an https:// address")
    img = m.get("image")
    if img is not None and not (isinstance(img, str) and (d / "frontend" / img).is_file()):
        r.err(f"`image` {img!r} must be a file inside frontend/")
    return m


def check_files(d: Path, r: Result) -> None:
    if not (d / "frontend" / "panel.html").is_file():
        r.err("missing `frontend/panel.html` (the addon's page)")
    if not (d / "README.md").is_file():
        r.err("missing `README.md` (what the addon does, shown on GitHub and on the catalogue page)")
    # Anything at the top level that is neither shipped nor a known repo-only file.
    shipped = {p.relative_to(d).as_posix() for p in K.shipped_files(d)}
    for p in sorted(d.iterdir()):
        rel = p.name
        if p.is_dir() and rel == "frontend":
            continue
        if rel in shipped or rel in K.REPO_ONLY:
            continue
        if rel == "data":
            r.err("`data/` must not be in the repository: Offlined creates it for each user's own data")
        else:
            r.err(f"`{rel}` is not part of an addon (only addon.json, frontend/, README.md, CHANGELOG.md, LICENSE, screenshot.png)")

    total = 0
    for p in K.shipped_files(d):
        rel = p.relative_to(d).as_posix()
        size = p.stat().st_size
        total += size
        r.files += 1
        if any(part.startswith(".") for part in rel.split("/")):
            r.err(f"`{rel}`: hidden files are not allowed")
        if p.suffix.lower() not in K.ALLOWED_EXT and rel not in ("LICENSE", "addon.json"):
            r.err(f"`{rel}`: files of type `{p.suffix or '(none)'}` are not allowed in an addon")
        if size > K.MAX_FILE:
            r.err(f"`{rel}` is {K.human(size)}; one file may not be over {K.human(K.MAX_FILE)}")
        if p.suffix.lower() == ".wasm":
            r.warn(f"`{rel}` is WebAssembly: the reviewer needs its source or the project it comes from")
        if p.suffix.lower() in TEXT_EXT:
            try:
                text = p.read_bytes().decode("utf-8")
            except UnicodeDecodeError:
                r.err(f"`{rel}` is not UTF-8 text")
                continue
            scan_text(rel, text, r)
    r.size = total
    if total > K.MAX_TOTAL:
        r.err(f"the addon is {K.human(total)}; the limit is {K.human(K.MAX_TOTAL)}")


def scan_text(rel: str, text: str, r: Result) -> None:
    for rx, what in REMOTE:
        m = rx.search(text)
        if m:
            line = text.count("\n", 0, m.start()) + 1
            r.err(f"`{rel}` line {line} {what}: Offlined works without internet, ship the file inside the addon or use Offlined's `/vendor/`")
    for rx, what in CAREFUL:
        m = rx.search(text)
        if m:
            line = text.count("\n", 0, m.start()) + 1
            r.warn(f"`{rel}` line {line} {what}")
    for m in API_RE.finditer(text):
        path = m.group(1)
        for prefix, label in SENSITIVE_API.items():
            if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
                r.apis[prefix] = label


def check_version(d: Path, m: dict, r: Result, catalog: dict) -> None:
    entry = next((a for a in catalog.get("addons", []) if a.get("id") == d.name), None)
    if not entry:
        r.status = "new"
        return
    try:
        new, old = K.semver(str(m.get("version"))), K.semver(str(entry.get("version")))
    except ValueError:
        return
    changed = K.content_hash(d) != entry.get("content_sha256")
    if new < old:
        r.err(f"`version` {m.get('version')} is lower than the published {entry.get('version')}")
    elif changed and new == old:
        r.err(f"the addon changed but `version` is still {entry.get('version')}: raise it (1.0.0 → 1.0.1 for a fix, 1.1.0 for something new)")
    r.status = "update" if changed else "unchanged"


def validate(d: Path, catalog: dict) -> Result:
    r = Result(d.name)
    m = check_manifest(d, r)
    check_files(d, r)
    if m and not r.errors:
        check_version(d, m, r, catalog)
    return r


def report_md(results: List[Result]) -> str:
    out = ["## Addon check", ""]
    for r in results:
        mark = "❌" if r.errors else ("⚠️" if r.warnings else "✅")
        status = {"new": "new addon", "update": "update", "unchanged": "no changes"}.get(r.status, "")
        out.append(f"### {mark} `{r.name}` — {r.files} files, {K.human(r.size)}" + (f" · {status}" if status else ""))
        for e in r.errors:
            out.append(f"- ❌ {e}")
        for w in r.warnings:
            out.append(f"- ⚠️ {w}")
        if r.apis:
            out.append("- 🔎 Uses Offlined APIs with personal data: " + ", ".join(f"`{k}` ({v})" for k, v in sorted(r.apis.items())))
        out.append("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("addons", nargs="*", help="addon folders (default: all)")
    ap.add_argument("--report", help="write a Markdown report to this file")
    args = ap.parse_args()

    dirs = K.addon_dirs(args.addons or None)
    if args.addons and len(dirs) != len(args.addons):
        found = {d.name for d in dirs}
        for a in args.addons:
            if Path(a).name not in found:
                print(f"ERROR: no addon folder {a!r} in addons/")
        return 1
    catalog = K.load_catalog()
    results = [validate(d, catalog) for d in dirs]
    n_err = 0
    for r in results:
        print(f"{'FAIL' if r.errors else 'ok  '} {r.name}  ({r.files} files, {K.human(r.size)}{', ' + r.status if r.status else ''})")
        for e in r.errors:
            print(f"     error: {e}")
        for w in r.warnings:
            print(f"     warning: {w}")
        if r.apis:
            print("     uses: " + ", ".join(sorted(r.apis)))
        n_err += len(r.errors)
    if args.report:
        Path(args.report).write_text(report_md(results), encoding="utf-8")
    print(f"\n{len(results)} addon(s), {n_err} error(s)")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
