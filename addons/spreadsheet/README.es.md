# 📊 Hoja de cálculo

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Crea y edita hojas de cálculo dentro de Offlined, con fórmulas, formato y varias hojas por archivo — sin
conexión a internet.

## Qué hace

- **Barra lateral** como la del chat de Offlined: fijados, **carpetas** (arrastrar y soltar, plegables), el resto
  agrupado por fecha, buscador, orden por recientes o A–Z y un menú «…» en cada fila (renombrar, fijar, mover, duplicar, exportar la primera hoja a CSV, borrar). Se pliega en una
  barra de iconos y en pantallas pequeñas se abre encima del editor. Fijados y carpetas se guardan por usuario.
- El editor es [Univer](https://github.com/dream-num/univer) (Apache-2.0): fórmulas, formatos de número, estilos
  de celda, varias hojas, copiar y pegar desde otros programas.
- La primera vez que lo abres, Offlined ofrece bajar el editor Univer una sola vez (~50 MB). Después funciona
  totalmente sin conexión.
- Pregunta antes de descartar cambios sin guardar.
- En los 10 idiomas de Offlined.

## Dónde están tus archivos

En tu carpeta de datos de Offlined, gestionados por el propio Offlined — no dentro del addon. Desinstalar o
actualizar el addon nunca borra tus hojas.

## Requisitos

Offlined 3.0 o posterior. Usa el servicio de hojas de cálculo de Offlined (`/api/addon-spreadsheet/*`) y el
editor Univer que Offlined descarga (`/api/univer/*`). También lee `/api/users/session` (solo el id del usuario activo) para guardar aparte los fijados y carpetas
de cada usuario, en el almacenamiento del propio addon.
