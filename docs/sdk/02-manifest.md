# 2. The manifest — `addon.json`

*[Leer en español](es/02-manifest.md)* · [SDK index](README.md)

Every addon has an `addon.json` at the root of its folder: UTF-8, without BOM. This is the real manifest of the
Whiteboard addon (shortened):

```json
{
  "id": "whiteboard",
  "name": "Whiteboard",
  "version": "1.0.0",
  "author": "Álvaro C. Chulvi",
  "description": "Draw freely with a full-featured whiteboard — save, rename and reopen your drawings, fully offline.",
  "icon": "✏️",
  "license": "MIT",
  "category": "office",
  "min_offlined": "3.0.0",
  "permissions": [],
  "name_i18n": { "en": "Whiteboard", "es": "Pizarra", "fr": "Tableau blanc" },
  "description_i18n": { "en": "Draw freely…", "es": "Dibuja libremente…" }
}
```

## Required fields

| Field | Type | Rules |
|---|---|---|
| `id` | text | 2–40 characters: lowercase letters, digits and hyphens. **The same as the folder name.** It becomes the install folder and the address of your panel (`/addon-panels/<id>/…`), and it can never change once published. |
| `name` | text | Up to 40 characters. Shown when the user's language is not in `name_i18n`. |
| `version` | text | `MAJOR.MINOR.PATCH`, e.g. `1.0.0`. Raise it for every change you publish: `1.0.1` for a fix, `1.1.0` for something new, `2.0.0` when you break something (for example, old saved data). |
| `author` | text | Your name or nickname, as you want it shown in Offlined and in the catalogue. |
| `description` | text | Up to 300 characters, in English. One sentence that says what it does. |
| `icon` | text | **One emoji.** Shown in the Addons menu, on the Home card and in the catalogue. |
| `license` | text | The addon's licence (SPDX id): `MIT` (recommended), `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MPL-2.0`, `Zlib`, `0BSD`, `Unlicense` or `CC0-1.0`. |
| `min_offlined` | text | The oldest Offlined version your addon works with, e.g. `3.0.0`. Older Offlined versions show the addon as «needs a newer Offlined» instead of installing it. |

## Optional fields

| Field | Type | Meaning |
|---|---|---|
| `category` | text | Where it is listed: `office`, `productivity`, `education`, `games`, `media`, `tools`, `lifestyle` or `reference`. Default `tools`. |
| `name_i18n` | object | The name in Offlined's languages: `en`, `es`, `fr`, `pt`, `it`, `de`, `zh`, `hi`, `ar`, `ru`. Missing languages fall back to `name`. Strongly recommended. |
| `description_i18n` | object | The description in the same languages; missing ones fall back to `description`. |
| `image` | text | A picture to use as icon instead of the emoji: a file inside `frontend/` (square PNG or WebP, 128×128). |
| `homepage` | text | An `https://` page about your addon. |
| `author_url` | text | An `https://` page about you (your GitHub profile, for example). |
| `permissions` | list | Kept for the future [permission system](07-roadmap.md). Not read today: write `[]`. |

## Fields you must not write

`_dir`, `signed`, `_has_panel` and `_has_image` are written by Offlined itself when it installs or lists an
addon. `enabled` is the user's on/off switch: you may leave it out.

## Languages

Offlined speaks ten languages. Your addon does not have to — but if you translate at least the name and the
description, the addon is listed in the user's language. If you are not sure of a translation, leave that
language out rather than guessing: a reviewer or another contributor can add it later.

The texts *inside* your panel are up to you: see [languages in the panel](03-panel.md#language).
