# 3. The panel

*[Leer en español](es/03-panel.md)* · [SDK index](README.md)

## How Offlined loads it

When the user opens your addon, Offlined loads

```
/addon-panels/<id>/frontend/panel.html?theme=dark&lang=es
```

inside a sandboxed `<iframe>` (`allow-scripts allow-same-origin allow-forms allow-popups allow-modals
allow-pointer-lock`; pointer lock from Offlined 4) that
fills the Offlined window under a small title bar with your icon, name, version and author.

- Every file under your `frontend/` folder is served the same way: `frontend/style.css` is
  `/addon-panels/<id>/frontend/style.css`. Use **relative paths** (`<link href="style.css">`) and it just works.
- `?theme=` is `light` or `dark`, `?lang=` one of Offlined's ten languages — both as they were when the panel
  opened.
- There is nothing before or after: no install hook, no background process. Your page's own `<script>` is the
  whole life of your addon, from the moment the user opens it until they leave it.

## When the user leaves

From Offlined 4, **your page is closed when the user goes to another section** of Offlined, and loaded again from
scratch when they come back (Offlined 3 kept it loaded and hidden, sound included). So:

- **Save as you go**, in your [storage](04-storage-and-api.md), not only when the user presses a button: whatever
  is only in memory is gone when they leave.
- If something **cannot be saved** and would be lost — a game in progress, a recording — tell Offlined while it is
  going on, and Offlined asks the user before closing your panel
  ([`oflAddonBusy`](04-storage-and-api.md#something-in-progress-ofladdonbusy)).
- When the user minimises Offlined, your page stays open but hidden (`document.hidden`): pause your game and your
  sound.

## Your page is on its own

Your panel is a separate document, not part of Offlined's page:

- **No shared JavaScript.** Offlined's functions and variables are not visible to you, and yours are not visible
  to Offlined.
- **No shared CSS.** Offlined's colours and styles do not reach inside your iframe. Define your own (below).
- **No free libraries.** Load what you use — from your folder or from Offlined's `/vendor/` (below).
- **Same origin.** `fetch("/api/…")` reaches Offlined's own server, exactly as Offlined's page does.
- **No internet.** Offlined's Content Security Policy only allows files from Offlined itself (plus `data:` and
  `blob:` URLs). A script, font or request to another server is blocked by the browser.

## Light and dark theme

Use the same colour names and values as Offlined and your addon will look native:

```css
:root {
  --bg: #f6f6f6; --panel: #ffffff; --ink: #1f1f1f; --muted: #d6d6d6;
  --soft: #e9e9e9; --subtle: #666666; --accent: #2d2d2d; --accent-line: #2d2d2d;
}
[data-theme="dark"] {
  --bg: #0f0f10; --panel: #17181a; --ink: #e9e9ea; --muted: #2b2c31;
  --soft: #222327; --subtle: #9a9a9a; --accent: #dedede; --accent-line: #6b6d75;
}
body { background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; }
```

Apply the theme on load, and follow the user when they switch it while your addon is open:

```js
const params = new URLSearchParams(location.search);
const theme = params.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = theme;

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;   // only Offlined itself
  if (e.data?.type === "theme") document.documentElement.dataset.theme = e.data.value;
});
```

### Offlined's look

- Buttons are flat: a thin border, no shadow. The main button is grey, not coloured: `var(--soft)` with a
  `var(--accent-line)` border. Mark the selected or active state the same way — a change of colour, never a shadow
  or relief.
- Keep colour for your content (a game board, a chart), not for the buttons and panels around it.
- Rounded corners of 8–14 px, generous spacing, system font.
- Icons: emoji, or [Lucide](https://lucide.dev) SVGs (ISC) inside your folder.

## Language

Read `?lang=` and pick your texts from a small dictionary. Fall back to English:

```js
const T = {
  en: { hello: "Hello", save: "Save" },
  es: { hello: "Hola", save: "Guardar" },
};
const lang = new URLSearchParams(location.search).get("lang") || "en";
const t = (key) => (T[lang] && T[lang][key]) || T.en[key];
document.getElementById("save").textContent = t("save");
```

For Arabic, set `document.documentElement.dir = "rtl"` when `lang === "ar"`. There is no message when the user
changes the language while your addon is open: they will see the new language the next time they open it.

## Sound

If your addon plays sound or music:

- **Respect Offlined's global mute.** When the user presses the mute button next to the language flags, Offlined
  sends `{ type: "ofl:mute", on: true }` to your panel (and repeats it every second while it is on); `on: false`
  when it is switched off. Offlined itself mutes `<audio>` and `<video>` elements, but sound made with Web Audio is
  yours to silence.
- **Be quiet when you are not seen:** suspend your `AudioContext` while `document.hidden`.
- Start audio after the user's first click or key (the browser's rule), and give the user an off switch or a volume.

```js
let ctx = null, master = null, oflMuted = false;   // master: a GainNode just before ctx.destination
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.data?.type !== "ofl:mute") return;
  oflMuted = !!e.data.on;
  if (master) master.gain.value = oflMuted ? 0 : 1;
});
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});
```

`ofl:mute` is new in Offlined 4; older versions never send it, and your code simply never receives it.

## Libraries

Put any library inside your `frontend/` folder and load it with a relative path:

```html
<script src="lib/chart.umd.min.js"></script>
```

Keep its licence file next to it, and say which libraries you ship in your README. Only libraries with a licence
compatible with yours, and that allow commercial use, are accepted.

You can also use the copies that Offlined itself ships, from absolute paths under `/vendor/`:

```html
<link rel="stylesheet" href="/vendor/quill/quill.snow.css">
<script src="/vendor/quill/quill.min.js"></script>
```

This saves space, but it is a convenience, not a promise: Offlined may update or remove a library in a future
version. If your addon depends on one, set `min_offlined` and test it with each new Offlined.

## Files and sizes

- Allowed: web files (`.html`, `.css`, `.js`, `.mjs`, `.json`), images, fonts, audio and video, `.wasm`, text
  and data files. Not allowed: programs and system scripts (`.exe`, `.dll`, `.bat`, `.ps1`, `.py`, `.sh`…),
  archives, hidden files.
- Up to **25 MB** per file and **50 MB** per addon. Smaller is better: every byte is downloaded by everyone who
  installs it.
- **Downloads are blocked** inside the panel (the sandbox has no `allow-downloads`). To give the user a file, save
  it to their *Exports* folder: [saving a file for the user](04-storage-and-api.md#saving-a-file-for-the-user).
