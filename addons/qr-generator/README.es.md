# 🔳 Generador de QR

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Crea códigos QR dentro de Offlined, sin conexión, sin registro y sin seguimiento. Son **estáticos**: lo que
escribes va dentro del propio código, así que nunca caducan ni dependen de ningún servidor.

## Qué hace

- **10 tipos de QR**: Texto, Enlace, Wi‑Fi (el móvil se conecta sin escribir la contraseña), Contacto (vCard),
  Correo, Teléfono, SMS, WhatsApp, Ubicación (`geo:`) y Evento de calendario.
- **Diseño**: 6 estilos rápidos, color de los puntos y del fondo, degradado (diagonal, vertical, horizontal o
  radial), fondo transparente, color propio para las esquinas, 5 formas de punto (cuadrados, redondeados, puntos,
  finos, rombos) y 4 de esquina (cuadradas, redondeadas, círculo, hoja).
- **Logo en el centro**: eliges una imagen, su tamaño, fondo detrás y recorte en círculo. Con logo se usa siempre
  la corrección de errores máxima (H) para que se siga leyendo.
- **Texto debajo** («Escanéame»), margen y nivel de corrección de errores (L, M, Q, H).
- **Avisos**: poco contraste, colores invertidos, contenido demasiado largo y tamaño mínimo de impresión.
- **Exportar**: PNG (256 a 2048 px) o SVG a *Offlined Exports*, copiar la imagen al portapapeles, e **imprimir**
  uno grande, una hoja de 12 etiquetas o una de 35 pequeños (A4).
- **Mis QR**: cada QR se guarda solo en cuanto tiene contenido; buscar, duplicar, renombrar y eliminar.
- Tema claro y oscuro como Offlined y los 10 idiomas de Offlined.

## Cómo funciona

El codificador QR es propio (ISO/IEC 18004: modos numérico, alfanumérico y bytes UTF-8, versiones 1–40, niveles
L/M/Q/H, elección automática de máscara), sin librerías externas. Se ha comprobado decodificando cientos de códigos
con un lector independiente.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/qr-generator/data/storage.json`): los QR y los
ajustes **de cada usuario de Offlined**. Al actualizar el addon se conservan; al desinstalarlo se borran. Las
imágenes exportadas van a `Offlined Data/Exports`.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon usa:

- `/api/users/session` y `/api/users/<id>/avatar`: solo para saber qué usuario de Offlined lo usa, su nombre y su
  avatar.
- `POST /api/exports/save-file`: para guardar el PNG o SVG que pides en *Offlined Exports*.

Nada más, y nada de internet.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC). «QR Code» es una marca registrada de DENSO WAVE INCORPORATED.
