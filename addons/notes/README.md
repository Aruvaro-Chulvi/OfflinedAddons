# 🗒️ Text document (Notes)

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Write and organise rich-text documents inside Offlined — fully offline.

## What it does

- Rich text with [Quill](https://quilljs.com) (BSD-3-Clause, shipped with Offlined): headings, bold, lists,
  links, colours.
- **Sidebar** like the one in Offlined's chat: pinned items, **folders** (drag and drop, collapsible), the rest
  grouped by date, search, sort by recent or A–Z, and a «…» menu on each row (rename, pin, move, duplicate, read aloud, place on the map, export to .txt or .html, delete). It folds into a thin
  bar of icons and opens over the editor on small screens. Pins and folders are kept per Offlined user.
- **Read aloud** a document with the computer's voices.
- **Tag a place**: link a document to a location and find it later on Offlined's maps.
- Asks before discarding unsaved changes.
- In the 10 languages of Offlined.

## Where your documents are

In your Offlined data folder (`Addons/Addons - notes/`), one JSON file per document. Uninstalling or updating
the addon never deletes them.

## Requirements

Offlined 3.0 or later. Uses Offlined's notes service (`/api/addon-notes/*`) and its copy of Quill in `/vendor/`. It also reads `/api/users/session` (only the active user's id) to keep each user's pins and folders
apart, in the addon's own storage. With the next version of Offlined the sidebar also shows each document's date and first words.
