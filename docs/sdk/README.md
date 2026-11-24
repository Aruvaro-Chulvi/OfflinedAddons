# Offlined Addon SDK

*[Leer en español](es/README.md)*

An **addon** adds a new tool to [Offlined](https://www.offlined.org), the offline library and workspace. It is a
small web page — HTML, CSS and JavaScript — that Offlined opens inside its own window, from the **Addons** menu.
The official addons (Sudoku, Chess, Escoba, the QR generator…) are in [`addons/`](../../addons/): real examples you
can read and copy. Up to Offlined 3 the office apps (spreadsheet, text documents, whiteboard, audio notes) were
addons too; from Offlined 4 they come built in.

If you can write a web page, you can write an addon. No build step, no framework, no server code.

## Contents

| | |
|---|---|
| [1. Getting started](01-getting-started.md) | Your first addon in ten minutes, and how to try it in Offlined while you write it. |
| [2. The manifest — `addon.json`](02-manifest.md) | Every field: name, version, icon, licence, languages, category. |
| [3. The panel](03-panel.md) | How Offlined loads your page; light and dark theme; the 10 languages; libraries. |
| [4. Storage and the Offlined API](04-storage-and-api.md) | Saving your addon's data; calling Offlined; talking to the app with `postMessage`. |
| [5. Publishing](05-publishing.md) | Sending your addon to this repository: the rules, the review, signing and the catalogue. |
| [6. Security and privacy](06-security.md) | What Offlined enforces, what it does not, and what reviewers look for. |
| [7. Roadmap](07-roadmap.md) | What is planned and not available yet. |

## New in Offlined 4

- **Your panel is closed when the user leaves it** (Offlined 3 kept it loaded and hidden). Save as you go, and if
  leaving would lose something — a game in progress — ask Offlined to warn the user:
  [when the user leaves](03-panel.md#when-the-user-leaves).
- **Global mute.** Offlined has a mute button next to the language flags and tells your panel (`ofl:mute`). If your
  addon makes sound, [respect it](03-panel.md#sound).
- **Pointer lock** works inside panels (games that capture the mouse).
- **`speakText` does nothing** for now: Offlined 4 has no text-to-speech section.
- To give the user a file, [save it to their Exports folder](04-storage-and-api.md#saving-a-file-for-the-user):
  panels cannot start downloads.

An addon that relies on any of this should set `"min_offlined": "4.0.0"`.

## The short version

```
addons/my-addon/
├── addon.json          # the manifest: id, name, version, author, licence…
├── README.md           # what it does (shown on GitHub)
└── frontend/
    ├── panel.html      # your addon: the page Offlined opens
    └── …               # any CSS, JS, images or fonts it needs
```

1. Copy [`templates/hello-world`](../../templates/hello-world/) to `addons/<your-id>/` and edit it.
2. Try it: `python tools/package.py addons/<your-id>` and install the `.zip` from **Addons → Manage addons**.
3. Open a pull request. The automatic check runs, the maintainer reviews it, and once it is approved it is signed
   and appears in **Available addons** inside every Offlined.

## Ground rules

- **Offline first.** An addon must work without internet: everything it uses travels inside its folder (or
  comes from Offlined's own `/vendor/` libraries). Pages that load scripts, fonts or data from the internet are
  not accepted.
- **Respect people's data.** An addon runs with the same access as Offlined itself. Use only what your addon
  needs, never send anything anywhere, and say in your README what data you touch.
- **Open source.** Every addon here is published under an open licence (MIT recommended), so anyone can read,
  review and improve it.
