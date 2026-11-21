# Maintaining the catalogue

*[Leer en español](MAINTAINING.es.md)*

For the maintainer: how an approved addon gets into Offlined.

## Once

- Python 3.9+ with `cryptography` (`pip install cryptography`), and [`gh`](https://cli.github.com) logged in.
- Offlined's addon signing key, `offlined_addons_ed25519.pem`. By default `tools/publish.py` looks for it in
  `..\SurvivalAI-phi4\.signing\`; otherwise pass `--key PATH` or set `OFFLINED_SIGNING_KEY`. **Never** commit it,
  upload it to GitHub (not even as an Actions secret) or send it to anyone: whoever has it can sign addons as
  Offlined. Keep a backup outside this computer.

## Approving a pull request

1. The automatic check is green; read its report (errors, warnings, 🔎 endpoints with personal data).
2. Download the test package (check page → *Artifacts*), install it in Offlined and try it.
3. Follow the [review guide](REVIEW.md). Ask for changes in the pull request if needed.
4. Merge. Approving is merging: `main` only accepts pull requests reviewed by the code owner.

## Publishing

```bash
git pull
python tools/publish.py --dry-run   # builds and signs into dist/, shows what changes
python tools/publish.py             # creates release addons-YYYY-MM-DD with every zip + catalog.json
git add catalog.json
git commit -m "Catalogue addons-YYYY-MM-DD"
git push
```

`publish.py` refuses to run if any addon fails the check or if the key is not Offlined's. Each release carries
**every** approved addon and the catalogue, and is marked *latest*; Offlined reads
`releases/latest/download/catalog.json`. Releases are never edited: to fix one, publish a new one (a second
release the same day is `addons-YYYY-MM-DDb`). GitHub can take a minute or two to serve the new *latest*.

The committed `catalog.json` is what the check compares versions against, so commit it after every release.

## Withdrawing an addon

Delete its folder in a pull request (or move it to `withdrawn/` to keep the history visible), merge, publish.
It disappears from *Available addons*; installed copies keep working.

## Official addons

`tools/official.json` lists the addons made by Offlined; the catalogue marks them «Official». The Offlined
build still ships its own copy of the four built-in addons (spreadsheet, notes, whiteboard, audio-notes); when
one of them changes here, copy it into Offlined too.
