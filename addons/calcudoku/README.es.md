# 🧮 Calcudoku

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Un rompecabezas de lógica y cálculo dentro de Offlined, totalmente sin conexión y con su propio generador. Misma
interfaz que el addon de Sudoku.

## Cómo se juega

Rellena una cuadrícula de N×N con los números del 1 al N de modo que **cada fila y cada columna lleve cada número
una sola vez**. La cuadrícula está dividida en **jaulas** (bordes gruesos). Cada jaula muestra un resultado y una
operación: sus números deben dar ese resultado con + (suma), − (diferencia de dos números), × (producto) o ÷
(cociente de dos números). Una jaula de una sola casilla muestra directamente su número. Los números pueden
repetirse dentro de una jaula si no están en la misma fila o columna.

## Qué hace

- **Seis niveles**:

  | Nivel | Cuadrícula | Operaciones | Técnica más difícil que pide |
  |---|---|---|---|
  | Muy fácil | 4×4 | + | Combinaciones de jaula |
  | Fácil | 5×5 | + − | Combinaciones de jaula (a veces jaula y línea) |
  | Medio | 6×6 | + − × ÷ | Jaula y línea, o pares desnudos / ocultos |
  | Difícil | 7×7 | + − × ÷ | Pares, o la suma de la línea |
  | Experto | 8×8 | + − × ÷ | Suma de la línea, trío desnudo o X-Wing |
  | Maestro | 9×9 | + − × ÷ | Trío desnudo o X-Wing |

  Los niveles se distinguen por el razonamiento que exigen, no solo por el tamaño: cada tablero de un nivel necesita
  al menos su técnica y nada más difícil de lo que el nivel permite.

- **Cada tablero es nuevo.** El generador crea un cuadrado latino al azar, lo corta en jaulas y elige las
  operaciones; solo se queda con el tablero si un solucionador lógico lo termina (únicas, combinaciones de jaula,
  jaula y línea, pares desnudos y ocultos, suma de la línea, tríos desnudos, X-Wing), lo que además demuestra que la solución es única.
- **Códigos de partida** (`XXXX-XXXX`): el mismo código da siempre el mismo tablero.
- Notas, autonotas, deshacer/rehacer, resaltado de fila, columna y del mismo número.
- **Pistas en tres escalones**: la zona, luego la técnica y al final el número.
- **Errores**: *Libre* (por defecto) o *Estricto* (los números equivocados se marcan al momento y se cuentan).
- Pausa, cronómetro, estadísticas por nivel y racha de días; tema claro y oscuro como Offlined; los 10 idiomas de
  Offlined.

### Teclado

`1`–`9` ponen un número · `Mayús` + número añade una nota · flechas para moverse · `Retroceso`/`Supr` borran ·
`N` notas · `H` pista · `P` o `Espacio` pausa · `Ctrl+Z` / `Ctrl+Y` deshacer / rehacer · `Esc` cierra.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/calcudoku/data/storage.json`): la partida en curso,
los ajustes y las estadísticas **de cada usuario de Offlined**, y dos tableros preparados por nivel. Al actualizar
el addon se conservan; al desinstalarlo se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su
nombre y el color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet. Los
tableros se generan en un Web Worker.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC).
