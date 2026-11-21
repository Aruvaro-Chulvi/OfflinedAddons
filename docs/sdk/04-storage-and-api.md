# 4. Storage and the Offlined API

*[Leer en español](es/04-storage-and-api.md)* · [SDK index](README.md)

## Saving your addon's data

Every addon has a place of its own to keep one JSON object:

```js
const ID = "my-addon";

// Read — {} if nothing was saved yet
const { data } = await fetch(`/api/addons/${ID}/storage`).then((r) => r.json());

// Write — replaces the whole object (it is not merged)
await fetch(`/api/addons/${ID}/storage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data: { count: 4, last: "work" } }),
});
```

| Endpoint | |
|---|---|
| `GET /api/addons/<id>/storage` | `{"data": {...}}`, an empty object if nothing was saved. |
| `POST /api/addons/<id>/storage` | Body `{"data": {...}}`. Replaces the whole object. |

It is saved in `Offlined Data/Addons/installed/<id>/data/storage.json`, inside the user's Offlined data.

- **Updates keep it.** When the user installs a newer version of your addon, the `data/` folder is kept.
- **Uninstalling deletes it.** Removing the addon removes its folder, data included.
- Keep it reasonable: it is one file, read and written whole. For a few hundred kilobytes it is perfect; for
  many megabytes, think again about what you need to keep.
- Write a `version` inside your object if its shape may change, so a future version of your addon can convert
  old data.

`localStorage` and `IndexedDB` also work inside your panel, but they live in the browser engine's profile, not
in the user's Offlined data folder: they may not travel with it when the user moves Offlined to another computer
or a USB drive, and they are not separated by Offlined user. Use them only for small preferences you can lose.

## Calling Offlined

Your panel shares its origin with Offlined's server, so it can call Offlined's own `/api/…` endpoints with a
plain `fetch()`:

```js
const status = await fetch("/api/status").then((r) => r.json());
```

Read this before relying on it:

- These are **Offlined's internal endpoints, not a versioned public API.** They can change between versions. Set
  `min_offlined`, prefer read-only calls, and test your addon with each new Offlined.
- **Everything you call is reviewed.** The automatic check lists every endpoint with personal data your addon
  uses (mail, contacts, calendar, the Safe, photos, chats…), and the maintainer checks that your addon really needs
  it. Say why in your README.
- Endpoints that download from the internet are blocked by Offlined's parental control and by its «total
  offline mode»; your addon must cope with that.

## Talking to Offlined: messages

Your panel can ask Offlined to do a few things with `postMessage`:

```js
window.parent.postMessage({ action: "setMode", mode: "calendar" }, "*");
```

| Message | What Offlined does |
|---|---|
| `{ action: "setMode", mode }` | Goes to another section, e.g. `"home"`, `"calendar"`, `"maps"`, `"library"`. |
| `{ action: "openLibrary", path }` | Opens *Offlined Files* at that folder. |
| `{ action: "openImage", rel }` | Opens an image of the user's gallery in the image viewer. |
| `{ action: "openGeoPicker", kind, ref, title? }` | Opens the picker that links something of yours to a place on the map. |
| `{ action: "speakText", text }` | Reads a text aloud with the computer's voices (up to 4,000 characters). |
| `{ action: "requestFullscreen" }` | Shows your panel full screen. |
| `{ action: "exitFullscreen" }` | Leaves full screen. |

And Offlined sends you:

| Message | When |
|---|---|
| `{ type: "theme", value: "light" \| "dark" }` | The user switches the theme while your addon is open. |

This is a small, fixed set. You cannot add your own messages; if your addon needs something from Offlined that is
not here, [open an issue](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new/choose) and explain it.
