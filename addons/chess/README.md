# ♟️ Chess

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Chess against the computer inside Offlined, fully offline, with a chess engine written for this addon.

## What it does

- **Four levels**:

  | Level | How the computer plays |
  |---|---|
  | Beginner | Looks one move ahead and sometimes picks a weaker move on purpose |
  | Amateur | Thinks 2–3 moves ahead, with small, occasional slips |
  | Advanced | Searches 4–6 moves ahead (about 1 second) and knows common openings |
  | Master | Searches as deep as it can in 2–3 seconds, no deliberate mistakes |

- Play **White, Black or random**. The board turns to your side; **Flip** turns it at any time.
- **Optional clock**: none (default), 5, 10 or 15 minutes each. It stops while the addon is hidden.
- Click a piece and then its square, or drag it. Possible moves, the last move and a king in check are marked.
- Pieces slide to their square (the rook too when castling; **Back** slides them back) and a king in check pulses.
- Full rules: castling, en passant, promotion (you choose the piece; `Esc` or a click outside cancels it),
  checkmate, stalemate, threefold repetition, the fifty-move rule and insufficient material.
- **Back** takes back your last move (and the computer's reply); **Hint** shows the computer's move with an
  arrow. Using either marks the game as **with help**: it still counts, and the statistics show how many wins
  were with help. The winning streak only counts wins without help.
- **Draw** offers a draw (the computer accepts when it is worse, or in a level, long game); **Resign** asks first.
- Moves in figurine notation (`♘f3`), the same in every language, and **Copy PGN** to open the game in any other
  chess program.
- **Sound** (Settings): *Off*, *Soft* (default) or *Normal*. Short sounds made in the browser (no audio files) for a
  move, a capture, castling, promotion, check and the end of the game; silent when Offlined is muted.
- Statistics per level (won, draws, lost), light and dark theme like Offlined, the 10 languages of Offlined.

## The engine

`frontend/engine/chess-engine.js`, written for this addon: 0x88 board with legal move generation (verified with
the standard *perft* test positions), alpha-beta search with iterative deepening, principal variation search,
transposition table, null-move pruning, late-move reductions, killer and history moves, and quiescence search.
The evaluation uses material, our own piece-square tables (middlegame/endgame), bishop pair, pawn structure,
passed pawns, rooks on open files and king shelter. A small book of common openings gives variety. It thinks in
a Web Worker, so the board never freezes.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/chess/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**. Updating the addon keeps it; uninstalling it deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. The addon reads `/api/users/session` (only to know which Offlined user is playing, their
name and avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the
internet.

## Licence

MIT. Piece and interface icons from [Lucide](https://lucide.dev) (ISC); the rook, knight and pawn outlines are
closed so they can be filled.
