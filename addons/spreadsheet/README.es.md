# 📊 Hoja de cálculo

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Crea y edita hojas de cálculo dentro de Offlined, con fórmulas, formato y varias hojas por archivo — sin
conexión a internet.

## Qué hace

- **Barra lateral** como la del chat de Offlined: fijados, **carpetas** (arrastrar y soltar, plegables), el resto
  agrupado por fecha, buscador, orden por recientes o A–Z y un menú «…» en cada fila (renombrar, fijar, mover, duplicar, exportar, borrar). Se pliega en una
  barra de iconos y en pantallas pequeñas se abre encima del editor. Fijados y carpetas se guardan por usuario.
- El editor es [Univer](https://github.com/dream-num/univer) (Apache-2.0): fórmulas, formatos de número, estilos
  de celda, varias hojas, copiar y pegar desde otros programas.
- Con Offlined 4.0 el editor tiene además **filtros**, **ordenar**, **formato condicional** (escalas de color,
  barras de datos, iconos…), **validación de datos** con listas desplegables, **buscar y reemplazar**, **enlaces** en
  celdas, **imágenes**, **notas** en celdas, **tablas**, editor de celda a pantalla completa y resaltado de fila y
  columna: todos plugins libres de Univer, que se guardan con la hoja. Los menús de Univer salen en español,
  francés, ruso y chino además de inglés. Si Univer se bajó con un Offlined anterior, una barra ofrece bajar solo
  lo nuevo (≈2 MB).
- **Importar** con el botón Importar o soltando archivos (varios a la vez): Excel **.xlsx/.xlsm**, LibreOffice
  **.ods** y **.csv/.tsv** (separador y codificación automáticos; el texto que empieza por `=` sigue siendo texto).
  Se conservan valores, fórmulas (también entre hojas), fechas, fuentes, colores, bordes, alineación, formatos de
  número, celdas combinadas, anchos, altos, filas/columnas ocultas, paneles inmovilizados, color de pestaña, notas,
  enlaces y listas desplegables. No se importan gráficos, imágenes, formato condicional ni macros (se avisa). Los
  `.xls` antiguos: guárdalos antes como .xlsx u .ods.
- **Exportar** con el botón Exportar o el menú «…»: Excel **.xlsx**, LibreOffice **.ods** (fórmulas traducidas a
  OpenFormula), **PDF** (con el diálogo de impresión: «Guardar como PDF»), **CSV** de la hoja actual (con `;` y coma
  decimal en los idiomas que los usan) y página web **.html**. El .xlsx y el .ods conservan valores, fórmulas, estilos,
  formatos de número, combinadas, tamaños, ocultas, paneles inmovilizados, color de pestaña, notas, enlaces, listas
  desplegables y autofiltro. Los archivos van a *Offlined Exports* (Media).
- La primera vez que lo abres, Offlined ofrece bajar el editor Univer una sola vez (~50 MB). Después funciona
  totalmente sin conexión.
- Pregunta antes de descartar cambios sin guardar.
- En los 10 idiomas de Offlined.

## Dónde están tus archivos

En tu carpeta de datos de Offlined, gestionados por el propio Offlined — no dentro del addon. Desinstalar o
actualizar el addon nunca borra tus hojas.

## Requisitos

Offlined 3.0 o posterior. Usa el servicio de hojas de cálculo de Offlined (`/api/addon-spreadsheet/*`) y el
editor Univer que Offlined descarga (`/api/univer/*`; `?missing=1` baja solo los plugins nuevos). También lee `/api/users/session` (solo el id del usuario activo) para guardar aparte los fijados y carpetas
de cada usuario, en el almacenamiento del propio addon.

## Código de terceros

`frontend/vendor/exceljs.min.js` es [ExcelJS](https://github.com/exceljs/exceljs) (MIT) y `frontend/vendor/fflate.min.js`
es [fflate](https://github.com/101arrowz/fflate) (MIT); solo se cargan al importar o exportar. Sus avisos, y los de las
dependencias de ExcelJS (todas permisivas), están en `frontend/vendor/THIRD_PARTY_LICENSES.txt`.
