# 🃏 Escoba

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

La **escoba del 15** contra el ordenador, dentro de Offlined y totalmente sin conexión, con una baraja española
dibujada para este addon.

## Cómo se juega

Cada jugador recibe 3 cartas y se ponen 4 en la mesa. En tu turno juegas una carta: te llevas las de la mesa que
suman **15** junto con ella, o la dejas en la mesa. Las cartas valen su número; la sota 8, el caballo 9 y el rey 10.
Dejar la mesa vacía es **escoba**. Cuando se acaban las manos se reparten otras 3 cartas; cuando se acaba el mazo,
lo que queda en la mesa es para el último que se llevó algo.

Al final de cada mano: 1 punto por escoba, 1 por más cartas, 1 por más oros, 1 por el siete de oros y 1 por más
sietes. Si las cuatro primeras cartas de la mesa suman 15 (o 30), el que reparte se las lleva como una (o dos)
escobas. La partida es a 21 puntos por defecto (se puede elegir 11, 15 o 31).

- Elige una carta de tu mano y luego las de la mesa (las que puede llevarse se marcan) y pulsa **Llevarse**; o
  **Dejar en la mesa**. Doble clic en una carta la juega cuando solo hay una opción.
- **Pista** muestra la jugada que haría el nivel Maestro (la partida pasa a contar «con ayuda»).

## Niveles

| Nivel | Cómo juega el ordenador |
|---|---|
| Principiante | Casi al azar, pero nunca deja pasar una escoba |
| Aficionado | Va a por los puntos: escobas, oros, sietes, el siete de oros |
| Avanzado | Además evita dejarte una mesa con la que puedas hacer escoba |
| Maestro | Imagina las cartas que no ve y juega cientos de manos posibles antes de decidir |

## La baraja

Diseño propio pensado para que se lea bien: los cuatro palos (oros, copas, espadas, bastos) con sus colores de
siempre, los números tradicionales 1–7, 10, 11 y 12, y las figuras (sota, caballo, rey) dibujadas con formas
geométricas planas en dos tonos del color del palo, sobre un panel suave. Una pequeña marca indica lo que valen las figuras en este juego (8, 9, 10).

## Sonido

Efectos cortos y discretos que siguen el ritmo de la partida: barajar y repartir, una carta en la mesa, llevarse
cartas, un aviso suave cuando te toca y pequeñas señales para los momentos importantes (una escoba, el siete de oros, el fin de la mano). Ajustes → Sonido:
apagado, suave (por defecto) o normal. Los sonidos de cartas y fichas son grabaciones del paquete «Casino Audio» de
Kenney (CC0, kenney.nl); las señales se generan en el propio navegador.

## Dónde se guardan tus datos

En el almacén propio del addon (`Offlined Data/Addons/installed/escoba/data/storage.json`): la partida en curso, los
ajustes y las estadísticas **de cada usuario de Offlined**. Al actualizar se conservan; al desinstalar se borran.

## Requisitos y API de Offlined

Offlined 3.0 o posterior. Lee `/api/users/session` (solo para saber qué usuario de Offlined juega, su nombre y el
color de su avatar) y la foto del avatar `/api/users/<id>/avatar`. Nada más, y nada de internet.

## Licencia

MIT. Iconos de [Lucide](https://lucide.dev) (ISC). Sonidos de cartas y fichas: Kenney «Casino Audio» (CC0).
