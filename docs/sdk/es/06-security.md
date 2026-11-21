# 6. Seguridad y privacidad

*[Read in English](../06-security.md)* · [Índice del SDK](README.md)

Un addon se ejecuta **dentro de Offlined con el mismo acceso que el propio Offlined**. Eso es lo que hace que los addons sean sencillos de
escribir, y por eso el catálogo se revisa. Esta página dice claramente qué protege al usuario y qué no.

## Lo que Offlined hace cumplir

- **Sin internet para los addons.** La Content Security Policy de Offlined solo deja que un panel cargue archivos y haga peticiones
  al propio Offlined (más `data:` y `blob:`). El motor del navegador bloquea las peticiones a otros servidores.
- **Firmas.** Los addons del catálogo van firmados; Offlined rechaza un paquete firmado que se haya modificado y avisa
  antes de instalar uno sin firmar.
- **Página separada.** Tu panel se ejecuta en un iframe aislado: no puede leer ni cambiar la página propia de Offlined.
- **Rutas seguras.** Los paquetes no pueden escribir fuera de su carpeta (el recorrido de rutas se bloquea al instalar), y un
  panel no puede leer archivos fuera de su carpeta `frontend/` a través de `/addon-panels/`.
- **Control parental.** Cuando está activado, no se pueden instalar ni quitar addons.
- Los paquetes están limitados a 200 MB al instalar (50 MB en este repositorio).

## Lo que Offlined (todavía) no hace cumplir

- **No hay sistema de permisos.** El campo `permissions` no se lee. Un panel puede llamar a cualquier endpoint de Offlined:
  correo, contactos, archivos y la Caja fuerte mientras está desbloqueada.
- **No se ejecuta código fuera del panel**, pero mientras el panel está abierto, su JavaScript puede hacer todo lo que la
  propia página de Offlined podría hacer a través de la API.

Por eso, fuera del catálogo, la gente solo debería instalar addons de alguien de confianza, y por eso cada
addon del catálogo lo lee una persona antes de firmarse.

## Qué mira la revisión

- Cada petición que hace el código, y por qué. La comprobación automática lista los endpoints con datos personales.
- Cualquier cosa que oculte lo que hace el código: ofuscación, cadenas largas codificadas, `eval`, código descargado y ejecutado en
  tiempo de ejecución.
- Escrituras o borrados en los datos del usuario que el usuario no haya pedido.
- Librerías: proyectos conocidos, versión indicada, una licencia que permita el uso comercial.
- Que realmente funcione sin conexión, en modo claro y oscuro, y no rompa Offlined.

Consulta la [guía de revisión](../../REVIEW.es.md) completa.

## Informar de un problema

Si encuentras un problema de seguridad en un addon o en cómo Offlined ejecuta los addons, **no abras un issue público**. Usa
el informe privado de GitHub: [*Security → Report a vulnerability*](https://github.com/Aruvaro-Chulvi/OfflinedAddons/security/advisories/new).
Mira [SECURITY.md](../../../SECURITY.md).
