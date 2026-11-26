# 🧮 Calcudoku

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

An arithmetic logic puzzle inside Offlined, fully offline, with its own puzzle generator. Same layout as the Sudoku
addon.

## How to play

Fill an N×N grid with the numbers 1 to N so that **every row and every column holds each number once**. The grid
is split into **cages** (thick borders). Each cage shows a result and an operation: the numbers in the cage must
give that result with + (sum), − (difference of two numbers), × (product) or ÷ (quotient of two numbers). A cage
of one cell just shows its number. Numbers may repeat inside a cage if they are not in the same row or column.

## What it does

- **Six levels**:

  | Level | Grid | Operations | Hardest technique it asks for |
  |---|---|---|---|
  | Very easy | 4×4 | + | Cage combinations |
  | Easy | 5×5 | + − | Cage combinations (sometimes cage and line) |
  | Medium | 6×6 | + − × ÷ | Cage and line, or naked / hidden pairs |
  | Hard | 7×7 | + − × ÷ | Pairs, or the sum of a line |
  | Expert | 8×8 | + − × ÷ | Sum of a line, naked triple or X-Wing |
  | Master | 9×9 | + − × ÷ | Naked triple or X-Wing |

  Levels differ by the reasoning they need, not only by the size: every puzzle of a level needs at least its
  technique and nothing harder than the level allows.

- **Every puzzle is new.** The generator builds a random Latin square, cuts it into cages and picks the operations;
  a puzzle is kept only if a logical solver finishes it (singles, cage combinations, cage and line, naked and hidden pairs,
  line sums, naked triples, X-Wing), which
  also proves its solution is unique.
- **Game codes** (`XXXX-XXXX`): the same code always gives the same puzzle.
- Notes, auto notes, undo/redo, highlighting of the row, column and same number.
- **Hints in three steps**: the area, then the technique, then the number.
- **Mistakes**: *Free* (default) or *Strict* (wrong numbers shown at once and counted).
- Pause, timer, statistics per level and a daily streak; light and dark theme like Offlined; the 10 languages of
  Offlined.

### Keyboard

`1`–`9` place a number · `Shift` + number adds a note · arrows move · `Backspace`/`Delete` erase · `N` notes ·
`H` hint · `P` or `Space` pause · `Ctrl+Z` / `Ctrl+Y` undo / redo · `Esc` closes.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/calcudoku/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**, plus two ready-made puzzles per level. Updating the addon keeps
it; uninstalling it deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. The addon reads `/api/users/session` (only to know which Offlined user is playing, their
name and avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the
internet. Puzzles are generated in a Web Worker.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC).
