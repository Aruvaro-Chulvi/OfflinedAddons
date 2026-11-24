# 3. El panel

*[Read in English](../03-panel.md)* · [Índice del SDK](README.md)

## Cómo lo carga Offlined

Cuando el usuario abre tu addon, Offlined carga

```
/addon-panels/<id>/frontend/panel.html?theme=dark&lang=es
```

dentro de un `<iframe>` aislado (`allow-scripts allow-same-origin allow-forms allow-popups allow-modals
allow-pointer-lock`; el bloqueo del puntero, desde Offlined 4) que
ocupa la ventana de Offlined bajo una pequeña barra de título con tu icono, nombre, versión y autor.

- Todos los archivos de tu carpeta `frontend/` se sirven del mismo modo: `frontend/style.css` es
  `/addon-panels/<id>/frontend/style.css`. Usa **rutas relativas** (`<link href="style.css">`) y funcionará sin más.
- `?theme=` es `light` o `dark`, y `?lang=` uno de los diez idiomas de Offlined; ambos tal como estaban cuando se
  abrió el panel.
- No hay nada antes ni después: ni gancho de instalación ni proceso en segundo plano. El `<script>` de tu propia página es
  toda la vida de tu addon, desde el momento en que el usuario lo abre hasta que sale de él.

## Cuando el usuario sale

Desde Offlined 4, **tu página se cierra cuando el usuario va a otra sección** de Offlined, y se carga otra vez desde
cero cuando vuelve (Offlined 3 la dejaba cargada y oculta, con su sonido). Por eso:

- **Guarda sobre la marcha**, en tu [almacén](04-storage-and-api.md), no solo cuando el usuario pulse un botón: lo
  que solo esté en memoria se pierde al salir.
- Si hay algo que **no se puede guardar** y se perdería (una partida en curso, una grabación), díselo a Offlined
  mientras dure, y Offlined preguntará al usuario antes de cerrar tu panel
  ([`oflAddonBusy`](04-storage-and-api.md#algo-en-curso-ofladdonbusy)).
- Cuando el usuario minimiza Offlined, tu página sigue abierta pero oculta (`document.hidden`): pausa tu juego y tu
  sonido.

## Tu página va por su cuenta

Tu panel es un documento aparte, no forma parte de la página de Offlined:

- **Sin JavaScript compartido.** Las funciones y variables de Offlined no son visibles para ti, y las tuyas no son
  visibles para Offlined.
- **Sin CSS compartido.** Los colores y estilos de Offlined no llegan al interior de tu iframe. Define los tuyos (más abajo).
- **Sin librerías gratis.** Carga lo que uses: desde tu carpeta o desde el `/vendor/` de Offlined (más abajo).
- **Mismo origen.** `fetch("/api/…")` llega al propio servidor de Offlined, igual que lo hace la página de Offlined.
- **Sin internet.** La Content Security Policy de Offlined solo permite archivos del propio Offlined (más URLs `data:` y
  `blob:`). Un script, una fuente o una petición a otro servidor la bloquea el navegador.

## Tema claro y oscuro

Usa los mismos nombres de color y valores que Offlined y tu addon se verá nativo:

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

Aplica el tema al cargar y sigue al usuario cuando lo cambie mientras tu addon está abierto:

```js
const params = new URLSearchParams(location.search);
const theme = params.get("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = theme;

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;   // solo de Offlined
  if (e.data?.type === "theme") document.documentElement.dataset.theme = e.data.value;
});
```

### El aspecto de Offlined

- Los botones son planos: un borde fino, sin sombra. El botón principal es gris, no de color: `var(--soft)` con borde
  `var(--accent-line)`. Marca el estado seleccionado o activo del mismo modo: un cambio de color, nunca una sombra ni
  relieve.
- Deja el color para tu contenido (un tablero, un gráfico), no para los botones y paneles de alrededor.
- Esquinas redondeadas de 8–14 px, espaciado generoso, fuente del sistema.
- Iconos: emoji, o SVG de [Lucide](https://lucide.dev) (ISC) dentro de tu carpeta.

## Idioma

Lee `?lang=` y elige tus textos de un pequeño diccionario. Usa el inglés como alternativa:

```js
const T = {
  en: { hello: "Hello", save: "Save" },
  es: { hello: "Hola", save: "Guardar" },
};
const lang = new URLSearchParams(location.search).get("lang") || "en";
const t = (key) => (T[lang] && T[lang][key]) || T.en[key];
document.getElementById("save").textContent = t("save");
```

Para el árabe, define `document.documentElement.dir = "rtl"` cuando `lang === "ar"`. No hay ningún mensaje cuando el usuario
cambia el idioma mientras tu addon está abierto: verá el nuevo idioma la próxima vez que lo abra.

## Sonido

Si tu addon reproduce sonido o música:

- **Respeta el silencio general de Offlined.** Cuando el usuario pulsa el botón de silencio que hay junto a las banderas
  de idioma, Offlined envía `{ type: "ofl:mute", on: true }` a tu panel (y lo repite cada segundo mientras siga
  puesto); `on: false` cuando se quita. Offlined silencia él mismo los elementos `<audio>` y `<video>`, pero el sonido
  hecho con Web Audio lo tienes que callar tú.
- **Calla cuando no se te ve:** suspende tu `AudioContext` mientras `document.hidden`.
- Empieza el audio tras el primer clic o tecla del usuario (regla del navegador), y dale un interruptor o un volumen.

```js
let ctx = null, master = null, oflMuted = false;   // master: un GainNode justo antes de ctx.destination
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

`ofl:mute` es nuevo en Offlined 4; las versiones anteriores nunca lo envían, y tu código simplemente no lo recibe.

## Librerías

Pon cualquier librería dentro de tu carpeta `frontend/` y cárgala con una ruta relativa:

```html
<script src="lib/chart.umd.min.js"></script>
```

Guarda su archivo de licencia al lado e indica en tu README qué librerías incluyes. Solo se aceptan librerías con una licencia
compatible con la tuya y que permita el uso comercial.

También puedes usar las copias que el propio Offlined incluye, desde rutas absolutas bajo `/vendor/`:

```html
<link rel="stylesheet" href="/vendor/quill/quill.snow.css">
<script src="/vendor/quill/quill.min.js"></script>
```

Esto ahorra espacio, pero es una comodidad, no una promesa: Offlined puede actualizar o eliminar una librería en una versión
futura. Si tu addon depende de una, define `min_offlined` y pruébalo con cada nuevo Offlined.

## Archivos y tamaños

- Permitidos: archivos web (`.html`, `.css`, `.js`, `.mjs`, `.json`), imágenes, fuentes, audio y vídeo, `.wasm`, y archivos de
  texto y de datos. No permitidos: programas y scripts del sistema (`.exe`, `.dll`, `.bat`, `.ps1`, `.py`, `.sh`…),
  archivos comprimidos y archivos ocultos.
- Hasta **25 MB** por archivo y **50 MB** por addon. Cuanto menos, mejor: cada byte lo descarga todo el que lo
  instala.
- **Las descargas están bloqueadas** dentro del panel (el aislamiento no tiene `allow-downloads`). Para darle un archivo
  al usuario, guárdalo en su carpeta *Exportaciones*: [guardar un archivo para el usuario](04-storage-and-api.md#guardar-un-archivo-para-el-usuario).
