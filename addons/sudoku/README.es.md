# 🔢 Sudoku

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Sudoku clásico de 9×9 dentro de Offlined, totalmente sin conexión y con su propio generador de tableros.

## Qué hace

- **Ocho niveles**: Muy fácil, Fácil, Medio, Difícil, Experto, Diabólico, Ultra y Mortal.
- **Cada sudoku es nuevo.** El addon los crea él mismo: una cuadrícula completa al azar, se quitan números
  mientras la solución siga siendo única y después un solucionador «humano» lo califica. El nivel lo decide **la
  técnica más difícil que hace falta**, no cuántos números trae:

  | Nivel | Técnica más difícil necesaria |
  |---|---|
  | Muy fácil | Último hueco, único lugar en la caja (36–40 números iniciales) |
  | Fácil | Único lugar en fila o columna, única candidata (30–34 números iniciales) |
  | Medio | Candidatos señaladores, reducción caja/línea, pares y tríos desnudos |
  | Difícil | Pares y tríos ocultos, cuartetos desnudos y ocultos |
  | Experto | X-Wing, Y-Wing, Swordfish |
  | Diabólico | XYZ-Wing, Rascacielos, Cometa, Pez turbot, W-Wing, coloreado simple, rectángulo único, Jellyfish |
  | Ultra | Cadenas X, cadenas XY y cadenas de inferencias alternas |
  | Mortal | Cadenas de forzado, necesarias tres veces o más, o redes de forzado |

- **Códigos de partida**: cada sudoku tiene un código (`XXXX-XXXX`). El mismo código da siempre el mismo sudoku,
  para compartirlo o repetirlo.
- Notas a lápiz, autonotas, deshacer/rehacer, resaltado de fila, columna, caja y del mismo número.
- **Pistas en tres escalones**: primero la zona, luego la técnica (explicada en una frase) y al final el número.
  Una pista cuenta una sola vez por posición del tablero: volver a pedirla o pulsar **Más ayuda** no suma más.
- **Errores**: *Libre* (por defecto: los encuentras tú; el addon avisa si el tablero lleno tiene errores) o
  *Estricto* (se marcan al momento y se cuentan).
- Pausa (tapa el tablero), cronómetro y estadísticas por nivel: jugadas, ganadas, mejor tiempo, tiempo medio y
  racha de días. Los mejores tiempos solo cuentan partidas sin pistas.
- **Sonido** (Ajustes): *Apagado*, *Suave* (por defecto) o *Normal*. Sonidos cortos generados en el navegador (sin
  archivos de audio) al escribir un número, poner notas, borrar y en los errores del modo *Estricto*; se callan
  cuando Offlined está en silencio. Una fila, columna o caja completa se ilumina desde la casilla hacia fuera, y al
  ganar una onda recorre el tablero.
- Tema claro y oscuro como Offlined, los 10 idiomas de Offlined, teclado y pantalla táctil.

### Teclado

`1`–`9` ponen un número · `Mayús` + número añade una nota · flechas para moverse · `Retroceso`/`Supr` borran ·
`N` notas · `H` pista · `P` o `Espacio` pausa · `Ctrl+Z` / `Ctrl+Y` deshacer / rehacer · `Esc` cierra.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/sudoku/data/storage.json`): la partida en curso,
los ajustes y las estadísticas **de cada usuario de Offlined**, y unos cuantos sudokus ya preparados por nivel para
que una partida nueva empiece al instante. Al actualizar el addon se conservan; al desinstalarlo se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. El addon lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su
nombre y el color de su avatar) y la foto de su avatar `/api/users/<id>/avatar`, para que cada persona de la
familia tenga sus partidas y estadísticas. Nada más, y nada de internet.

Los sudokus se generan en un Web Worker, en trocitos de tiempo, para que el juego vaya fluido.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC).
