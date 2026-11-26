# 💣 Minesweeper

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

The classic mine-clearing game inside Offlined, fully offline, with boards you can solve without guessing.

## How to play

Open every cell that has no mine. A number tells how many mines touch that cell (diagonals included). Use the
numbers to work out where the mines are.

- **Click** a cell to open it. The **first click is always safe** and opens an area.
- **Right click**, a **long press** (touch screens) or **flag mode** puts or removes a flag.
- **Click a number** that already has all its flags around it to open the rest of its neighbours (can be turned
  off in Settings). Middle click does it too.

## What it does

- **Four levels**:

  | Level | Board | Mines |
  |---|---|---|
  | Beginner | 9×9 | 10 |
  | Intermediate | 16×16 | 40 |
  | Expert | 30×16 | 99 |
  | Master | 30×24 | 170 |

- **No guessing** (on by default): the mines are placed after your first click, and a board is only accepted if a
  logical solver can clear it from there. You will never be stuck on a 50/50.
- **Hints in three steps**: the numbers to look at, the reasoning (a number already complete, exactly as many mines
  as hidden cells, comparing two numbers, mines left in total), then the safe cell is opened or the mine flagged.
  A hint counts once per board position: asking again or for **More help** on the same position adds nothing.
- **Undo that move** after stepping on a mine. Hints and undo mark the game as **with help**: it still counts as a
  win, but not for the best time, the average time or the winning streak.
- Statistics per level (played, won, win rate, best and average time), a streak of wins without help, a pause that
  hides the board, numbers in grey or in colour, light and dark theme like Offlined, the 10 languages of Offlined.
- **Sound** (Settings): *Off*, *Soft* (default) or *Normal*. Short sounds made in the browser (no audio files);
  silent when Offlined is muted. Openings ripple out from the click, flags pop, a number click that cannot open
  shakes, and when you lose the mines appear one after another.

### Keyboard

`F` flag mode · `H` hint · `N` new game · `P` or `Space` pause · `Esc` closes.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/minesweeper/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**. Updating the addon keeps it; uninstalling it deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. The addon reads `/api/users/session` (only to know which Offlined user is playing, their
name and avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the
internet.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC).
