# 🗒️ Text document (Notes)

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Write and organise rich-text documents inside Offlined — fully offline.

## What it does

- Rich text with [Quill](https://quilljs.com) (BSD-3-Clause, shipped with Offlined): headings, bold, lists,
  links, colours.
- A searchable list of your documents: new, save, duplicate and delete.
- **Read aloud** a document with the computer's voices.
- **Tag a place**: link a document to a location and find it later on Offlined's maps.
- Asks before discarding unsaved changes.
- In the 10 languages of Offlined.

## Where your documents are

In your Offlined data folder (`Addons/Addons - notes/`), one JSON file per document. Uninstalling or updating
the addon never deletes them.

## Requirements

Offlined 3.0 or later. Uses Offlined's notes service (`/api/addon-notes/*`) and its copy of Quill in `/vendor/`.
