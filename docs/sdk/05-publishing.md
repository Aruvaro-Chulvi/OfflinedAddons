# 5. Publishing

*[Leer en español](es/05-publishing.md)* · [SDK index](README.md)

Addons reach people through the **catalogue**: the list Offlined shows in **Addons → Manage addons → Available
addons**, with one button to install or update each one. Only addons that the maintainer has **reviewed,
approved and signed** are in it.

## From your idea to Offlined

```
 your pull request ──► automatic check ──► review ──► merge ──► signed release ──► «Available addons» in Offlined
                         (seconds)        (maintainer)          (maintainer)
```

1. **Pull request.** Add your folder `addons/<id>/` (or change an existing one) and open a pull request. Fill in
   the checklist of the template.
2. **Automatic check.** GitHub runs [`tools/validate.py`](../../tools/validate.py) and posts a report: errors
   (must be fixed), warnings (the reviewer looks at them) and the Offlined endpoints with personal data your addon
   uses. It also builds a **test package** you and the reviewer can download from the check's page (*Artifacts*)
   and install.
3. **Review.** The maintainer reads the code, installs the test package and tries it. They may ask for changes in
   the pull request. What they look at is in the [review guide](../REVIEW.md).
4. **Merge = approved.** Only the maintainer can merge into `main`.
5. **Signed release.** The maintainer packs every approved addon, signs it with Offlined's key (on their own
   computer — the key is never on GitHub) and publishes a new
   [release](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases) with the packages and `catalog.json`.
6. **In Offlined.** Every Offlined that opens *Available addons* sees your addon, and those that have an older
   version see **Update**.

## The rules

An addon is accepted when:

- It does something useful, and it does what its README says — nothing hidden.
- It works **without internet**: no scripts, fonts, images or requests from other servers.
- It does not send data anywhere, track people or show ads.
- It only uses the personal data it needs for what it does, and says so in its README.
- Its code is readable. Minified libraries are fine if they are well-known and you say which version they are;
  your own code must not be minified or obfuscated.
- It has an **open licence** from the accepted list, and everything inside it (libraries, images, fonts, sounds)
  can be redistributed under licences that allow commercial use. You credit them in the README.
- It is your own work, or you have the right to publish it.
- It is appropriate for every age: Offlined is used by families and schools.
- It is not a copy or a clone of a commercial product, a game or a brand.

## Updating your addon

Change your files, **raise `version`** in `addon.json` and open a pull request. The check refuses a changed addon
whose version was not raised, because Offlined decides that there is an update by comparing versions. Add a line
to `CHANGELOG.md` in your folder if you keep one.

The user's data survives updates (see [storage](04-storage-and-api.md)); if your new version changes the shape of
that data, convert the old one when your panel loads.

## Improving someone else's addon

Welcome — open a pull request as for your own. The original author is asked to agree to changes that alter what
the addon does. Keep the author and add yourself, e.g. `"author": "Ana Pérez, Li Wei"`.

## Withdrawing an addon

Authors can ask for their addon to be withdrawn by opening an issue. The maintainer may also withdraw an addon
that breaks the rules or stops working. A withdrawn addon disappears from *Available addons*; copies already
installed keep working until the user removes them.

## Sharing outside the catalogue

You can always give someone your `.zip` directly (`python tools/package.py`). Offlined will install it after
warning that it is not signed, and mark it «Unverified». The catalogue is for addons that anyone can trust
without knowing you.

## Signing (for reference)

A signed package has one extra file next to `addon.json`: `offlined-signature.json`, an Ed25519 signature over
the sorted list of `[path, SHA-256]` of every file in the package. Offlined checks it with its public key when it
installs the addon:

| Package | Offlined |
|---|---|
| Signed, and nothing changed | Installs it. No warning. |
| Not signed | Warns that it could see all the user's data; installs only if the user confirms; marks it «Unverified». |
| Signed, but a file changed after signing | Refuses to install it. |

Packages are built deterministically (fixed file order and dates), so anyone can rebuild a release from this
repository and compare the SHA-256 in `catalog.json`. The format of `catalog.json` is described in
[catalog-format.md](../catalog-format.md).
