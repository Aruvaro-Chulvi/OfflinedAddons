# 🎙️ Audio notes

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Record, clean up and play back voice notes inside Offlined — fully offline.

## What it does

- Record from the microphone with a live visualiser.
- Optional clean-up while recording: **normalise volume**, **noise reduction** and a **high-pass filter**.
- **Sidebar** like the one in Offlined's chat: pinned items, **folders** (drag and drop, collapsible), the rest
  grouped by date, search, sort by recent or A–Z, and a «…» menu on each row (rename, pin, move, attach to a calendar event, export to MP3, delete; each row shows the length and a play
  button). It folds into a thin
  bar of icons and opens over the editor on small screens. Pins and folders are kept per Offlined user.
- In the 10 languages of Offlined.

## Where your recordings are

In your Offlined data folder (`Addons/Addons - audio-notes/`). Uninstalling or updating the addon never deletes
them.

## Requirements

Offlined 3.0 or later. Uses Offlined's audio-notes service (`/api/addon-audio-notes/*`, `/api/audio/rename`). It also reads `/api/users/session` (only the active user's id) to keep each user's pins and folders
apart, in the addon's own storage.
The microphone is only used while you record.
