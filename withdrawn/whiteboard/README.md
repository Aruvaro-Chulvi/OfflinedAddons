# ✏️ Whiteboard

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Draw freely on an infinite whiteboard inside Offlined — sketches, diagrams, handwriting — fully offline.

## What it does

- The board is [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT, shipped with Offlined): shapes,
  arrows, free hand, text, images, zoom and pan.
- **Sidebar** like the one in Offlined's chat: pinned items, **folders** (drag and drop, collapsible), the rest
  grouped by date, search, sort by recent or A–Z, and a «…» menu on each row (rename, pin, move, duplicate, download the image or the .excalidraw file, delete). It folds into a thin
  bar of icons and opens over the editor on small screens. Pins and folders are kept per Offlined user.
- Asks before clearing or overwriting a drawing.
- Follows Offlined's light or dark theme.
- In the 10 languages of Offlined.

## Where your drawings are

In your Offlined data folder (`Office/whiteboard-json/`). Uninstalling or updating the addon never deletes them.

## Requirements

Offlined 3.0 or later. Uses Offlined's whiteboard service (`/api/addon-whiteboard/*`) and its copy of Excalidraw
in `/vendor/`. It also reads `/api/users/session` (only the active user's id) to keep each user's pins and folders
apart, in the addon's own storage. With the next version of Offlined, hovering a drawing in the sidebar shows its picture.
