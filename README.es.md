# Offlined Addons

*[Read in English](README.md)*

**Addons para [Offlined](https://www.offlined.org): herramientas nuevas para la biblioteca y el espacio de trabajo sin conexión, hechas por la
comunidad, revisadas y firmadas antes de llegar al ordenador de nadie.**

[![Check addons](https://github.com/Aruvaro-Chulvi/OfflinedAddons/actions/workflows/check.yml/badge.svg)](https://github.com/Aruvaro-Chulvi/OfflinedAddons/actions/workflows/check.yml)
[![Último catálogo](https://img.shields.io/github/v/release/Aruvaro-Chulvi/OfflinedAddons?label=cat%C3%A1logo)](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/latest)
[![SDK](https://img.shields.io/badge/docs-Addon%20SDK-5649ff)](docs/sdk/es/README.md)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-informational)](LICENSE)

Offlined guarda Wikipedia, mapas, tus archivos, correo, calendario y una IA local en tu propio ordenador, sin
necesidad de internet. Un **addon** le añade una herramienta más: una pequeña página web que Offlined abre en su
menú **Addons**. Todos los addons de este repositorio se pueden instalar desde dentro de Offlined con un clic, en
**Addons → Gestionar addons → Addons disponibles**.

## Addons disponibles

| | Addon | Qué hace | |
|---|---|---|---|
| 📊 | **[Hoja de cálculo](addons/spreadsheet/)** | Hojas de cálculo con fórmulas, formato y varias hojas, con tecnología de Univer. | Oficial |
| 🗒️ | **[Documento de texto](addons/notes/)** | Documentos de texto enriquecido con búsqueda, lectura en voz alta y lugares en el mapa. | Oficial |
| ✏️ | **[Pizarra](addons/whiteboard/)** | Una pizarra infinita para bocetos y diagramas, con tecnología de Excalidraw. | Oficial |
| 🎙️ | **[Notas de audio](addons/audio-notes/)** | Notas de voz con reducción de ruido, reproductor, exportación a MP3 y enlaces al calendario. | Oficial |
| 🔢 | **[Sudoku](addons/sudoku/)** | Sudoku clásico con ocho niveles, de muy fácil a mortal, y su propio generador de tableros. | Oficial |
| ♟️ | **[Ajedrez](addons/chess/)** | Ajedrez contra el ordenador: cuatro niveles, reloj opcional, pistas y motor propio. | Oficial |

La lista completa y actualizada está en [`catalog.json`](catalog.json); los paquetes firmados están en la
[última versión publicada](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases/latest).

## Crea el tuyo

Si sabes escribir una página web, sabes escribir un addon: sin paso de compilación, sin framework, sin código de servidor.

1. Lee el **[SDK de addons](docs/sdk/es/README.md)**: diez minutos hasta tu primer addon.
2. Copia [`templates/hello-world`](templates/hello-world/) a `addons/<tu-id>/`.
3. Pruébalo en Offlined: `python tools/package.py addons/<tu-id>` y luego instala el `.zip`.
4. Abre una pull request. Consulta **[CONTRIBUTING.es.md](CONTRIBUTING.es.md)**.

## Cómo llega un addon a Offlined

```
pull request ──► comprobación automática ──► revisión del mantenedor ──► merge ──► versión firmada ──► Offlined
```

- **Comprobación automática**: [`tools/validate.py`](tools/validate.py) se ejecuta en cada pull request: el
  manifiesto, los archivos, que no use internet, el aumento de versión y una lista de los datos de Offlined que
  usa el addon. También construye un paquete de prueba para que lo pruebes.
- **Revisión**: una persona lee el código y prueba el addon ([guía de revisión](docs/REVIEW.es.md)). Solo el
  mantenedor puede hacer el merge.
- **Firma**: los addons aprobados se empaquetan y se firman con la clave de Offlined, sin conexión, en el
  ordenador del mantenedor. Offlined instala los addons firmados sin avisos y rechaza cualquier paquete que se
  haya modificado después de firmarlo.
- **Catálogo**: cada versión publicada incluye todos los addons aprobados y `catalog.json`. Offlined lee la más reciente.

Los addons que no están en el catálogo se pueden compartir igualmente como archivos `.zip`; Offlined los instala
tras mostrar un aviso y los marca como «No verificado».

## Qué hay aquí

| | |
|---|---|
| [`addons/`](addons/) | Una carpeta por cada addon aprobado: `addon.json`, `frontend/`, `README.md`. |
| [`docs/sdk/`](docs/sdk/es/README.md) | El SDK de addons: manifiesto, panel, almacenamiento y API, publicación, seguridad. |
| [`templates/`](templates/) | Puntos de partida para addons nuevos. |
| [`tools/`](tools/) | `validate.py` (la comprobación), `package.py` (paquetes de prueba), `publish.py` (versión firmada, solo para el mantenedor). |
| [`catalog.json`](catalog.json) | El catálogo de la última versión publicada ([formato](docs/catalog-format.md)). |

## Licencia

Las herramientas, la documentación y la plantilla están bajo la [licencia MIT](LICENSE). Cada addon tiene su propia
licencia abierta, indicada en su `addon.json` (los oficiales son MIT). `catalog.json` es CC0.

Offlined, y el nombre y el logotipo de Offlined, pertenecen a Álvaro C. Chulvi. Este repositorio forma parte del proyecto
Offlined; mira también [WikiClassroom](https://github.com/Aruvaro-Chulvi/WikiClassroom),
[WikiTrees](https://github.com/Aruvaro-Chulvi/WikiTrees),
[Offlined Landmarks 3D](https://github.com/Aruvaro-Chulvi/OfflinedLandmarks3D) y
[Offlined Sea 3D Models](https://github.com/Aruvaro-Chulvi/OfflinedSea3DModels).
