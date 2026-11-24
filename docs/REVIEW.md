# Review guide

*[Leer en español](REVIEW.es.md)*

What the maintainer checks before approving an addon. Contributors: read it too — a pull request that already
answers these questions is approved much faster.

## 1. The automatic check is green

[`tools/validate.py`](../tools/validate.py) runs on every pull request. No errors. Every warning has an answer
(in the code, the README or the pull request).

## 2. It does what it says

- The README explains what the addon does, what data it touches and which libraries it ships.
- Install the **test package** (check page → *Artifacts*) in Offlined and use it: light and dark theme, at least
  English and one other language, a small window and a large one.
- Nothing breaks in Offlined after closing it.

## 3. Read every line of its own code

- **Requests.** Every `fetch()`/`XMLHttpRequest`: where, why, what it sends. The check lists the endpoints with
  personal data (🔎). Each one must be needed for what the addon visibly does.
- **Writes and deletions.** Nothing changes or deletes the user's data unless the user asked for it in the addon.
- **Nothing hidden.** No obfuscated or minified own code, no long encoded strings, no `eval`/`new Function` on
  data, no code fetched and run at runtime, no `window.parent` tricks.
- **No tracking, ads, crypto-mining, or «call home».**
- **Messages to Offlined** (`postMessage`) only from the documented list.

## 4. Libraries and assets

- Known projects, a stated version, unmodified (or the changes explained).
- Licence files included; licences compatible with the addon's and allowing commercial use (no `NC`, no
  «personal use only» fonts or icons).
- Images, sounds and fonts: own work or properly licensed, credited in the README.
- `.wasm`: its source project and version are stated.

## 5. Fit for Offlined

- Works with no internet at all.
- Suitable for all ages.
- Not a clone of a commercial product, a game or a brand; no third-party trademarks in its name or icon.
- Reasonable size for what it does.
- For an update: `version` raised; old saved data still opens.
- Sound: it is quiet while Offlined's global mute is on (`ofl:mute`) and while the window is minimised.
- Leaving it mid-way loses nothing unexpectedly: it saves as it goes, or warns with `oflAddonBusy` while something
  in progress cannot be saved.

## 6. Approve

Approve and merge the pull request. Then publish (see [MAINTAINING.md](MAINTAINING.md)): until a signed release
is published, the addon is not in Offlined's catalogue.
