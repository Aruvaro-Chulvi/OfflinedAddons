# 🔢 Sudoku

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Classic 9×9 sudoku inside Offlined, fully offline, with its own puzzle generator.

## What it does

- **Eight levels**: Very easy, Easy, Medium, Hard, Expert, Diabolical, Ultra and Deadly.
- **Every puzzle is new.** The addon creates them itself: a random full grid, numbers taken out while the solution
  stays unique, and then a "human" solver grades it. The level is decided by **the hardest technique you need**,
  not by how many numbers are given:

  | Level | Hardest technique needed |
  |---|---|
  | Very easy | Last empty cell, only place in a box (36–40 numbers given) |
  | Easy | Only place in a row or column, only candidate (30–34 numbers given) |
  | Medium | Pointing candidates, box/line reduction, naked pairs and triples |
  | Hard | Hidden pairs and triples, naked and hidden quads |
  | Expert | X-Wing, Y-Wing, Swordfish |
  | Diabolical | XYZ-Wing, Skyscraper, 2-String Kite, Turbot fish, W-Wing, simple colouring, unique rectangle, Jellyfish |
  | Ultra | X-Chains, XY-Chains and alternating inference chains |
  | Deadly | Forcing chains, needed three times or more, or forcing nets |

- **Game codes**: each sudoku has a code (`XXXX-XXXX`). The same code always gives the same sudoku, so you can share
  it or play it again.
- Notes (pencil marks), auto notes, undo/redo, highlighting of the row, column, box and same number.
- **Hints in three steps**: first the area to look at, then the technique, then the digit.
- **Mistakes**: *Free* (default — you find them yourself; the addon tells you when a full board has mistakes) or
  *Strict* (shown at once and counted).
- Pause (the board is hidden), timer, and statistics per level: played, won, best and average time, and a daily
  streak.
- Light and dark theme like Offlined, the 10 languages of Offlined, keyboard and touch.

### Keyboard

`1`–`9` place a digit · `Shift` + digit adds a note · arrows move · `Backspace`/`Delete` erase · `N` notes ·
`H` hint · `P` or `Space` pause · `Ctrl+Z` / `Ctrl+Y` undo / redo · `Esc` closes.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/sudoku/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**, plus a few ready-made sudokus per level so a new game starts at
once. Updating the addon keeps it; uninstalling it deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. The addon reads `/api/users/session` (only to know which Offlined user is playing, their
name and avatar colour) and its avatar picture `/api/users/<id>/avatar`, so each person in the family has their
own games and statistics. Nothing else, and nothing from the internet.

Puzzles are generated in a Web Worker, in short time slices, so the game stays smooth.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC).
