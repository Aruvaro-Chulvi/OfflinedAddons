# ♟️ Ajedrez

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Ajedrez contra el ordenador dentro de Offlined, totalmente sin conexión, con un motor de ajedrez escrito para este
addon.

## Qué hace

- **Cuatro niveles**:

  | Nivel | Cómo juega el ordenador |
  |---|---|
  | Principiante | Mira una jugada y a veces elige a propósito una peor |
  | Aficionado | Piensa 2–3 jugadas, con algún despiste pequeño |
  | Avanzado | Calcula 4–6 jugadas (alrededor de 1 segundo) y conoce las aperturas habituales |
  | Maestro | Calcula todo lo que puede en 2–3 segundos, sin errores a propósito |

- Juega con **blancas, negras o al azar**. El tablero se coloca de tu lado; **Girar** le da la vuelta cuando
  quieras.
- **Reloj opcional**: sin reloj (por defecto), 5, 10 o 15 minutos por jugador. Se para mientras el addon está
  oculto.
- Clic en la pieza y luego en la casilla, o arrastrándola. Se marcan las jugadas posibles, la última jugada y el
  rey en jaque.
- Reglas completas: enroque, captura al paso, coronación (eliges la pieza), jaque mate, ahogado, triple
  repetición, regla de los 50 movimientos y material insuficiente.
- **Atrás** deshace tu última jugada (y la respuesta del ordenador); **Pista** muestra con una flecha la jugada
  del ordenador. Usar cualquiera de las dos marca la partida como **con ayuda**: cuenta igual, y las estadísticas
  dicen cuántas victorias fueron con ayuda. La racha solo suma victorias sin ayuda.
- **Tablas** las ofrece (el ordenador acepta si va peor o en una partida larga e igualada); **Rendirse** pide
  confirmación.
- Jugadas en notación con figuras (`♘f3`), igual en todos los idiomas, y **Copiar PGN** para abrir la partida en
  cualquier otro programa de ajedrez.
- Estadísticas por nivel (ganadas, tablas, perdidas), tema claro y oscuro como Offlined, los 10 idiomas de
  Offlined.

## El motor

`frontend/engine/chess-engine.js`, escrito para este addon: tablero 0x88 con generación de jugadas legales
(verificada con las posiciones de prueba *perft* estándar), búsqueda alfa-beta con profundización iterativa,
búsqueda de variante principal, tabla de transposición, poda de jugada nula, reducciones de jugadas tardías,
jugadas asesinas e historial, y búsqueda de quietud. La evaluación usa material, tablas de posición propias
(medio juego/final), pareja de alfiles, estructura de peones, peones pasados, torres en columnas abiertas y
refugio del rey. Un pequeño libro de aperturas habituales da variedad. Piensa en un Web Worker, así que el tablero
nunca se congela.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/chess/data/storage.json`): la partida en curso,
los ajustes y las estadísticas **de cada usuario de Offlined**. Al actualizar el addon se conservan; al
desinstalarlo se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su
nombre y el color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet.

## Licencia

MIT. Iconos de piezas y de la interfaz de [Lucide](https://lucide.dev) (ISC); las siluetas de torre, caballo y
peón están cerradas para poder rellenarlas.
