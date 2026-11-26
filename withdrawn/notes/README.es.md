# 🗒️ Documento de texto (Notas)

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Escribe y organiza documentos con formato dentro de Offlined — totalmente sin conexión.

## Qué hace

- Texto con formato con [Quill](https://quilljs.com) (BSD-3-Clause, incluido en Offlined): títulos, negrita,
  listas, enlaces, colores.
- **Barra lateral** como la del chat de Offlined: fijados, **carpetas** (arrastrar y soltar, plegables), el resto
  agrupado por fecha, buscador, orden por recientes o A–Z y un menú «…» en cada fila (renombrar, fijar, mover, duplicar, leer en voz alta, situar en el mapa, exportar a .txt o .html, borrar). Se pliega en una
  barra de iconos y en pantallas pequeñas se abre encima del editor. Fijados y carpetas se guardan por usuario.
- **Leer en voz alta** un documento con las voces del ordenador.
- **Etiquetar un lugar**: une un documento a una ubicación y encuéntralo luego en los mapas de Offlined.
- Pregunta antes de descartar cambios sin guardar.
- En los 10 idiomas de Offlined.

## Dónde están tus documentos

En tu carpeta de datos de Offlined (`Addons/Addons - notes/`), un archivo JSON por documento. Desinstalar o
actualizar el addon nunca los borra.

## Requisitos

Offlined 3.0 o posterior. Usa el servicio de notas de Offlined (`/api/addon-notes/*`) y su copia de Quill en
`/vendor/`. También lee `/api/users/session` (solo el id del usuario activo) para guardar aparte los fijados y carpetas
de cada usuario, en el almacenamiento del propio addon. Con la próxima versión de Offlined la barra muestra además la fecha y las primeras palabras de cada documento.
