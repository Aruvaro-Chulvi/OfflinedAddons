# 4. Almacenamiento y API de Offlined

*[Read in English](../04-storage-and-api.md)* · [Índice del SDK](README.md)

## Guardar los datos de tu addon

Cada addon tiene un sitio propio donde guardar un objeto JSON:

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
| `GET /api/addons/<id>/storage` | `{"data": {...}}`, un objeto vacío si no se guardó nada. |
| `POST /api/addons/<id>/storage` | Cuerpo `{"data": {...}}`. Sustituye el objeto entero. |

Se guarda en `Offlined Data/Addons/installed/<id>/data/storage.json`, dentro de los datos de Offlined del usuario.

- **Las actualizaciones lo conservan.** Cuando el usuario instala una versión más reciente de tu addon, la carpeta `data/` se mantiene.
- **Desinstalar lo borra.** Quitar el addon elimina su carpeta, datos incluidos.
- Que sea razonable: es un solo archivo, que se lee y se escribe entero. Para unos cientos de kilobytes es perfecto; para
  muchos megabytes, replantéate lo que necesitas guardar.
- Escribe una `version` dentro de tu objeto si su forma puede cambiar, para que una versión futura de tu addon pueda convertir
  los datos antiguos.

`localStorage` e `IndexedDB` también funcionan dentro de tu panel, pero viven en el perfil del motor del navegador, no
en la carpeta de datos de Offlined del usuario: puede que no viajen con ella cuando el usuario mueva Offlined a otro ordenador
o a una unidad USB, y no están separados por usuario de Offlined. Úsalos solo para preferencias pequeñas que puedas perder.

## Llamar a Offlined

Tu panel comparte origen con el servidor de Offlined, así que puede llamar a los endpoints `/api/…` de Offlined con un
simple `fetch()`:

```js
const status = await fetch("/api/status").then((r) => r.json());
```

Lee esto antes de fiarte de ello:

- Son **endpoints internos de Offlined, no una API pública con versiones.** Pueden cambiar entre versiones. Define
  `min_offlined`, prefiere las llamadas de solo lectura y prueba tu addon con cada nuevo Offlined.
- **Todo lo que llames se revisa.** La comprobación automática lista cada endpoint con datos personales que use tu addon
  (correo, contactos, calendario, la Caja fuerte, fotos, chats…), y el mantenedor comprueba que tu addon realmente lo
  necesita. Explica el porqué en tu README.
- Los endpoints que descargan de internet los bloquean el control parental de Offlined y su «modo sin conexión
  total»; tu addon debe saber manejarlo.

## Hablar con Offlined: mensajes

Tu panel puede pedirle a Offlined que haga algunas cosas con `postMessage`:

```js
window.parent.postMessage({ action: "setMode", mode: "calendar" }, "*");
```

| Mensaje | Qué hace Offlined |
|---|---|
| `{ action: "setMode", mode }` | Va a otra sección, p. ej. `"home"`, `"calendar"`, `"maps"`, `"library"`. |
| `{ action: "openLibrary", path }` | Abre *Archivos de Offlined* en esa carpeta. |
| `{ action: "openImage", rel }` | Abre una imagen de la galería del usuario en el visor de imágenes. |
| `{ action: "openGeoPicker", kind, ref, title? }` | Abre el selector que vincula algo tuyo con un lugar del mapa. |
| `{ action: "speakText", text }` | Lee un texto en voz alta con las voces del ordenador (hasta 4.000 caracteres). |
| `{ action: "requestFullscreen" }` | Muestra tu panel a pantalla completa. |
| `{ action: "exitFullscreen" }` | Sale de la pantalla completa. |

Y Offlined te envía a ti:

| Mensaje | Cuándo |
|---|---|
| `{ type: "theme", value: "light" \| "dark" }` | El usuario cambia el tema mientras tu addon está abierto. |

Es un conjunto pequeño y fijo. No puedes añadir mensajes propios; si tu addon necesita algo de Offlined que no
está aquí, [abre un issue](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new/choose) y explícalo.
