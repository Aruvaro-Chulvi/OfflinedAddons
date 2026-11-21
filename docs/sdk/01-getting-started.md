# 1. Getting started

*[Leer en español](es/01-getting-started.md)* · [SDK index](README.md)

## What you need

- **Offlined 3.0 or later** installed on your computer.
- A text editor.
- [Python 3.9+](https://www.python.org) to run the helper tools in this repository (they only use the standard
  library — nothing to install).
- A [GitHub](https://github.com) account, when you want to share your addon.

## Your first addon

1. **Fork** this repository on GitHub and clone your fork, or just
   [download it as a zip](https://github.com/Aruvaro-Chulvi/OfflinedAddons/archive/refs/heads/main.zip) to start.
2. Copy the template and give it your id (lowercase letters, digits and hyphens):

   ```bash
   cp -r templates/hello-world addons/my-addon
   ```

3. Edit `addons/my-addon/addon.json`: set `"id": "my-addon"` (the same as the folder), the name, your name as
   author, a description and an emoji icon. See [the manifest](02-manifest.md).
4. Edit `addons/my-addon/frontend/panel.html`. This is your whole addon: a normal web page.
5. Check it:

   ```bash
   python tools/validate.py addons/my-addon
   ```

## Try it inside Offlined

```bash
python tools/package.py addons/my-addon
```

This writes `dist/test/my-addon-1.0.0.zip`. In Offlined open **Addons → Manage addons** and drop the file on
**Install addon**. Offlined warns you that the addon is not signed — that is expected for an addon in
development; confirm, and it appears in the **Addons** menu with an «Unverified» badge.

### Faster: edit it in place

Once installed, Offlined serves your addon straight from its folder:

```
Offlined Data/Addons/installed/my-addon/frontend/panel.html
```

Edit the files there and reopen the addon to see the change — no reinstalling. When you are happy, copy the
files back to `addons/my-addon/` in the repository.

> **Tip:** while Offlined is running you can also open
> `http://127.0.0.1:17870/addon-panels/my-addon/frontend/panel.html?theme=dark&lang=en` in your own browser and
> use its developer tools (console, network, inspector).

## Next

- Make it look like Offlined in light and dark mode, and speak the user's language: [the panel](03-panel.md).
- Save data: [storage and the Offlined API](04-storage-and-api.md).
- Share it: [publishing](05-publishing.md).
