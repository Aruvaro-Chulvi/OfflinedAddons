# 1. Primeros pasos

*[Read in English](../01-getting-started.md)* · [Índice del SDK](README.md)

## Qué necesitas

- **Offlined 3.0 o posterior** instalado en tu ordenador.
- Un editor de texto.
- [Python 3.9+](https://www.python.org) para ejecutar las herramientas de ayuda de este repositorio (solo usan la
  biblioteca estándar: no hay nada que instalar).
- Una cuenta de [GitHub](https://github.com), cuando quieras compartir tu addon.

## Tu primer addon

1. Haz un **fork** de este repositorio en GitHub y clona tu fork, o simplemente
   [descárgalo como zip](https://github.com/Aruvaro-Chulvi/OfflinedAddons/archive/refs/heads/main.zip) para empezar.
2. Copia la plantilla y ponle tu id (letras minúsculas, dígitos y guiones):

   ```bash
   cp -r templates/hello-world addons/my-addon
   ```

3. Edita `addons/my-addon/addon.json`: define `"id": "my-addon"` (igual que la carpeta), el nombre, tu nombre como
   autor, una descripción y un icono emoji. Mira [el manifiesto](02-manifest.md).
4. Edita `addons/my-addon/frontend/panel.html`. Este es todo tu addon: una página web normal.
5. Compruébalo:

   ```bash
   python tools/validate.py addons/my-addon
   ```

## Pruébalo dentro de Offlined

```bash
python tools/package.py addons/my-addon
```

Esto escribe `dist/test/my-addon-1.0.0.zip`. En Offlined abre **Addons → Gestionar addons** y suelta el archivo sobre
**Instalar addon**. Offlined te avisa de que el addon no está firmado, algo normal en un addon en desarrollo;
confirma y aparecerá en el menú **Addons** con una insignia «No verificado».

### Más rápido: edítalo en su sitio

Una vez instalado, Offlined sirve tu addon directamente desde su carpeta:

```
Offlined Data/Addons/installed/my-addon/frontend/panel.html
```

Edita los archivos ahí y vuelve a abrir el addon para ver el cambio, sin reinstalar. Cuando estés conforme, copia los
archivos de vuelta a `addons/my-addon/` en el repositorio.

> **Consejo:** mientras Offlined está en marcha también puedes abrir
> `http://127.0.0.1:17870/addon-panels/my-addon/frontend/panel.html?theme=dark&lang=en` en tu propio navegador y
> usar sus herramientas de desarrollo (consola, red, inspector).

## Siguiente

- Haz que se vea como Offlined en modo claro y oscuro y que hable el idioma del usuario: [el panel](03-panel.md).
- Guarda datos: [almacenamiento y API de Offlined](04-storage-and-api.md).
- Compártelo: [publicación](05-publishing.md).
