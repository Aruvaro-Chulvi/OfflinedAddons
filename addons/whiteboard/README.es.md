# ✏️ Pizarra

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Dibuja libremente en una pizarra infinita dentro de Offlined — bocetos, esquemas, escritura a mano — totalmente
sin conexión.

## Qué hace

- La pizarra es [Excalidraw](https://github.com/excalidraw/excalidraw) (MIT, incluido en Offlined): formas,
  flechas, mano alzada, texto, imágenes, zoom y desplazamiento.
- **Barra lateral** como la del chat de Offlined: fijados, **carpetas** (arrastrar y soltar, plegables), el resto
  agrupado por fecha, buscador, orden por recientes o A–Z y un menú «…» en cada fila (renombrar, fijar, mover, duplicar, descargar la imagen o el archivo .excalidraw, borrar). Se pliega en una
  barra de iconos y en pantallas pequeñas se abre encima del editor. Fijados y carpetas se guardan por usuario.
- Pregunta antes de borrar o sobrescribir un dibujo.
- Sigue el tema claro u oscuro de Offlined.
- En los 10 idiomas de Offlined.

## Dónde están tus dibujos

En tu carpeta de datos de Offlined (`Office/whiteboard-json/`). Desinstalar o actualizar el addon nunca los borra.

## Requisitos

Offlined 3.0 o posterior. Usa el servicio de pizarra de Offlined (`/api/addon-whiteboard/*`) y su copia de
Excalidraw en `/vendor/`. También lee `/api/users/session` (solo el id del usuario activo) para guardar aparte los fijados y carpetas
de cada usuario, en el almacenamiento del propio addon. Con la próxima versión de Offlined, al pasar el ratón por un dibujo de la barra se ve su imagen.
