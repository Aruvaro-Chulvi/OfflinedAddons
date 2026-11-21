# Guía de revisión

*[Read in English](REVIEW.md)*

Lo que comprueba el mantenedor antes de aprobar un addon. Si contribuyes, léela tú también: una pull request que ya
responde a estas preguntas se aprueba mucho antes.

## 1. La comprobación automática está en verde

[`tools/validate.py`](../tools/validate.py) se ejecuta en cada pull request. Sin errores. Cada advertencia tiene una
respuesta (en el código, en el README o en la pull request).

## 2. Hace lo que dice

- El README explica qué hace el addon, qué datos toca y qué librerías incluye.
- Instala el **paquete de prueba** (página de la comprobación → *Artifacts*) en Offlined y úsalo: tema claro y oscuro,
  al menos inglés y otro idioma, una ventana pequeña y una grande.
- Nada se rompe en Offlined después de cerrarlo.

## 3. Lee cada línea de su propio código

- **Peticiones.** Cada `fetch()`/`XMLHttpRequest`: adónde, por qué, qué envía. La comprobación lista los endpoints
  con datos personales (🔎). Cada uno tiene que ser necesario para lo que el addon hace a la vista del usuario.
- **Escrituras y borrados.** Nada modifica ni borra los datos del usuario a menos que el usuario lo haya pedido en el addon.
- **Nada oculto.** Sin código propio ofuscado o minificado, sin cadenas largas codificadas, sin `eval`/`new Function`
  sobre datos, sin código descargado y ejecutado en tiempo de ejecución, sin trucos con `window.parent`.
- **Sin seguimiento, anuncios, minería de criptomonedas ni «llamadas a casa».**
- **Mensajes a Offlined** (`postMessage`) solo de la lista documentada.

## 4. Librerías y recursos

- Proyectos conocidos, con la versión indicada y sin modificar (o con los cambios explicados).
- Archivos de licencia incluidos; licencias compatibles con la del addon y que permitan el uso comercial (nada de `NC`,
  nada de fuentes o iconos «solo para uso personal»).
- Imágenes, sonidos y fuentes: trabajo propio o con licencia adecuada, citados en el README.
- `.wasm`: se indica su proyecto de origen y su versión.

## 5. Adecuado para Offlined

- Funciona sin ninguna conexión a internet.
- Apto para todas las edades.
- No es un clon de un producto comercial, de un juego ni de una marca; sin marcas de terceros en su nombre o icono.
- Tamaño razonable para lo que hace.
- En una actualización: `version` aumentada; los datos guardados anteriormente siguen abriéndose.

## 6. Aprobar

Aprueba y haz el merge de la pull request. Después, publica (mira [MAINTAINING.es.md](MAINTAINING.es.md)): hasta que
no se publique una versión firmada, el addon no está en el catálogo de Offlined.
