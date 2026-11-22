# ⭕ Circuito

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Un rompecabezas de circuito al estilo de Slitherlink, dentro de Offlined, totalmente sin conexión y con su propio
generador de tableros.

## Cómo se juega

Dibuja **un único circuito cerrado** por las líneas entre los puntos. Un número en una casilla indica cuántos de
sus cuatro lados forman parte del circuito (de 0 a 3). El circuito nunca se cruza ni se bifurca: cada punto por el
que pasa tiene exactamente dos líneas. Ganas cuando el circuito está cerrado y se cumplen todos los números.

- **Clic** en el hueco entre dos puntos dibuja una línea; otro clic pone una cruz ✕ («aquí no hay línea»); otro
  más lo borra.
- **Clic derecho** (o el botón **Modo ✕**, cómodo en pantallas táctiles) pone o quita una cruz.
- **Arrastra** para dibujar varias líneas (o cruces) de una vez.
- Un número se pone en gris cuando sus cuatro lados están decididos, y en rojo si tiene demasiadas líneas o cruces.
- Al completar el circuito, su interior se sombrea.

## Qué hace

- **Seis niveles**, que crecen en tamaño y en el razonamiento que piden:

  | Nivel | Tamaño | Técnica más difícil necesaria |
  |---|---|---|
  | Muy fácil | 5×5 | Reglas básicas: número completo, puntos con dos líneas, puntos con una sola salida |
  | Fácil | 7×7 | Reglas básicas, con menos números |
  | Medio | 8×8 | Patrones alrededor de un número (mirando sus esquinas) |
  | Difícil | 10×10 | Sin circuitos pequeños, patrones de dos números |
  | Experto | 12×12 | Dentro y fuera del circuito |
  | Maestro | 15×15 | Hipótesis y contradicción |

- **Cada tablero es nuevo.** El generador hace crecer al azar una región sin agujeros (su borde es el circuito),
  escribe todos los números y quita números mientras un solucionador «humano» pueda terminarlo usando solo las
  técnicas del nivel. Resolverlo con deducciones correctas demuestra además que la solución es única.
- **Códigos de partida** (`XXXX-XXXX`): el mismo código da siempre el mismo tablero.
- **Pistas en tres escalones**: la zona, luego la técnica y al final las líneas o cruces que da.
- **Errores**: *Libre* (por defecto; el addon avisa si un circuito cerrado no cumple los números) o *Estricto*
  (las líneas y cruces equivocadas se marcan al momento y se cuentan).
- Deshacer/rehacer, reiniciar, pausa, cronómetro, estadísticas por nivel y racha de días; tema claro y oscuro como
  Offlined; los 10 idiomas de Offlined.

### Teclado

`X` modo ✕ · `H` pista · `P` o `Espacio` pausa · `Ctrl+Z` / `Ctrl+Y` deshacer / rehacer · `Esc` cierra.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/circuit/data/storage.json`): la partida en curso,
los ajustes y las estadísticas **de cada usuario de Offlined**, y dos tableros ya preparados por nivel para que una
partida nueva empiece al instante. Al actualizar el addon se conservan; al desinstalarlo se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su
nombre y el color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet. Los
tableros se generan en un Web Worker para que el juego vaya fluido.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC).
