# 📊 Spreadsheet

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Create and edit spreadsheets inside Offlined, with formulas, formatting and several sheets per file — without
an internet connection.

## What it does

- A list of your spreadsheets on the left: open, rename, save and delete them.
- The editor is [Univer](https://github.com/dream-num/univer) (Apache-2.0): formulas, number formats, cell
  styles, several sheets, copy and paste from other programs.
- The first time you open it, Offlined offers to download the Univer editor once (~50 MB). After that it works
  completely offline.
- Asks before discarding unsaved changes.
- In the 10 languages of Offlined.

## Where your files are

In your Offlined data folder, handled by Offlined itself — not inside the addon. Uninstalling or updating the
addon never deletes your spreadsheets.

## Requirements

Offlined 3.0 or later. This addon uses Offlined's built-in spreadsheet service (`/api/addon-spreadsheet/*`) and
the Univer editor that Offlined downloads (`/api/univer/*`).
