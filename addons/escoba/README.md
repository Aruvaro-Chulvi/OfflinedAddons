# 🃏 Escoba

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

The Spanish card game **Escoba del 15** against the computer, inside Offlined and fully offline, with a Spanish
deck drawn for this addon.

## How to play

Each player gets 3 cards and 4 go on the table. On your turn, play one card: take the table cards that add up to
**15** together with it, or leave it on the table. Cards are worth their number; sota 8, caballo 9, rey 10.
Clearing the table is an **escoba**. When the hands run out, 3 more cards are dealt each; when the deck runs out,
the last player who took anything gets what is left.

At the end of each hand: 1 point per escoba, 1 for most cards, 1 for most oros, 1 for the siete de oros and 1 for
most sietes. If the first four table cards add up to 15 (or 30), the dealer takes them as one (or two) escobas.
The game is played to 21 points by default (11, 15 or 31 can be chosen).

- Pick a card from your hand, then the table cards (the ones it can take are outlined), and press **Take**; or
  **Leave on the table**. Double-click a card to play it when there is only one choice.
- **Hint** shows the move the Master level would make (the game then counts as «with help»).

## Levels

| Level | How the computer plays |
|---|---|
| Beginner | Almost at random, but never misses an escoba |
| Amateur | Goes for points: escobas, oros, sietes, the siete de oros |
| Advanced | Also avoids leaving you a table you can sweep |
| Master | Imagines the cards it cannot see and plays out hundreds of possible hands before choosing |

## The deck

Our own design, made for clarity: the four suits (oros, copas, espadas, bastos) in their usual colours, the
traditional numbers 1–7, 10, 11, 12, and the figures (sota, caballo, rey) drawn with flat
geometric shapes in two tones of the suit colour, on a soft panel. A small badge shows the value of the figures in this game (8, 9, 10).

## Sound

Short, quiet sound effects that follow the rhythm of the game: shuffling and dealing, a card on the table, taking
cards, a soft chime when it is your turn and small signals for the big moments (an escoba, the siete de oros, the end of a hand). Settings → Sound: off, soft
(default) or normal. The card and chip sounds are recordings from Kenney's «Casino Audio» pack (CC0, kenney.nl);
the signals are synthesised in the browser.

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/escoba/data/storage.json`): the game in progress,
settings and statistics **of each Offlined user**. Updating keeps it; uninstalling deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. Reads `/api/users/session` (only to know which Offlined user is playing, their name and
avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the internet.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC). Card and chip sounds: Kenney «Casino Audio» (CC0).
