# SAA-C03 · Estudio por temas

App web para preparar el examen **AWS Certified Solutions Architect – Associate
(SAA-C03)** con tu propio material: 632 preguntas de examen agrupadas en 13
temas, con las opciones reales A–D/E y la explicación de la respuesta.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Cómo se estudia

| Modo | Para qué sirve |
|---|---|
| **Práctica** | Opción múltiple con corrección y explicación al instante. Teclas `1`-`5` para elegir, `Enter` para comprobar y avanzar, `F` para marcar. |
| **Tarjetas** | Lees el escenario, respondes de memoria y te calificas. Programa el repaso con repetición espaciada (SM-2 simplificado). |
| **Simulacro** | 20/40/65 preguntas cronometradas, sin corrección hasta el final, repartidas como en el examen real (30% seguridad, 26% resiliencia, 24% rendimiento, 20% costos). Aprobado en 72%. |
| **Buscar** | Todo el banco filtrable por texto, tema o servicio. Escribe `#124` para ir a una pregunta concreta. |
| **Progreso** | Acierto y dominio por tema y por dominio del examen, lista de pendientes y exportar/importar. |

Una pregunta cuenta como **dominada** tras dos aciertos seguidos. El progreso
vive en `localStorage` de tu navegador; en *Progreso* puedes exportarlo a JSON
para llevarlo a otro equipo.

Las opciones se barajan en cada intento (se puede desactivar en *Progreso*) para
que memorices el razonamiento y no la letra. Por eso el panel *Por qué* muestra
la letra original de la respuesta correcta: las explicaciones del material citan
las opciones por su letra de origen.

## De dónde salen los datos

Ninguna pregunta ni respuesta se inventó: el banco se construye cruzando los dos
documentos de origen, que comparten la numeración 1..684.

- **PDF** (`AWS Certified Solutions Architect Associate SAA-C03.pdf`) → enunciados
  y las opciones reales A–D/E.
- **TXT** (`AWS SAA-03 Solution.txt`) → la respuesta correcta y la explicación
  escrita, en tres formatos distintos mezclados (`13]`, `51.`, `IMP>>>>>>98.`).

`tools/build_data.py` los une por número y **verifica cada respuesta**: la letra
del TXT solo se acepta si el texto de esa opción coincide con la respuesta
escrita; si no coincide, se busca la opción que sí encaja. Lo que no se puede
verificar se descarta en vez de adivinarse.

```bash
npm run data       # regenera src/data/*.json (requiere pypdf)
```

Resultado del cruce:

| | |
|---|---|
| Preguntas en el PDF con opciones | 683 |
| Con respuesta verificada → en la app | **632** |
| Descartadas: el TXT no trae respuesta | 50 |
| Descartadas: la respuesta no cuadra con las opciones | 1 |
| Marcadas como destacadas (`IMP>>>` en el TXT) | 15 |
| Sin explicación escrita en el material | 179 (la app muestra la respuesta igual) |

Las 8 preguntas donde el TXT parafrasea la opción en vez de citarla se marcan
con `confidence: "medium"` y la app avisa debajo de la explicación.

Un detalle del PDF: su fuente tiene el mapa `ToUnicode` roto y pierde las
ligaduras fi/fl/ff como bytes NUL (`Con\0gure`, `tra\0c`). `tools/ligature.py`
las reconstruye probando cada ligadura contra el diccionario del sistema —
2074 de 2134 se resuelven así y el resto cae en `fi`, que es la correcta en
todos esos casos salvo dos, corregidos a mano.

Los laboratorios de `code_v2025-10-27` se incluyen en la ficha de cada tema
(`snippets.json`).

## Estructura

```
tools/                 pipeline de datos (Python)
  build_data.py        cruza PDF + TXT, verifica y clasifica → src/data/
  ligature.py          repara las ligaduras perdidas del PDF
  topics.py            taxonomía de 13 temas, ~140 servicios y 4 dominios
src/
  data/                questions.json · topics.json · snippets.json
  lib/                 datos, estado persistente (SRS) y armado de sesiones
  components/          UI y la vista de pregunta
  pages/               Home · Topic · Practice · Flashcards · Exam · Progress · Browse
```

Los colores salen de una paleta validada para daltonismo. Como verde y rojo no
se distinguen con seguridad, **ningún estado depende solo del color**: cada
opción corregida lleva además icono y etiqueta (`✓ Correcta`, `✗ Tu respuesta`).

## Despliegue

Publicado en Vercel: <https://aws-saa-study-eta.vercel.app>

El proyecto está conectado a este repositorio, así que cada push a `main`
dispara un despliegue a producción y cada rama genera una preview. Para
publicar a mano desde local: `npx vercel deploy --prod`.

No hace falta `vercel.json`: la app usa `HashRouter`, así que no hay rutas del
servidor que reescribir.

## Nota

Los enunciados y las opciones están en inglés, igual que en el examen; la
interfaz está en español. El material de origen es un volcado de preguntas de
práctica: úsalo para entrenar el criterio, no como verdad oficial de AWS.
