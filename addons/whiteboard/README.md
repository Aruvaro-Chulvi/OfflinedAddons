# ✏️ Whiteboard

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Draw freely on an infinite whiteboard inside Offlined — sketches, diagrams, handwriting — fully offline.

## What it does

- The board is [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT, shipped with Offlined): shapes,
  arrows, free hand, text, images, zoom and pan.
- A list of your saved drawings: new, save, rename, open again and delete.
- Asks before clearing or overwriting a drawing.
- Follows Offlined's light or dark theme.
- In the 10 languages of Offlined.

## Where your drawings are

In your Offlined data folder (`Office/whiteboard-json/`). Uninstalling or updating the addon never deletes them.

## Requirements

Offlined 3.0 or later. Uses Offlined's whiteboard service (`/api/addon-whiteboard/*`) and its copy of Excalidraw
in `/vendor/`.
