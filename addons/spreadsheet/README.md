# 📊 Spreadsheet

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Create and edit spreadsheets inside Offlined, with formulas, formatting and several sheets per file — without
an internet connection.

## What it does

- **Sidebar** like the one in Offlined's chat: pinned items, **folders** (drag and drop, collapsible), the rest
  grouped by date, search, sort by recent or A–Z, and a «…» menu on each row (rename, pin, move, duplicate, export, delete). It folds into a thin
  bar of icons and opens over the editor on small screens. Pins and folders are kept per Offlined user.
- The editor is [Univer](https://github.com/dream-num/univer) (Apache-2.0): formulas, number formats, cell
  styles, several sheets, copy and paste from other programs.
- With Offlined 4.0 the editor also has **filters**, **sorting**, **conditional formatting** (colour scales, data
  bars, icon sets…), **data validation** with drop-down lists, **find and replace**, **links** in cells, **images**,
  cell **notes**, **tables**, a full-screen cell editor and row/column highlighting — all free Univer plugins. They
  are saved with the sheet. Univer's own menus come in Spanish, French, Russian and Chinese as well as English.
  If Univer was downloaded with an older Offlined, a bar offers to fetch just the new parts (≈2 MB).
- **Import** with the Import button or by dropping files (several at once): Excel **.xlsx/.xlsm**, LibreOffice
  **.ods** and **.csv/.tsv** (separator and encoding detected; text starting with `=` stays text). Values,
  formulas (also across sheets), dates, fonts, colours, borders, alignment, number formats, merged cells, column
  widths, row heights, hidden rows/columns, frozen panes, tab colours, notes, links and drop-down lists come along.
  Charts, images, conditional formatting and macros are not imported (you are told). Old `.xls`: save it as .xlsx
  or .ods first.
- **Export** with the Export button or the «…» menu: Excel **.xlsx**, LibreOffice **.ods** (formulas translated to
  OpenFormula), **PDF** (through the print dialog: «Save as PDF»), **CSV** of the current sheet (`;` and decimal
  comma in languages that use them) and a web page **.html**. The .xlsx and .ods keep values, formulas, styles, number
  formats, merged cells, sizes, hidden rows/columns, frozen panes, tab colours, notes, links, drop-down lists and the
  autofilter. Files go to *Offlined Exports* (Media).
- The first time you open it, Offlined offers to download the Univer editor once (~50 MB). After that it works
  completely offline.
- Asks before discarding unsaved changes.
- In the 10 languages of Offlined.

## Where your files are

In your Offlined data folder, handled by Offlined itself — not inside the addon. Uninstalling or updating the
addon never deletes your spreadsheets.

## Requirements

Offlined 3.0 or later. This addon uses Offlined's built-in spreadsheet service (`/api/addon-spreadsheet/*`) and
the Univer editor that Offlined downloads (`/api/univer/*`; `?missing=1` fetches only new plugins). It also reads `/api/users/session` (only the active user's id) to keep each user's pins and folders
apart, in the addon's own storage.

## Third-party code

`frontend/vendor/exceljs.min.js` is [ExcelJS](https://github.com/exceljs/exceljs) (MIT) and `frontend/vendor/fflate.min.js`
is [fflate](https://github.com/101arrowz/fflate) (MIT); they load only when you import or export. Their notices, and those of
ExcelJS's dependencies (all permissive), are in `frontend/vendor/THIRD_PARTY_LICENSES.txt`.
