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

## Saving a file for the user

Your panel cannot start a download (the sandbox does not allow it). To give the user a file — an export, an image,
a document — send it to Offlined, which saves it in the *Exports* folder of the user's data:

```js
const fd = new FormData();
fd.append("file", blob, "my-export.pdf");
fd.append("filename", "my-export.pdf");
const r = await fetch("/api/exports/save-file", { method: "POST", body: fd });
const { name, rel } = await r.json();   // the name it got (a date is added if it already existed) and its path
```

Up to 200 MB per file. Tell the user where it went, for example «Saved to Exports: my-export.pdf».

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
window.parent.postMessage({ action: "setMode", mode: "calendar" }, location.origin);
```

| Message | What Offlined does |
|---|---|
| `{ action: "setMode", mode }` | Goes to another section, e.g. `"home"`, `"calendar"`, `"maps"`, `"library"`. |
| `{ action: "openLibrary", path }` | Opens *Offlined Files* at that folder. |
| `{ action: "openImage", rel }` | Opens an image of the user's gallery in the image viewer. |
| `{ action: "openGeoPicker", kind, ref, title? }` | Opens the picker that links something of yours to a place on the map. |
| `{ action: "openMap", lat, lon }` | Opens **Maps** centred on that place. |
| `{ action: "speakText", text }` | Reads a text aloud (up to 4,000 characters). **Does nothing in Offlined 4**, which has no text-to-speech section yet. |
| `{ action: "requestFullscreen" }` | Shows your panel full screen. |
| `{ action: "exitFullscreen" }` | Leaves full screen. |
| `{ type: "oflAddonBusy", busy, title, msg, stay, leave }` | Something in progress would be lost if the user left (Offlined 4, below). |

And Offlined sends you:

| Message | When |
|---|---|
| `{ type: "theme", value: "light" \| "dark" }` | The user switches the theme while your addon is open. |
| `{ type: "ofl:mute", on }` | The global mute is switched on or off, and every second while it is on (Offlined 4, see [sound](03-panel.md#sound)). |

Check `e.origin === location.origin` in your message listener, so only Offlined itself can talk to your panel.

### Something in progress: `oflAddonBusy`

Your panel is [closed when the user leaves it](03-panel.md#when-the-user-leaves). When leaving would lose something
that cannot be saved — a game in progress, a recording — say so, and say when it is over:

```js
window.parent.postMessage({
  type: "oflAddonBusy", busy: true,                 // false as soon as it is over (game ended, work saved)
  title: t("leaveTitle"),                           // «Leave the game?»
  msg: t("leaveMsg"),                               // «It won't count for the ranking.»
  stay: t("keepPlaying"), leave: t("leaveAnyway"),  // the two buttons
}, location.origin);
```

While `busy` is `true`, leaving your panel shows a small window with your texts (already in the user's language)
and two buttons; *stay* keeps the user in your addon. Use it only when something really would be lost — not for
data you save anyway — and send `busy: false` as soon as that is over. Offlined 3 ignores it.

This is a small, fixed set. You cannot add your own messages; if your addon needs something from Offlined that is
not here, [open an issue](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new/choose) and explain it.
