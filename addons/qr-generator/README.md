# 🔳 QR Generator

*[Leer en español](README.es.md)* · **Official Offlined addon** · MIT

Make QR codes inside Offlined, offline, with no sign-up and no tracking. They are **static**: what you type goes
inside the code itself, so they never expire and depend on no server.

## What it does

- **10 kinds of QR code**: Text, Link, Wi‑Fi (the phone joins without typing the password), Contact (vCard),
  Email, Phone, SMS, WhatsApp, Location (`geo:`) and Calendar event.
- **Design**: 6 quick styles, dot and background colours, gradient (diagonal, vertical, horizontal or radial),
  transparent background, own colour for the corners, 5 dot shapes (square, rounded, dots, fine, diamonds) and 4
  corner shapes (square, rounded, circle, leaf).
- **Logo in the centre**: pick an image, its size, a background behind it and a circular crop. With a logo the
  maximum error correction (H) is always used so it still scans.
- **Caption** below («Scan me»), margin and error-correction level (L, M, Q, H).
- **Warnings**: low contrast, inverted colours, too much content and minimum print size.
- **Export**: PNG (256 to 2048 px) or SVG to *Offlined Exports*, copy the image to the clipboard, and **print** one
  large, a sheet of 12 labels or a sheet of 35 small ones (A4).
- **My QR codes**: each code saves itself as soon as it has content; search, duplicate, rename and delete.
- Light and dark theme like Offlined, and Offlined's 10 languages.

## How it works

The QR encoder is the addon's own (ISO/IEC 18004: numeric, alphanumeric and UTF-8 byte modes, versions 1–40,
levels L/M/Q/H, automatic mask choice), with no external libraries. It was checked by decoding hundreds of codes
with an independent reader.

## Where your data is kept

In the addon's own store (`Offlined Data/Addons/installed/qr-generator/data/storage.json`): the QR codes and
settings **of each Offlined user**. Updating the addon keeps them; uninstalling deletes them. Exported images go
to `Offlined Data/Exports`.

## Requirements and Offlined API

Offlined 3.0 or later. The addon uses:

- `/api/users/session` and `/api/users/<id>/avatar`: only to know which Offlined user is using it, their name and
  avatar.
- `POST /api/exports/save-file`: to save the PNG or SVG you ask for in *Offlined Exports*.

Nothing else, and nothing from the internet.

## Licence

MIT. Icons from [Lucide](https://lucide.dev) (ISC). "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
