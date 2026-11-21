# Mantener el catálogo

*[Read in English](MAINTAINING.md)*

Para el mantenedor: cómo entra en Offlined un addon aprobado.

## Una sola vez

- Python 3.9+ con `cryptography` (`pip install cryptography`) y [`gh`](https://cli.github.com) con la sesión iniciada.
- La clave de firma de addons de Offlined, `offlined_addons_ed25519.pem`. Por defecto `tools/publish.py` la busca en
  `..\SurvivalAI-phi4\.signing\`; si no, pasa `--key RUTA` o define `OFFLINED_SIGNING_KEY`. **Nunca** la subas a un
  commit, ni a GitHub (ni siquiera como secreto de Actions), ni se la envíes a nadie: quien la tenga puede firmar addons
  como si fuera Offlined. Guarda una copia de seguridad fuera de este ordenador.

## Aprobar una pull request

1. La comprobación automática está en verde; lee su informe (errores, advertencias, endpoints 🔎 con datos personales).
2. Descarga el paquete de prueba (página de la comprobación → *Artifacts*), instálalo en Offlined y pruébalo.
3. Sigue la [guía de revisión](REVIEW.es.md). Pide cambios en la pull request si hace falta.
4. Haz el merge. Aprobar es hacer el merge: `main` solo acepta pull requests revisadas por el propietario del código.

## Publicar

```bash
git pull
python tools/publish.py --dry-run   # builds and signs into dist/, shows what changes
python tools/publish.py             # creates release addons-YYYY-MM-DD with every zip + catalog.json
git add catalog.json
git commit -m "Catalogue addons-YYYY-MM-DD"
git push
```

`publish.py` se niega a ejecutarse si algún addon no pasa la comprobación o si la clave no es la de Offlined. Cada
versión publicada incluye **todos** los addons aprobados y el catálogo, y se marca como *latest*; Offlined lee
`releases/latest/download/catalog.json`. Las versiones publicadas nunca se editan: para corregir una, publica una nueva
(una segunda versión el mismo día es `addons-YYYY-MM-DDb`). GitHub puede tardar uno o dos minutos en servir el nuevo *latest*.

El `catalog.json` del repositorio es con el que la comprobación compara las versiones, así que súbelo en un commit después de cada versión publicada.

## Retirar un addon

Borra su carpeta en una pull request (o muévela a `withdrawn/` para mantener visible el historial), haz el merge y publica.
Desaparece de *Addons disponibles*; las copias instaladas siguen funcionando.

## Addons oficiales

`tools/official.json` lista los addons hechos por Offlined; el catálogo los marca como «Oficial». El paquete de
Offlined sigue incluyendo su propia copia de los cuatro addons integrados (hoja de cálculo, notas, pizarra y notas de audio);
cuando uno de ellos cambie aquí, cópialo también en Offlined.
