# 6. Security and privacy

*[Leer en español](es/06-security.md)* · [SDK index](README.md)

An addon runs **inside Offlined with the same access as Offlined itself**. That is what makes addons simple to
write — and why the catalogue is reviewed. This page says plainly what protects the user and what does not.

## What Offlined enforces

- **No internet from addons.** Offlined's Content Security Policy only lets a panel load files and make requests
  to Offlined itself (plus `data:` and `blob:`). Requests to other servers are blocked by the browser engine.
- **Signatures.** Catalogue addons are signed; Offlined refuses a signed package that was changed, and warns
  before installing an unsigned one.
- **Separate page.** Your panel runs in a sandboxed iframe: it cannot read or change Offlined's own page, and it
  cannot start downloads (files for the user go through [`/api/exports/save-file`](04-storage-and-api.md#saving-a-file-for-the-user)).
- **Safe paths.** Packages cannot write outside their folder (path traversal is blocked at install time), and a
  panel cannot read files outside its `frontend/` folder through `/addon-panels/`.
- **Parental control.** When it is on, addons cannot be installed or removed.
- Packages are limited to 200 MB at install time (50 MB in this repository).

## What Offlined does not enforce (yet)

- **There is no permission system.** The `permissions` field is not read. A panel can call any Offlined endpoint
  — mail, contacts, files, and the Safe while it is unlocked.
- **No code runs outside the panel**, but while the panel is open, its JavaScript can do anything Offlined's own
  page could do through the API.

That is why, outside the catalogue, people should only install addons from someone they trust — and why every
catalogue addon is read by a person before it is signed.

## What the review looks at

- Every request the code makes, and why. The automatic check lists the endpoints with personal data.
- Anything that hides what the code does: obfuscation, long encoded strings, `eval`, code downloaded and run at
  runtime.
- Writes or deletions in the user's data that the user did not ask for.
- Libraries: known projects, a stated version, a licence that allows commercial use.
- That it really works offline, in light and dark mode, and does not break Offlined.

See the full [review guide](../REVIEW.md).

## Reporting a problem

If you find a security problem in an addon or in how Offlined runs addons, **do not open a public issue**. Use
GitHub's private report: [*Security → Report a vulnerability*](https://github.com/Aruvaro-Chulvi/OfflinedAddons/security/advisories/new).
See [SECURITY.md](../../SECURITY.md).
