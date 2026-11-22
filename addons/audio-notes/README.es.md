# 🎙️ Notas de audio

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Graba, limpia y escucha notas de voz dentro de Offlined — totalmente sin conexión.

## Qué hace

- Graba desde el micrófono con un visualizador en directo.
- Limpieza opcional al grabar: **normalizar volumen**, **reducción de ruido** y **filtro paso alto**.
- **Barra lateral** como la del chat de Offlined: fijados, **carpetas** (arrastrar y soltar, plegables), el resto
  agrupado por fecha, buscador, orden por recientes o A–Z y un menú «…» en cada fila (renombrar, fijar, mover, adjuntar a un evento del calendario, exportar a MP3, borrar; cada fila muestra la
  duración y un botón para reproducir). Se pliega en una
  barra de iconos y en pantallas pequeñas se abre encima del editor. Fijados y carpetas se guardan por usuario.
- En los 10 idiomas de Offlined.

## Dónde están tus grabaciones

En tu carpeta de datos de Offlined (`Addons/Addons - audio-notes/`). Desinstalar o actualizar el addon nunca las
borra.

## Requisitos

Offlined 3.0 o posterior. Usa el servicio de notas de audio de Offlined (`/api/addon-audio-notes/*`,
`/api/audio/rename`). También lee `/api/users/session` (solo el id del usuario activo) para guardar aparte los fijados y carpetas
de cada usuario, en el almacenamiento del propio addon. El micrófono solo se usa mientras grabas.
