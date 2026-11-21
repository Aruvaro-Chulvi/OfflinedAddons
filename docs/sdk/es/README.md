# SDK de addons de Offlined

*[Read in English](../README.md)*

Un **addon** añade una herramienta nueva a [Offlined](https://www.offlined.org), la biblioteca y espacio de trabajo sin conexión. Es una
pequeña página web (HTML, CSS y JavaScript) que Offlined abre dentro de su propia ventana, en el menú **Addons**,
junto a su hoja de cálculo, documentos de texto, pizarra y notas de audio (que son addons también; su código fuente
está en [`addons/`](../../../addons/)).

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
