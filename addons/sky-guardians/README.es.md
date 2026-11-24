# 🛡️ Guardianes del Cielo

*[Read in English](README.md)* · **Addon oficial de Offlined** · MIT

Un juego arcade de supervivencia en combate aéreo sobre **tus propios mapas**: elige un sitio de un mapa que tengas
descargado y allí se levanta una torre de comunicaciones gigante. Oleada tras oleada, los aviones enemigos van a por
ella. Derríbalos, repara la torre y aguanta todo lo que puedas. Totalmente sin conexión, hecho sobre el motor de
**Wiki Flight** de Offlined.

## Cómo se juega

1. **Jugar → Preparar la partida.** Elige el mapa, el punto de la batalla (en el mapa, al azar o uno de tus últimos
   lugares), tu avión, el modo y la dificultad.
2. Defiende la torre. Su vida va del 100 % al 0 %, y el daño se ve en la propia torre.
   - Algunos enemigos sueltan **kits de reparación** en paracaídas: pasa por encima de uno y luego por el anillo verde
     junto a la torre (+15 %). Entre oleadas la torre también recupera un 5 %.
   - Tras algunos derribos brillan **potenciadores** en el aire: fuego rápido, arma 2 sin límite, nave reparada y
     puntos dobles.
   - **Cuatro torretas antiaéreas** en la explanada de la torre te ayudan mientras la torre esté por encima del 30 %.
   - Derribar a un enemigo que ya casi llegaba a la torre es una **¡Salvada!** (+100); cualquier daño a la torre rompe
     tu racha.
3. Cada 5 oleadas llega un **jefe**, un bombardero estratégico: solo le hacen daño de verdad los motores. Con dos
   motores se pone furioso; con uno, se lanza contra la torre.

Los enemigos llegan por los rumbos que se avisan en el respiro entre oleadas (texto, flechas naranjas y el radar), y
muchas oleadas tienen tema: ataque a la torre, cazas, enjambre de drones, escuadrón de bombarderos, helicópteros y
vuelo rasante.

El **entrenamiento** (2 minutos) enseña a volar, disparar, fijar objetivos y reparar la torre.

## Modos

| Modo | |
|---|---|
| Supervivencia | Oleadas sin fin hasta que caiga la torre. |
| Corta | 10 oleadas con 2 jefes, unos 8 minutos. Si la torre aguanta, ganas. |
| Diaria | La misma partida para toda la familia hoy: mismas oleadas, el avión del día y dificultad Normal. Se puede repetir cuantas veces quieras; el ranking de hoy guarda la mejor de cada uno. |

Dificultad: fácil, normal o difícil. Un **compañero IA** opcional (no en la diaria) vuela contigo y va a por lo que
amenaza la torre; sus derribos no dan puntos y esas partidas salen con 🤝 en el ranking.

## Los aviones

| | Avioneta de combate | Caza |
|---|---|---|
| Velocidad | Lenta | Rápida |
| Agilidad | Muy alta | Media |
| Arma 1 | Dos ametralladoras en las alas | Cañón rotativo en el morro |
| Arma 2 | Salvas de cohetes (daño en área) | Misiles guiados: mantén para fijar hasta 4 blancos y suelta para disparar |

Los dos aviones son diseños genéricos propios, y también los enemigos (un bando ficticio en gris oscuro y ámbar). Al
subir de rango se desbloquean seis libreas, de cadete a guardián. El **Hangar** muestra la ficha de cada avión, sus
armas y sus libreas.

## Controles

Controles arcade para **mando** y para **teclado y ratón**, los dos se pueden cambiar en Controles:

| | Teclado y ratón | Mando |
|---|---|---|
| Volar | Ratón (haz clic en la pantalla para apuntar con él) o flechas / A D | Stick izquierdo |
| Arma 1 · Arma 2 | Espacio o clic izquierdo · V o clic derecho | RT · LT |
| Objetivo (mantener: cámara sobre él) | Tab o E | Y |
| Acelerar · Frenar | W o Mayús · S o Ctrl | RB · LB |
| Cámara · Pausa | C · Esc | Cruceta arriba · Start |

El juego se pausa solo cuando la ventana pierde el foco, cuando se minimiza Offlined o cuando se desconecta el mando.
Salir del addon a mitad de partida pide confirmación: una partida sin terminar no cuenta.

## Progreso

Rangos (cadete, piloto, teniente, capitán, as y guardián) según la mejor oleada alcanzada, 30 logros, tu historial y
un **ranking familiar** por modo y dificultad, con todos los usuarios de Offlined que juegan en este ordenador.

## Sonido

Los efectos y la música adaptativa se sintetizan en el navegador: no hay archivos de audio. Volúmenes separados para
la música y los efectos en Ajustes; el botón 🔊 de arriba a la derecha (o la tecla M) lo silencia todo, y el juego
calla mientras esté puesto el silencio general de Offlined.

## Requisitos

- **Offlined 4.0 o posterior** (el addon usa el modo complemento de Wiki Flight, nuevo en Offlined 4).
- Un **mapa con todo el detalle (nivel 14 o más) descargado en Mapas** que cubra el sitio de la batalla.
- Una tarjeta gráfica que mueva Wiki Flight con soltura. Se aplican los ajustes de calidad de Wiki Flight.

## Dónde están tus datos

- En el almacén propio del addon (`Offlined Data/Addons/installed/sky-guardians/data/storage.json`): las partidas
  terminadas, los rankings, los logros y los rangos **de cada usuario de Offlined**. Al actualizar se conservan; al
  desinstalar se borran.
- En el almacenamiento local del motor del navegador: tus ajustes, controles, volúmenes y últimos lugares.

## API de Offlined

Lee `/api/users/session` (solo para saber qué usuario de Offlined juega y su nombre), `/api/wiki-geo` (pueblos cerca
del punto elegido, para «Sitio al azar») y su propio almacén `/api/addons/sky-guardians/storage`. Se ejecuta dentro
de Wiki Flight de Offlined (`/flightsim/`) y usa la copia de three.js de Offlined (`/vendor/three-0.169.0/`). Nada
más, y nada de internet.

## Licencia

MIT. Los aviones, la torre, los enemigos, el sonido y la música son originales y se generan con código; three.js
(MIT) y los datos de los mapas (© colaboradores de OpenStreetMap, ODbL) vienen del propio Offlined.
