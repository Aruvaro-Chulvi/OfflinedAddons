# Cómo contribuir

*[Read in English](CONTRIBUTING.md)*

Gracias por querer mejorar Offlined. Hay muchas formas de ayudar:

- **Escribir un addon nuevo**: mira más abajo.
- **Mejorar un addon**: corregir un error, añadir una función, traducirlo a otro de los idiomas de Offlined.
- **Sugerir un addon**: [abre una idea](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new?template=addon-idea.yml)
  para que alguien la construya.
- **Informar de un error** en un addon: [abre un informe de error](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues/new?template=bug.yml).
- **Mejorar la documentación del SDK.**

Al contribuir, aceptas seguir el [código de conducta](CODE_OF_CONDUCT.md).

## Enviar un addon nuevo

1. Lee el [SDK de addons](docs/sdk/es/README.md), sobre todo la [publicación](docs/sdk/es/05-publishing.md): las
   reglas son breves y la comprobación automática hace cumplir la mayoría.
2. Haz un **fork** de este repositorio y crea una rama.
3. Copia [`templates/hello-world`](templates/hello-world/) a `addons/<tu-id>/` y construye ahí tu addon.
   Tu carpeta solo puede contener:
   - `addon.json`: el manifiesto ([campos](docs/sdk/es/02-manifest.md)).
   - `frontend/`: `panel.html` y todo lo que cargue.
   - `README.md`: qué hace, **qué datos de Offlined usa y por qué**, qué librerías incluye y sus
     licencias. Opcionalmente `README.es.md`.
   - Opcionalmente `CHANGELOG.md`, `LICENSE` (si no es MIT) y `screenshot.png` (1280×800).
4. Compruébalo y pruébalo en Offlined:

   ```bash
   python tools/validate.py addons/<your-id>
   python tools/package.py addons/<your-id>     # → dist/test/<your-id>-<version>.zip
   ```

5. Abre una pull request y rellena la lista de comprobación. Un addon por pull request, por favor.

## Qué pasa después

- La **comprobación automática** se ejecuta en unos segundos y publica su informe en la página de la pull request
  (*Checks → Summary*). Corrige los errores y vuelve a subir los cambios: la comprobación se ejecuta de nuevo sola.
- Se adjunta un **paquete de prueba** a la comprobación (*Artifacts*), para que tú y quien revise podáis instalar
  exactamente lo que enviaste.
- El **mantenedor revisa** tu addon siguiendo la [guía de revisión](docs/REVIEW.es.md) y puede pedirte cambios.
  Ten paciencia: una persona lee cada línea.
- Cuando se **aprueba**, se hace el merge de la pull request y tu addon entra en la siguiente versión firmada. Desde
  ese momento, todos los Offlined lo muestran en *Addons disponibles*, con tu nombre como autor.

## Cambiar un addon existente

- Sube la `version` en su `addon.json` (`1.0.0` → `1.0.1` para una corrección, `1.1.0` para una función nueva). La
  comprobación rechaza un addon modificado que mantenga la misma versión.
- Conserva a los autores existentes y añádete tú.
- Si los cambios alteran lo que hace el addon, se pide su conformidad al autor original.

## Licencias

- Addons nuevos: una licencia abierta de la lista aceptada (se recomienda `MIT`), indicada en `addon.json`.
- Todo lo que haya dentro de tu addon (librerías, iconos, fuentes, imágenes, sonidos) debe poder redistribuirse y permitir
  el uso comercial. Nada de licencias `NC`, nada de recursos «gratis para uso personal».
- Al enviar una pull request confirmas que tienes derecho a publicar su contenido bajo esas licencias.

## Preguntas

Abre un [issue](https://github.com/Aruvaro-Chulvi/OfflinedAddons/issues): ninguna pregunta es demasiado pequeña.
