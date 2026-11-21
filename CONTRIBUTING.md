# Contributing

*[Leer en español](CONTRIBUTING.es.md)*

Thank you for wanting to make Offlined better. There are many ways to help:

- **Write a new addon** — see below.
- **Improve an addon** — fix a bug, add a feature, translate it to another of Offlined's languages.
- **Suggest an addon** — [open an idea](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new?template=addon-idea.yml)
  for someone to build.
- **Report a bug** in an addon — [open a bug report](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new?template=bug.yml).
- **Improve the SDK documentation.**

By contributing you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Sending a new addon

1. Read the [Addon SDK](docs/sdk/README.md), above all [publishing](docs/sdk/05-publishing.md): the rules are
   short and the check enforces most of them.
2. **Fork** this repository and create a branch.
3. Copy [`templates/hello-world`](templates/hello-world/) to `addons/<your-id>/` and build your addon there.
   Your folder may contain only:
   - `addon.json` — the manifest ([fields](docs/sdk/02-manifest.md)).
   - `frontend/` — `panel.html` and everything it loads.
   - `README.md` — what it does, **what Offlined data it uses and why**, which libraries it ships and their
     licences. Optionally `README.es.md`.
   - Optionally `CHANGELOG.md`, `LICENSE` (if not MIT) and `screenshot.png` (1280×800).
4. Check it and try it in Offlined:

   ```bash
   python tools/validate.py addons/<your-id>
   python tools/package.py addons/<your-id>     # → dist/test/<your-id>-<version>.zip
   ```

5. Open a pull request and fill in the checklist. One addon per pull request, please.

## What happens next

- The **automatic check** runs in a few seconds and posts its report on the pull request page (*Checks →
  Summary*). Fix any error and push again — the check runs again by itself.
- A **test package** is attached to the check (*Artifacts*), so you and the reviewer can install exactly what you
  sent.
- The **maintainer reviews** your addon following the [review guide](docs/REVIEW.md) and may ask for changes.
  Please be patient: every line is read by a person.
- When it is **approved**, the pull request is merged and your addon goes into the next signed release. From then
  on, every Offlined lists it in *Available addons*, with your name as author.

## Changing an existing addon

- Raise `version` in its `addon.json` (`1.0.0` → `1.0.1` for a fix, `1.1.0` for a new feature). The check refuses
  a changed addon with the same version.
- Keep the existing authors and add yourself.
- For changes to what an addon does, the original author is asked to agree.

## Licences

- New addons: an open licence from the accepted list (`MIT` recommended), written in `addon.json`.
- Everything inside your addon (libraries, icons, fonts, images, sounds) must be redistributable and allow
  commercial use. No `NC` licences, no «free for personal use» assets.
- By sending a pull request you confirm that you have the right to publish its contents under those licences.

## Questions

Open an [issue](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues) — no question is too small.
