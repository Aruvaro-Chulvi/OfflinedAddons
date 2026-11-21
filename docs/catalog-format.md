# `catalog.json` format

The catalogue Offlined downloads from
`https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/latest/download/catalog.json`. Written by
[`tools/publish.py`](../tools/publish.py); a copy of the latest one is committed at the root of the repository.
Released into the public domain (CC0-1.0).

```json
{
  "format": 1,
  "version": "addons-2026-11-21",
  "generated": "2026-11-21T21:45:36Z",
  "repository": "https://github.com/Aruvaro-Chulvi/OfflinedAddons",
  "base_url": "https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/download/addons-2026-11-21/",
  "public_key": "13RbPjlJPu7T0VNjci2128gD/SVbHtw6nZMktYVU9C4=",
  "addons": [
    {
      "id": "whiteboard",
      "name": "Whiteboard",
      "name_i18n": { "en": "Whiteboard", "es": "Pizarra" },
      "description": "Draw freely…",
      "description_i18n": { "en": "Draw freely…", "es": "Dibuja libremente…" },
      "icon": "✏️",
      "version": "1.0.0",
      "author": "Álvaro C. Chulvi",
      "license": "MIT",
      "category": "office",
      "min_offlined": "3.0.0",
      "permissions": [],
      "official": true,
      "file": "whiteboard-1.0.0.zip",
      "size": 9147,
      "sha256": "…",
      "content_sha256": "…",
      "files": 2,
      "source": "https://github.com/Aruvaro-Chulvi/OfflinedAddons/tree/main/addons/whiteboard",
      "published": "2026-11-21",
      "updated": "2026-11-21"
    }
  ]
}
```

| Key | Meaning |
|---|---|
| `format` | `1`. A client that does not know the format must not use the catalogue. |
| `version` | The release tag. |
| `base_url` | Where the packages are: `base_url + file`. Always a release of this repository. |
| `public_key` | Ed25519 public key (base64) the packages are signed with. Clients use their own built-in copy; this one is informative. |
| `addons[].…` | The manifest fields of each addon (see [the manifest](sdk/02-manifest.md)) plus: |
| `official` | Made by Offlined. |
| `file`, `size`, `sha256` | The signed package and the SHA-256 of the whole `.zip`. Clients must check size and hash before installing. |
| `content_sha256` | SHA-256 of the signed payload (sorted `[path, sha256]` list) — changes when any shipped file changes. |
| `files` | Number of files in the package (without the signature). |
| `source` | The addon's folder in this repository. |
| `published`, `updated` | First publication, and last release in which the addon's files changed. |

## What Offlined does with it

1. `POST /api/addons/catalog` downloads it and compares it with the installed addons: *install*, *update*
   (catalogue version higher), *installed*, or *needs a newer Offlined* (`min_offlined`).
2. `POST /api/addons/catalog/install {"id": …}` downloads `base_url + file` (only from this repository's
   releases), checks `size` and `sha256`, and installs it **only if its signature is valid** — a catalogue
   package is never installed unsigned.
