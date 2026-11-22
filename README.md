# Offlined Addons

*[Leer en español](README.es.md)*

**Addons for [Offlined](https://www.offlined.org) — new tools for the offline library and workspace, made by
the community, reviewed and signed before they reach anyone's computer.**

[![Check addons](https://github.com/Aruvaro-Chulvi/OfflinedAddons/actions/workflows/check.yml/badge.svg)](https://github.com/Aruvaro-Chulvi/OfflinedAddons/actions/workflows/check.yml)
[![Latest catalogue](https://img.shields.io/github/v/release/Aruvaro-Chulvi/OfflinedAddons?label=catalogue)](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/latest)
[![SDK](https://img.shields.io/badge/docs-Addon%20SDK-5649ff)](docs/sdk/README.md)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-informational)](LICENSE)

Offlined keeps Wikipedia, maps, your files, mail, calendar and a local AI on your own computer, with no internet
needed. An **addon** adds one more tool to it: a small web page that Offlined opens in its **Addons** menu. Every
addon in this repository can be installed from inside Offlined with one click, in
**Addons → Manage addons → Available addons**.

## Available addons

| | Addon | What it does | |
|---|---|---|---|
| 📊 | **[Spreadsheet](addons/spreadsheet/)** | Spreadsheets with formulas, formatting and several sheets, powered by Univer. | Official |
| 🗒️ | **[Text document](addons/notes/)** | Rich-text documents with search, read-aloud and places on the map. | Official |
| ✏️ | **[Whiteboard](addons/whiteboard/)** | An infinite whiteboard for sketches and diagrams, powered by Excalidraw. | Official |
| 🎙️ | **[Audio notes](addons/audio-notes/)** | Voice notes with noise reduction, a player, MP3 export and calendar links. | Official |
| 🔢 | **[Sudoku](addons/sudoku/)** | Classic sudoku with eight levels, from very easy to deadly, and its own puzzle generator. | Official |
| ♟️ | **[Chess](addons/chess/)** | Chess against the computer: four levels, optional clock, hints and our own engine. | Official |

The full, current list is [`catalog.json`](catalog.json); the signed packages are in the
[latest release](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/latest).

## Make your own

If you can write a web page, you can write an addon — no build step, no framework, no server code.

1. Read the **[Addon SDK](docs/sdk/README.md)** — ten minutes to your first addon.
2. Copy [`templates/hello-world`](templates/hello-world/) to `addons/<your-id>/`.
3. Try it in Offlined: `python tools/package.py addons/<your-id>`, then install the `.zip`.
4. Open a pull request. See **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## How an addon reaches Offlined

```
pull request ──► automatic check ──► review by the maintainer ──► merge ──► signed release ──► Offlined
```

- **Automatic check** — [`tools/validate.py`](tools/validate.py) runs on every pull request: the manifest, the
  files, no internet access, version bumps, and a list of the Offlined data the addon uses. It also builds a test
  package to try.
- **Review** — a person reads the code and tries the addon ([review guide](docs/REVIEW.md)). Only the maintainer
  can merge.
- **Signature** — approved addons are packed and signed with Offlined's key, offline, on the maintainer's
  computer. Offlined installs signed addons without a warning, and refuses any package that was changed after
  signing.
- **Catalogue** — each release carries every approved addon and `catalog.json`. Offlined reads the latest one.

Addons that are not in the catalogue can still be shared as `.zip` files; Offlined installs them after a warning
and marks them «Unverified».

## What is here

| | |
|---|---|
| [`addons/`](addons/) | One folder per approved addon: `addon.json`, `frontend/`, `README.md`. |
| [`docs/sdk/`](docs/sdk/README.md) | The Addon SDK: manifest, panel, storage and API, publishing, security. |
| [`templates/`](templates/) | Starting points for new addons. |
| [`tools/`](tools/) | `validate.py` (the check), `package.py` (test packages), `publish.py` (signed release, maintainer only). |
| [`catalog.json`](catalog.json) | The catalogue of the latest release ([format](docs/catalog-format.md)). |

## Licence

The tools, documentation and template are under the [MIT licence](LICENSE). Each addon has its own open licence,
written in its `addon.json` (the official ones are MIT). `catalog.json` is CC0.

Offlined and the Offlined name and logo belong to Álvaro C. Chulvi. This repository is part of the Offlined
project; see also [WikiClassroom](https://github.com/Aruvaro-Chulvi/WikiClassroom),
[WikiTrees](https://github.com/Aruvaro-Chulvi/WikiTrees),
[Offlined Landmarks 3D](https://github.com/Aruvaro-Chulvi/OfflinedLandmarks3D) and
[Offlined Sea 3D Models](https://github.com/Aruvaro-Chulvi/OfflinedSea3DModels).
