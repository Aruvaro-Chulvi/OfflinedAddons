# 🛡️ Sky Guardians

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

An arcade air-combat survival game over **your own maps**: pick a place on a map you have downloaded, and a giant
communication tower rises there. Wave after wave of enemy aircraft comes for it. Shoot them down, repair the tower
and hold on as long as you can. Fully offline, built on Offlined's **Wiki Flight** engine.

## How to play

1. **Play → Prepare the game.** Choose the map, the point of the battle (on the map, at random or one of your last
   places), your plane, the mode and the difficulty.
2. Defend the tower. Its health goes from 100 % to 0 %, and you can see the damage on the tower itself.
   - **Repair kits** fall by parachute from some enemies: fly over one, then through the green ring next to the
     tower (+15 %). Between waves the tower also recovers 5 %.
   - **Power-ups** glow in the air after some kills: rapid fire, unlimited weapon 2, ship repaired, double points.
   - **Four anti-aircraft turrets** on the tower's plaza help you while the tower is above 30 %.
   - Shooting down an enemy that had almost reached the tower is a **Saved!** (+100); any hit on the tower breaks
     your streak.
3. Every 5th wave brings a **boss**, a strategic bomber: only its engines really hurt it. With two engines left it
   gets furious; with one, it dives at the tower.

Enemies come from the directions shown during the break between waves (text, orange arrows and the radar), and
many waves have a theme: tower strike, fighters, drone swarm, bomber squadron, helicopters, low-level run.

**Training** (2 minutes) teaches flying, shooting, locking targets and repairing the tower.

## Modes

| Mode | |
|---|---|
| Survival | Endless waves until the tower falls. |
| Short | 10 waves with 2 bosses, about 8 minutes. If the tower holds, you win. |
| Daily | The same game for the whole family today: same waves, plane of the day, Normal difficulty. Replay it as often as you like; today's ranking keeps everyone's best. |

Difficulty: easy, normal or hard. An optional **AI wingman** (not in the daily game) flies with you and goes for
whatever threatens the tower; its kills give no points, and those games are marked 🤝 in the ranking.

## The planes

| | Light attack plane | Fighter |
|---|---|---|
| Speed | Slow | Fast |
| Agility | Very high | Medium |
| Weapon 1 | Two wing machine guns | Nose rotary cannon |
| Weapon 2 | Rocket salvos (area damage) | Guided missiles: hold to lock up to 4 targets, release to fire |

Both planes are our own generic designs, and so are the enemies (a fictional faction in dark grey and amber).
Six liveries unlock as you rank up, from Cadet to Guardian. The **Hangar** shows each plane's specs, its weapons
and its liveries.

## Controls

Arcade controls for **controller** and **keyboard and mouse**, both remappable in Controls:

| | Keyboard and mouse | Controller |
|---|---|---|
| Fly | Mouse (click the screen to aim with it) or arrows / A D | Left stick |
| Weapon 1 · Weapon 2 | Space or left click · V or right click | RT · LT |
| Target (hold: camera on it) | Tab or E | Y |
| Speed up · Slow down | W or Shift · S or Ctrl | RB · LB |
| Camera · Pause | C · Esc | D-pad up · Start |

The game pauses by itself when the window loses focus, when Offlined is minimised or when the controller is
disconnected. Leaving the addon in the middle of a game asks first: an unfinished game does not count.

## Progress

Ranks (Cadet, Pilot, Lieutenant, Captain, Ace, Guardian) by the best wave reached, 30 achievements, your history
and a **family ranking** for each mode and difficulty, with every Offlined user who plays on this computer.

## Sound

Sound effects and adaptive music are synthesised in the browser: there are no audio files. Separate volumes for
music and effects in Settings; the 🔊 button at the top right (or the M key) silences everything, and the game is
quiet while Offlined's global mute is on.

## Requirements

- **Offlined 4.0 or later** (the addon uses Wiki Flight's add-on mode, new in Offlined 4).
- A **fully detailed map (level 14 or more) downloaded in Maps**, covering the place of the battle.
- A graphics card that runs Wiki Flight smoothly. The quality settings of Wiki Flight apply.

## Where your data is

- In the addon's own storage (`Offlined Data/Addons/installed/sky-guardians/data/storage.json`): finished games,
  rankings, achievements and ranks **of each Offlined user**. Updating keeps it; uninstalling deletes it.
- In the browser engine's local storage: your settings, controls, volumes and last places.

## Offlined API

Reads `/api/users/session` (only to know which Offlined user is playing and their name), `/api/wiki-geo` (towns
near the chosen point, for «Random place») and its own storage `/api/addons/sky-guardians/storage`. It runs inside
Offlined's Wiki Flight (`/flightsim/`) and uses Offlined's copy of three.js (`/vendor/three-0.169.0/`). Nothing
else, and nothing from the internet.

## Licence

MIT. Planes, tower, enemies, sound and music are original and generated in code; three.js (MIT) and the map data
(© OpenStreetMap contributors, ODbL) come from Offlined itself.
