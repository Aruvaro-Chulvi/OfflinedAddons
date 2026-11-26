# ⭕ Circuit

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

A loop puzzle in the style of Slitherlink, inside Offlined, fully offline, with its own puzzle generator.

## How to play

Draw **one single closed loop** along the lines between the dots. A number in a square tells how many of that
square's four sides belong to the loop (0 to 3). The loop never crosses or branches: every dot it passes has
exactly two lines. You win when the loop is closed and every number is satisfied.

- **Click** a gap between two dots to draw a line; click again for a cross ✕ ("no line here"); once more to clear.
- **Right click** (or the **✕ mode** button, handy on touch screens) puts or removes a cross.
- **Drag** to draw several lines (or crosses) in one stroke.
- A number turns grey when its four sides are decided and red if it has too many lines or crosses.
- When the loop is complete, its inside is shaded.

## What it does

- **Six levels**, growing in size and in the reasoning they need:

  | Level | Size | Hardest technique needed |
  |---|---|---|
  | Very easy | 5×5 | Basic rules: a number that is full, dots with two lines, dots with only one way out |
  | Easy | 7×7 | Basic rules, fewer numbers |
  | Medium | 8×8 | Patterns around a number (looking at its corners) |
  | Hard | 10×10 | No small loops, patterns of two numbers |
  | Expert | 12×12 | Inside and outside of the loop |
  | Master | 15×15 | Assumption and contradiction |

- **Every puzzle is new.** The generator grows a random region without holes (its border is the loop), writes all
  the numbers, then removes numbers while a "human" solver can still finish the puzzle using only the techniques
  of the level. Solving it by sound deduction also proves that the solution is unique.
- **Game codes** (`XXXX-XXXX`): the same code always gives the same puzzle.
- **Hints in three steps**: the area, then the technique (explained in one sentence), then the lines or crosses it
  gives. A hint counts once per board position: asking again or for **More help** on the same position adds nothing.
- **Mistakes**: *Free* (default; the addon tells you when a closed loop does not satisfy the numbers) or
  *Strict* (wrong lines and crosses shown at once and counted).
- Undo/redo, restart, pause, timer, statistics per level and a daily streak; best times only count games without
  hints. Light and dark theme like Offlined; the 10 languages of Offlined.
- **Sound** (Settings): *Off*, *Soft* (default) or *Normal*. Short sounds made in the browser (no audio files) for
  lines and crosses; silent when Offlined is muted. When you win, the loop is traced around the board.

### Keyboard

`X` ✕ mode · `H` hint · `P` or `Space` pause · `Ctrl+Z` / `Ctrl+Y` undo / redo · `Esc` closes.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/circuit/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**, plus two ready-made puzzles per level so a new game starts at
once. Updating the addon keeps it; uninstalling it deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. The addon reads `/api/users/session` (only to know which Offlined user is playing, their
name and avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the
internet. Puzzles are generated in a Web Worker so the game stays smooth.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC).
