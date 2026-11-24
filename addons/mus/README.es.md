# 🂠 Mus

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

El **mus** por parejas: tú y tu compañero contra dos jugadores del ordenador, dentro de Offlined y totalmente sin
conexión, con una baraja española dibujada para este addon (la misma que el addon de Escoba).

## Cómo va una mano

1. **Mus**: empezando por la mano (el jugador siguiente al que reparte), cada uno dice *Mus* o *No hay mus*. Si
   todos piden mus, cada jugador cambia de 1 a 4 cartas y se vuelve a empezar; el primer *No hay mus* abre los
   lances.
2. **Lances**, en este orden:
   - **Grande**: ganan las cartas más altas.
   - **Chica**: ganan las más bajas.
   - **Pares**: par (dos iguales), medias (tres iguales), duples (dos pares). Solo hablan los que tienen pares.
   - **Juego**: 31 o más (las figuras valen 10). La 31 es la mejor; luego 32, 40, 37, 36, 35, 34 y 33. Si nadie
     tiene juego, se juega al **Punto** (lo más cerca de 30).
3. En cada lance: **Paso**, **Envido** (eliges cuánto), subir, **Órdago** (la vaca entera) o responder **Quiero** /
   **No quiero**. Un envite no querido puntúa al momento para quien envidó.
4. **El recuento**: se enseñan las cartas y se suma en el orden Grande, Chica, Pares, Juego/Punto. Los pares suman
   1 (par), 2 (medias) o 3 (duples) por cada jugador de la pareja ganadora; el juego suma 3 la 31 y 2 los demás;
   un lance en paso vale 1 (Grande, Chica, Punto). En los empates gana el más cercano a la mano.

Una **vaca** se gana a 30 tantos (o 40); la partida es al mejor de **3 vacas**. Con **8 reyes** (por defecto) los
treses cuentan como reyes y los doses como ases; con 4 reyes conservan su valor.

## Qué hace

- **Cuatro niveles**: Principiante (envida y quiere casi al azar), Aficionado (juega sus cartas, no farolea),
  Avanzado (lee la mano y farolea algo) y Maestro (pesa cada envite con lo que puede ganar o perder y lee los envites
  del rival). El ordenador calcula sus posibilidades repartiendo cientos de veces las cartas que no ve.
- Una mesa clara: los cuatro asientos con lo que dice cada uno, los cuatro lances con su estado, un resumen de lo
  que lleva tu mano (pares, juego, punto), el recuento con todas las cartas a la vista y el marcador con las vacas.
- **Pista** sugiere lo que haría el Maestro (la partida pasa a contar «con ayuda»).
- Estadísticas por nivel (ganadas, perdidas, vacas, órdagos ganados); tema claro y oscuro como Offlined; los 10
  idiomas de Offlined; una página breve de reglas dentro del addon.
- Las señas entre compañeros no están en esta primera versión.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/mus/data/storage.json`): la partida en curso, los
ajustes y las estadísticas **de cada usuario de Offlined**. Al actualizar se conservan; al desinstalar se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. Lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su nombre y el
color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC).
