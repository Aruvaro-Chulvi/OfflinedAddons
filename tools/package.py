#!/usr/bin/env python3
"""Pack addons into .zip files you can install in Offlined to test them.

    python tools/package.py                  # every addon → dist/test/<id>-<version>.zip
    python tools/package.py addons/my-addon  # only this one

These packages are NOT signed: Offlined warns before installing them and marks
them «Unverified». That is expected while you develop or review an addon. The
signed packages are made only by the maintainer, when an addon is approved
(tools/publish.py). Standard library only.

Licence: MIT (see LICENSE).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addonkit as K  # noqa: E402


def main() -> int:
    out = K.ROOT / "dist" / "test"
    out.mkdir(parents=True, exist_ok=True)
    dirs = K.addon_dirs(sys.argv[1:] or None)
    if not dirs:
        print("no addons found")
        return 1
    for d in dirs:
        m = K.load_manifest(d)
        data = K.build_zip(K.read_files(d))
        p = out / f"{m['id']}-{m['version']}.zip"
        p.write_bytes(data)
        print(f"{p.relative_to(K.ROOT).as_posix()}  {K.human(len(data))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
