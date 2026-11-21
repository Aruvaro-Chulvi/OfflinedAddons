# 7. Roadmap

*[Leer en español](es/07-roadmap.md)* · [SDK index](README.md)

Nothing on this page exists yet. It is here so you know where addons are going — and so you do not write code
against it today. Ideas and votes are welcome in the
[issues](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues).

| Planned | What it would bring |
|---|---|
| **Permissions** | The `permissions` field would really limit what an addon can call, and Offlined would ask the user before installing («this addon wants to read your contacts»). |
| **A stable `offlined` API** | A small, versioned JavaScript library for addons — storage, files, the local AI, Wikipedia, maps, calendar — instead of Offlined's internal endpoints. |
| **Files of your own** | A folder per addon for files (not only one JSON object), that survives uninstalling if the user wants. |
| **Local AI** | Asking the local language model for text, with the user's consent. |
| **More places** | Addons that add a card to Home, a button to a section or a page to Settings, not only a panel in the Addons menu. |
| **Events** | Being told when something changes in Offlined (a new event in the calendar, a file added…). |
| **Automatic updates** | Offlined telling the user when an installed catalogue addon has a new version. |
