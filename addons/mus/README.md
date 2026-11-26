# 🂠 Mus

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

The Spanish card game **Mus**, in pairs: you and your partner against two computer players, inside Offlined and
fully offline, with a Spanish deck drawn for this addon (the same as the Escoba addon).

## How a hand goes

1. **Mus**: from the «mano» (the player after the dealer) everyone says *Mus* or *No hay mus*. If all ask for mus,
   each player changes 1 to 4 cards and it starts again; the first *No hay mus* starts the lances.
2. **Lances**, in this order:
   - **Grande**: the highest cards win.
   - **Chica**: the lowest cards win.
   - **Pares**: par (two equal), medias (three equal), duples (two pairs). Only players with pares speak.
   - **Juego**: 31 or more (figures count 10). 31 is best, then 32, 40, 37, 36, 35, 34, 33. If nobody has juego,
     **Punto** is played instead (closest to 30).
3. In each lance: **Paso**, **Envido** (choose how much), raise, **Órdago** (the whole vaca), or answer **Quiero** /
   **No quiero**. A refused bet scores at once for the bettors.
4. **The count**: the hands are shown and points are added in the order Grande, Chica, Pares, Juego/Punto.
   Pares add 1 (par), 2 (medias) or 3 (duples) per player of the winning pair; Juego adds 3 for 31 and 2 for the
   rest; a lance nobody bet on is worth 1 (Grande, Chica, Punto). Ties go to the player closest to mano.

A **vaca** is won at 30 points (or 40); the game is the best of **3 vacas**. With **8 kings** (default) the threes
count as kings and the twos as aces; with 4 kings they keep their value.

## What it does

- **Four levels**: Beginner (bets and answers almost at random), Amateur (plays its cards, never bluffs),
  Advanced (reads the hand and bluffs a little) and Master (weighs every bet against what it may win or lose and
  reads the opponents' bets). The computer estimates its chances by dealing the unseen cards hundreds of times.
- A clear table: four seats with what each player says, the four lances with their state, a summary of what your
  hand has (pares, juego, punto), the count with all hands face up, and the score with the vacas.
- **Hint** suggests what the Master would do (the game then counts as «with help»).
- Statistics per level (won, lost, vacas, órdagos won); light and dark theme like Offlined; the 10 languages of
  Offlined; a short rules page inside the addon.
- Partner signals (*señas*) are not included in this first version.

## Sound and animation

Short, quiet sound effects that follow the rhythm of the game: shuffling and dealing, a card on the table, taking
cards, a soft chime when it is your turn and small signals for the big moments (envido, quiero, órdago, counting the points, a vaca won). Settings → Sound: off, soft
(default) or normal. The card and chip sounds are recordings from Kenney's «Casino Audio» pack (CC0, kenney.nl);
the signals are synthesised in the browser.

The cards move together with their sound:

- The 16 cards are dealt one by one from the middle of the table; discards go to the middle and the new cards come in.
- At the end of the hand the cards turn over one by one; after an órdago the winner is announced once the cards are
  shown.
- The last word of each lance stays visible for a moment.
- The animation follows Settings → Computer speed and respects the system's «reduce motion» (cards then just appear).

## Where your data is

In the addon's own storage (`Offlined Data/Addons/installed/mus/data/storage.json`): the game in progress, settings
and statistics **of each Offlined user**. Updating keeps it; uninstalling deletes it.

## Requirements and Offlined API

Offlined 3.0 or later. Reads `/api/users/session` (only to know which Offlined user is playing, their name and
avatar colour) and the avatar picture `/api/users/<id>/avatar`. Nothing else, and nothing from the internet.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC). Card and chip sounds: Kenney «Casino Audio» (CC0).
