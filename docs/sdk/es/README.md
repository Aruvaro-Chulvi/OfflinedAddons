# SDK de addons de Offlined

*[Read in English](../README.md)*

Un **addon** añade una herramienta nueva a [Offlined](https://www.offlined.org), la biblioteca y espacio de trabajo sin conexión. Es una
pequeña página web (HTML, CSS y JavaScript) que Offlined abre dentro de su propia ventana, desde el menú **Addons**.
Los addons oficiales (Sudoku, Ajedrez, Escoba, el generador de QR…) están en [`addons/`](../../../addons/): ejemplos
reales que puedes leer y copiar. Hasta Offlined 3 las apps de oficina (hoja de cálculo, documentos de texto, pizarra y
notas de audio) también eran addons; desde Offlined 4 vienen incluidas.

Si sabes escribir una página web, sabes escribir un addon. Sin paso de compilación, sin framework, sin código de servidor.

## Contenido

| | |
|---|---|
| [1. Primeros pasos](01-getting-started.md) | Tu primer addon en diez minutos y cómo probarlo en Offlined mientras lo escribes. |
| [2. El manifiesto: `addon.json`](02-manifest.md) | Todos los campos: nombre, versión, icono, licencia, idiomas, categoría. |
| [3. El panel](03-panel.md) | Cómo carga Offlined tu página; tema claro y oscuro; los 10 idiomas; librerías. |
| [4. Almacenamiento y API de Offlined](04-storage-and-api.md) | Guardar los datos de tu addon; llamar a Offlined; hablar con la aplicación con `postMessage`. |
| [5. Publicación](05-publishing.md) | Enviar tu addon a este repositorio: las reglas, la revisión, la firma y el catálogo. |
| [6. Seguridad y privacidad](06-security.md) | Qué hace cumplir Offlined, qué no, y qué buscan los revisores. |
| [7. Hoja de ruta](07-roadmap.md) | Qué está previsto y todavía no está disponible. |

## Novedades de Offlined 4

- **Tu panel se cierra cuando el usuario sale de él** (Offlined 3 lo dejaba cargado y oculto). Guarda sobre la marcha y,
  si salir hiciera perder algo (una partida en curso), pide a Offlined que avise al usuario:
  [cuando el usuario sale](03-panel.md#cuando-el-usuario-sale).
- **Silencio general.** Offlined tiene un botón de silencio junto a las banderas de idioma y se lo dice a tu panel
  (`ofl:mute`). Si tu addon hace sonido, [respétalo](03-panel.md#sonido).
- **El bloqueo del puntero** funciona dentro de los paneles (juegos que capturan el ratón).
- **`speakText` no hace nada** por ahora: Offlined 4 no tiene sección de texto a voz.
- Para darle un archivo al usuario, [guárdalo en su carpeta Exportaciones](04-storage-and-api.md#guardar-un-archivo-para-el-usuario):
  los paneles no pueden iniciar descargas.

Un addon que dependa de algo de esto debe poner `"min_offlined": "4.0.0"`.

## La versión corta

```
addons/my-addon/
├── addon.json          # the manifest: id, name, version, author, licence…
├── README.md           # what it does (shown on GitHub)
└── frontend/
    ├── panel.html      # your addon: the page Offlined opens
    └── …               # any CSS, JS, images or fonts it needs
```

1. Copia [`templates/hello-world`](../../../templates/hello-world/) a `addons/<tu-id>/` y edítalo.
2. Pruébalo: `python tools/package.py addons/<tu-id>` e instala el `.zip` desde **Addons → Gestionar addons**.
3. Abre una pull request. Se ejecuta la comprobación automática, el mantenedor la revisa y, una vez aprobado, se firma
   y aparece en **Addons disponibles** dentro de todos los Offlined.

## Reglas básicas

- **Primero sin conexión.** Un addon debe funcionar sin internet: todo lo que usa viaja dentro de su carpeta (o
  procede de las librerías `/vendor/` del propio Offlined). No se aceptan páginas que carguen scripts, fuentes o datos
  de internet.
- **Respeta los datos de las personas.** Un addon se ejecuta con el mismo acceso que el propio Offlined. Usa solo lo que
  tu addon necesite, no envíes nada a ninguna parte y di en tu README qué datos tocas.
- **Código abierto.** Todos los addons de aquí se publican bajo una licencia abierta (se recomienda MIT), para que
  cualquiera pueda leerlos, revisarlos y mejorarlos.
