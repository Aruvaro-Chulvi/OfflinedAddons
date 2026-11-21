# 5. Publicación

*[Read in English](../05-publishing.md)* · [Índice del SDK](README.md)

Los addons llegan a la gente a través del **catálogo**: la lista que Offlined muestra en **Addons → Gestionar addons →
Addons disponibles**, con un botón para instalar o actualizar cada uno. Solo están en él los addons que el mantenedor ha
**revisado, aprobado y firmado**.

## De tu idea a Offlined

```
 your pull request ──► automatic check ──► review ──► merge ──► signed release ──► «Available addons» in Offlined
                         (seconds)        (maintainer)          (maintainer)
```

1. **Pull request.** Añade tu carpeta `addons/<id>/` (o cambia una existente) y abre una pull request. Rellena
   la lista de comprobación de la plantilla.
2. **Comprobación automática.** GitHub ejecuta [`tools/validate.py`](../../../tools/validate.py) y publica un informe: errores
   (hay que corregirlos), advertencias (el revisor las mira) y los endpoints de Offlined con datos personales que use tu
   addon. También construye un **paquete de prueba** que tú y el revisor podéis descargar desde la página de la comprobación
   (*Artifacts*) e instalar.
3. **Revisión.** El mantenedor lee el código, instala el paquete de prueba y lo prueba. Puede pedir cambios en
   la pull request. Lo que mira está en la [guía de revisión](../../REVIEW.es.md).
4. **Merge = aprobado.** Solo el mantenedor puede hacer merge en `main`.
5. **Versión firmada.** El mantenedor empaqueta todos los addons aprobados, los firma con la clave de Offlined (en su propio
   ordenador: la clave nunca está en GitHub) y publica una nueva
   [versión](https://github.com/Aruvaro-Chulvi/OfflinedAddons/releases) con los paquetes y `catalog.json`.
6. **En Offlined.** Todos los Offlined que abren *Addons disponibles* ven tu addon, y los que tienen una versión
   anterior ven **Actualizar**.

## Las reglas

Un addon se acepta cuando:

- Hace algo útil, y hace lo que dice su README: nada oculto.
- Funciona **sin internet**: sin scripts, fuentes, imágenes ni peticiones de otros servidores.
- No envía datos a ninguna parte, no rastrea a las personas ni muestra anuncios.
- Solo usa los datos personales que necesita para lo que hace, y lo dice en su README.
- Su código es legible. Las librerías minificadas están bien si son muy conocidas y dices de qué versión son;
  tu propio código no debe estar minificado ni ofuscado.
- Tiene una **licencia abierta** de la lista aceptada, y todo lo que contiene (librerías, imágenes, fuentes, sonidos)
  puede redistribuirse bajo licencias que permitan el uso comercial. Los citas en el README.
- Es trabajo tuyo, o tienes derecho a publicarlo.
- Es apropiado para todas las edades: Offlined lo usan familias y colegios.
- No es una copia ni un clon de un producto comercial, de un juego ni de una marca.

## Actualizar tu addon

Cambia tus archivos, **sube `version`** en `addon.json` y abre una pull request. La comprobación rechaza un addon modificado
cuya versión no se haya subido, porque Offlined decide que hay una actualización comparando versiones. Añade una línea
a `CHANGELOG.md` en tu carpeta si llevas uno.

Los datos del usuario sobreviven a las actualizaciones (mira [almacenamiento](04-storage-and-api.md)); si tu nueva versión cambia la forma de
esos datos, convierte los antiguos cuando se cargue tu panel.

## Mejorar el addon de otra persona

Bienvenido: abre una pull request como para el tuyo. Se pide al autor original su conformidad con los cambios que alteren lo que hace
el addon. Conserva al autor y añádete tú, p. ej. `"author": "Ana Pérez, Li Wei"`.

## Retirar un addon

Los autores pueden pedir que se retire su addon abriendo un issue. El mantenedor también puede retirar un addon
que incumpla las reglas o deje de funcionar. Un addon retirado desaparece de *Addons disponibles*; las copias ya
instaladas siguen funcionando hasta que el usuario las quite.

## Compartir fuera del catálogo

Siempre puedes darle tu `.zip` directamente a alguien (`python tools/package.py`). Offlined lo instalará tras
avisar de que no está firmado y lo marcará como «No verificado». El catálogo es para addons en los que cualquiera pueda confiar
sin conocerte.

## Firma (como referencia)

Un paquete firmado tiene un archivo extra junto a `addon.json`: `offlined-signature.json`, una firma Ed25519 sobre
la lista ordenada de `[ruta, SHA-256]` de cada archivo del paquete. Offlined la comprueba con su clave pública cuando
instala el addon:

| Paquete | Offlined |
|---|---|
| Firmado y sin cambios | Lo instala. Sin avisos. |
| Sin firmar | Avisa de que podría ver todos los datos del usuario; lo instala solo si el usuario confirma; lo marca como «No verificado». |
| Firmado, pero un archivo cambió después de firmar | Se niega a instalarlo. |

Los paquetes se construyen de forma determinista (orden y fechas de archivos fijos), así que cualquiera puede reconstruir una versión publicada desde este
repositorio y comparar el SHA-256 de `catalog.json`. El formato de `catalog.json` se describe en
[catalog-format.md](../../catalog-format.md).
