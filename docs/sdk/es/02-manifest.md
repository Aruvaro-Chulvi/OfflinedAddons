# 2. El manifiesto: `addon.json`

*[Read in English](../02-manifest.md)* · [Índice del SDK](README.md)

Todo addon tiene un `addon.json` en la raíz de su carpeta: UTF-8, sin BOM. Este es el manifiesto real del
addon Pizarra (abreviado):

```json
{
  "id": "whiteboard",
  "name": "Whiteboard",
  "version": "1.0.0",
  "author": "Álvaro C. Chulvi",
  "description": "Draw freely with a full-featured whiteboard — save, rename and reopen your drawings, fully offline.",
  "icon": "✏️",
  "license": "MIT",
  "category": "office",
  "min_offlined": "3.0.0",
  "permissions": [],
  "name_i18n": { "en": "Whiteboard", "es": "Pizarra", "fr": "Tableau blanc" },
  "description_i18n": { "en": "Draw freely…", "es": "Dibuja libremente…" }
}
```

## Campos obligatorios

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | texto | De 2 a 40 caracteres: letras minúsculas, dígitos y guiones. **Igual que el nombre de la carpeta.** Se convierte en la carpeta de instalación y en la dirección de tu panel (`/addon-panels/<id>/…`), y no puede cambiar nunca una vez publicado. |
| `name` | texto | Hasta 40 caracteres. Se muestra cuando el idioma del usuario no está en `name_i18n`. |
| `version` | texto | `MAJOR.MINOR.PATCH`, p. ej. `1.0.0`. Súbela con cada cambio que publiques: `1.0.1` para una corrección, `1.1.0` para algo nuevo, `2.0.0` cuando rompes algo (por ejemplo, los datos guardados anteriormente). |
| `author` | texto | Tu nombre o apodo, tal como quieres que se muestre en Offlined y en el catálogo. |
| `description` | texto | Hasta 300 caracteres, en inglés. Una frase que diga qué hace. |
| `icon` | texto | **Un emoji.** Se muestra en el menú Addons, en la tarjeta de Inicio y en el catálogo. |
| `license` | texto | La licencia del addon (id SPDX): `MIT` (recomendada), `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MPL-2.0`, `Zlib`, `0BSD`, `Unlicense` o `CC0-1.0`. |
| `min_offlined` | texto | La versión más antigua de Offlined con la que funciona tu addon, p. ej. `3.0.0`. Las versiones anteriores de Offlined muestran el addon como «necesita un Offlined más reciente» en lugar de instalarlo. |

## Campos opcionales

| Campo | Tipo | Significado |
|---|---|---|
| `category` | texto | Dónde aparece listado: `office`, `productivity`, `education`, `games`, `media`, `tools`, `lifestyle` o `reference`. Por defecto `tools`. |
| `name_i18n` | objeto | El nombre en los idiomas de Offlined: `en`, `es`, `fr`, `pt`, `it`, `de`, `zh`, `hi`, `ar`, `ru`. Los idiomas que falten usan `name`. Muy recomendable. |
| `description_i18n` | objeto | La descripción en los mismos idiomas; los que falten usan `description`. |
| `image` | texto | Una imagen para usar como icono en lugar del emoji: un archivo dentro de `frontend/` (PNG o WebP cuadrado, 128×128). |
| `homepage` | texto | Una página `https://` sobre tu addon. |
| `author_url` | texto | Una página `https://` sobre ti (tu perfil de GitHub, por ejemplo). |
| `permissions` | lista | Reservado para el futuro [sistema de permisos](07-roadmap.md). Hoy no se lee: escribe `[]`. |

## Campos que no debes escribir

`_dir`, `signed`, `_has_panel` y `_has_image` los escribe el propio Offlined cuando instala o lista un
addon. `enabled` es el interruptor de activado/desactivado del usuario: puedes omitirlo.

## Idiomas

Offlined habla diez idiomas. Tu addon no tiene por qué: pero si traduces al menos el nombre y la
descripción, el addon aparece en el idioma del usuario. Si no estás seguro de una traducción, deja ese
idioma sin poner en lugar de adivinar: un revisor u otro colaborador podrá añadirlo más tarde.

Los textos *dentro* de tu panel dependen de ti: mira [los idiomas en el panel](03-panel.md#idioma).
