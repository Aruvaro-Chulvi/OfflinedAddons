#!/usr/bin/env python3
"""Build, sign and publish the addon catalogue (maintainer only).

    python tools/publish.py --dry-run          # build and sign into dist/, change nothing online
    python tools/publish.py                    # …then commit catalog.json and create the GitHub release

What it does:
1. Checks every addon with tools/validate.py (stops on any error).
2. Packs each addon into a deterministic .zip and signs it with Offlined's
   private key (Ed25519). The key stays on the maintainer's computer: it is
   NEVER in this repository nor in GitHub. Offlined installs a signed addon
   without the «unverified» warning, and refuses one whose files changed after
   signing.
3. Writes catalog.json (the list Offlined downloads) next to the zips in dist/
   and in the repository root.
4. Creates a new release `addons-YYYY-MM-DD` (b, c… if there are more that day)
   with every zip and catalog.json, and marks it as latest. Offlined reads
   releases/latest/download/catalog.json. Releases are never edited afterwards:
   a fix is a new release.

Needs: `pip install cryptography`, and `gh` logged in for the release.
Key: --key PATH, or the OFFLINED_SIGNING_KEY environment variable, or
..\\SurvivalAI-phi4\\.signing\\offlined_addons_ed25519.pem.

Licence: MIT (see LICENSE).
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
import io
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addonkit as K  # noqa: E402
import validate as V  # noqa: E402

DIST = K.ROOT / "dist"
DEFAULT_KEYS = [K.ROOT.parent / "SurvivalAI-phi4" / ".signing" / "offlined_addons_ed25519.pem"]
CATALOG_KEYS = ("id", "name", "name_i18n", "description", "description_i18n", "icon", "version", "author",
                "author_url", "license", "category", "min_offlined", "permissions", "homepage")


def load_key(path: str | None):
    from cryptography.hazmat.primitives import serialization
    cands = [Path(path)] if path else []
    if os.environ.get("OFFLINED_SIGNING_KEY"):
        cands.append(Path(os.environ["OFFLINED_SIGNING_KEY"]))
    cands += DEFAULT_KEYS
    for c in cands:
        if c.is_file():
            key = serialization.load_pem_private_key(c.read_bytes(), password=None)
            pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
            if base64.b64encode(pub).decode() != K.PUBLIC_KEY_B64:
                sys.exit(f"ERROR: {c} is not Offlined's addon key (its public key does not match)")
            return key
    sys.exit("ERROR: signing key not found (use --key or OFFLINED_SIGNING_KEY)")


def verify_zip(data: bytes) -> bool:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        files = {n: zf.read(n) for n in zf.namelist() if not n.endswith("/")}
    sig = base64.b64decode(json.loads(files[K.SIG_FILE])["sig"])
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(K.PUBLIC_KEY_B64)).verify(sig, K.payload_entries(files))
        return True
    except Exception:  # noqa: BLE001
        return False


def next_tag() -> str:
    day = dt.date.today().isoformat()
    try:
        out = subprocess.run(["gh", "release", "list", "-R", K.REPO, "--limit", "100", "--json", "tagName"],
                             capture_output=True, text=True, check=True).stdout
        tags = {r["tagName"] for r in json.loads(out)}
    except Exception:  # noqa: BLE001
        tags = set()
    tag = f"addons-{day}"
    for suffix in "bcdefghijklmnopqrstuvwxyz":
        if tag not in tags:
            return tag
        tag = f"addons-{day}{suffix}"
    sys.exit("ERROR: too many releases today")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--key", help="path to the private key (.pem)")
    ap.add_argument("--dry-run", action="store_true", help="build into dist/ only")
    ap.add_argument("--tag", help="release tag (default addons-YYYY-MM-DD)")
    args = ap.parse_args()

    old = K.load_catalog()
    results = [V.validate(d, old) for d in K.addon_dirs()]
    bad = [r for r in results if r.errors]
    for r in bad:
        print(f"FAIL {r.name}: " + "; ".join(r.errors))
    if bad:
        return 1

    key = load_key(args.key)
    tag = args.tag or (next_tag() if not args.dry_run else f"addons-{dt.date.today().isoformat()}")
    base_url = f"{K.REPO_URL}/releases/download/{tag}/"
    today = dt.date.today().isoformat()
    old_by_id = {a["id"]: a for a in old.get("addons", [])}
    official = K.official_ids()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    entries, notes = [], []
    for d in K.addon_dirs():
        m = K.load_manifest(d)
        files = K.read_files(d)
        sig = key.sign(K.payload_entries(files))
        data = K.build_zip(files, json.dumps({"alg": "ed25519", "sig": base64.b64encode(sig).decode()}).encode())
        if not verify_zip(data):
            sys.exit(f"ERROR: the signature of {d.name} does not verify")
        fname = f"{m['id']}-{m['version']}.zip"
        (DIST / fname).write_bytes(data)
        chash = K.content_hash(d)
        prev = old_by_id.get(m["id"])
        e = {k: m[k] for k in CATALOG_KEYS if k in m}
        e.setdefault("category", "tools")
        e["official"] = m["id"] in official
        e["file"] = fname
        e["size"] = len(data)
        e["sha256"] = hashlib.sha256(data).hexdigest()
        e["content_sha256"] = chash
        e["files"] = len(files)
        e["source"] = f"{K.REPO_URL}/tree/main/addons/{m['id']}"
        e["published"] = (prev or {}).get("published", today)
        e["updated"] = (prev or {}).get("updated", today) if prev and prev.get("content_sha256") == chash else today
        entries.append(e)
        if not prev:
            notes.append(f"- **New:** {m.get('icon', '')} {m['name']} {m['version']} by {m['author']}")
        elif prev.get("content_sha256") != chash:
            notes.append(f"- **Updated:** {m.get('icon', '')} {m['name']} {prev.get('version')} → {m['version']}")
        print(f"signed {fname}  {K.human(len(data))}")
    for gone in sorted(set(old_by_id) - {e["id"] for e in entries}):
        notes.append(f"- **Withdrawn:** {old_by_id[gone].get('name', gone)}")

    catalog = {
        "format": 1,
        "version": tag,
        "generated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "repository": K.REPO_URL,
        "base_url": base_url,
        "public_key": K.PUBLIC_KEY_B64,
        "addons": sorted(entries, key=lambda e: (not e["official"], e["id"])),
    }
    text = json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
    (DIST / "catalog.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"\ncatalog: {len(entries)} addons → dist/catalog.json ({tag})")
    if args.dry_run:
        print("dry run: nothing published")
        return 0

    K.CATALOG_FILE.write_text(text, encoding="utf-8", newline="\n")
    body = "\n".join([
        f"Addons approved for Offlined, signed with Offlined's key. Offlined lists them in **Addons → Manage addons → Available addons**.",
        "",
        *(notes or ["- Catalogue rebuilt (no addon changed)."]),
        "",
        "Every `.zip` here installs in Offlined without the «Unverified» warning. `catalog.json` lists them with their size and SHA-256.",
    ])
    zips = sorted(str(p) for p in DIST.glob("*.zip"))
    subprocess.run(["gh", "release", "create", tag, *zips, str(DIST / "catalog.json"), "-R", K.REPO,
                    "--title", f"Offlined Addons {tag[7:]}", "--notes", body, "--latest"], check=True)
    print(f"released {tag}. Now commit catalog.json:\n  git add catalog.json && git commit -m \"Catalogue {tag}\" && git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
