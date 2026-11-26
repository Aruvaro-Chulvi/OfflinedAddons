# 💣 Buscaminas

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

El clásico de despejar minas dentro de Offlined, totalmente sin conexión, con tableros que se resuelven sin
adivinar.

## Cómo se juega

Descubre todas las casillas que no tienen mina. Un número indica cuántas minas tocan esa casilla (también en
diagonal). Usa los números para deducir dónde están las minas.

- **Clic** en una casilla la descubre. El **primer clic es siempre seguro** y abre una zona.
- **Clic derecho**, **pulsación larga** (pantallas táctiles) o el **modo bandera** pone o quita una bandera.
- **Clic en un número** que ya tiene todas sus banderas alrededor abre el resto de sus vecinas (se puede desactivar
  en Ajustes). El clic central hace lo mismo.

## Qué hace

- **Cuatro niveles**:

  | Nivel | Tablero | Minas |
  |---|---|---|
  | Principiante | 9×9 | 10 |
  | Intermedio | 16×16 | 40 |
  | Experto | 30×16 | 99 |
  | Maestro | 30×24 | 170 |

- **Sin adivinar** (activado por defecto): las minas se colocan después del primer clic, y un tablero solo se acepta
  si un solucionador lógico puede despejarlo desde ahí. Nunca te quedarás atascado en un 50/50.
- **Pistas en tres escalones**: los números en los que fijarse, el razonamiento (número ya completo, tantas minas
  como casillas ocultas, comparar dos números, minas que quedan en total) y al final se abre la casilla segura o se
  marca la mina. Una pista cuenta una sola vez por posición del tablero: volver a pedirla o pulsar **Más ayuda** no
  suma más.
- **Deshacer la jugada** después de pisar una mina. Las pistas y deshacer marcan la partida como **con ayuda**:
  cuenta como ganada, pero no para el mejor tiempo, el tiempo medio ni la racha.
- Estadísticas por nivel (jugadas, ganadas, % de victorias, mejor tiempo y tiempo medio), racha de victorias sin
  ayuda, pausa que tapa el tablero, números en gris o de colores, tema claro y oscuro como Offlined, los 10 idiomas
  de Offlined.
- **Sonido** (Ajustes): *Apagado*, *Suave* (por defecto) o *Normal*. Sonidos cortos generados en el navegador (sin
  archivos de audio); se callan cuando Offlined está en silencio. Las zonas que se abren se despliegan en onda desde
  el clic, las banderas aparecen con un pequeño salto, un clic en un número que no puede abrir tiembla y, al
  perder, las minas aparecen una tras otra.

### Teclado

`F` modo bandera · `H` pista · `N` nueva partida · `P` o `Espacio` pausa · `Esc` cierra.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/minesweeper/data/storage.json`): la partida en
curso, los ajustes y las estadísticas **de cada usuario de Offlined**. Al actualizar el addon se conservan; al
desinstalarlo se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su
nombre y el color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC).
