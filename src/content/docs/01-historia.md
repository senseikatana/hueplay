---
title: La cronología de los modelos de color
description: Por qué HSL y OKLCH no comparten el eje de tono, contado desde Munsell hasta CSS Color 4.
order: 1
year: 1905
---

Organizar el color por cómo lo perceive el ojo no es una invención de los
años 90. Albert Munsell lo publicó en 1905, y su sistema —**Hue, Value,
Chroma**— sigue siendo, en su estructura, casi idéntico a OKLab: tres ejes
independientes, cada uno con su escala uniforme.

Lo que pasó después son 120 años de gente intentando arreglar el mismo
problema desde ángulos distintos. Casi cada modelo nuevo nace de una
decepción con el anterior.

## Los dos caminos de siempre

Durante buena parte del siglo XX convivieron dos familias con filosofías
opuestas:

- **Los que parten de la percepción.** Munsell, CIE XYZ (1931), CIELAB
  (1976). Miden de verdad, pero el resultado es un sólido de forma irregular
  y fea de manipular.
- **Los que parten del dispositivo.** RGB, HSL, HSV. Son reparametrizaciones
  de una pantalla, no del ojo. Fáciles de usar, técnicamente incorrectas.

La tensión entre ambas es la causa raíz de todo lo que vas a ver en esta
página.

## 1931 · CIE XYZ

La CIE construye el primer vínculo cuantitativo entre el espectro visible y
la percepción humana. **Todo el resto de la familia —Lab, LCH, OKLab— sale
de acá.** XYZ es la base fundacional de la ciencia del color moderna.

El problema: XYZ es independiente del dispositivo, lo cual es excelente para
la teoría y pésimo para un `input type="range"`.

## 1972 · NCS

El sistema noruego para pinturas normalizadas. Toma el camino opuesto al de
Munsell: en vez de medir la percepción, hace que el color sea **fácil de
describir**, a partir de seis primarios (blanco, negro, amarillo, rojo, verde,
azul) y un triángulo de whiteness/blackness/chromaticness.

Sigue en uso en la industria de la pintura. Para web, no.

## 1995 · sRGB

HP, Microsoft e Intel definen un gamut común para monitores. Nace `#ff0000`
como lo que hoy llamamos rojo puro, y con él el modelo **RGB**: aditivo, un
cubo, tres canales de 8 bits.

RGB no es un modelo de color, es un modelo de **pantalla**. Funciona porque las
pantallas son de tres luces.

## 1978 · HSL y HSV

El artículo ["Color Spaces for Computer Graphics"](https://doi.org/10.1145/800248.807362)
introduce HSL y HSV como transformaciones baratas de RGB. Y acá está la frase
que importa:

> Se eligieron por baratos, no por precisos.

En 1978 la CPU costaba plata y un modelo perceptual era carísimo de evaluar.
HSL y HSV compraron la transformación en tiempo real a cambio de no
representar la percepción humana. Nadie lo revisitó en serio hasta cuarenta
años después.

> **Detalle que casi nadie menciona:** HSL y HSV no son espacios de color.
> Son reparametrizaciones de RGB. Cada juego de primarios RGB produce un HSL
> distinto. `hsl(0 100% 50%)` sólo significa algo inequívoco cuando se declara
> contra sRGB.

## 1976 · CIELAB

La CIE intenta un espacio perceptualmente uniforme de verdad. Logra algo
importante: **L\*** se parece mucho a lo que el ojo llama luminosidad.

Pero tiene dos problemas que la arrastran hasta hoy:

- Está definido contra el **blanco D50**, una convención de la industria
  gráfica y de impresión (ICC). La web vive en D65.
- Al cambiar la croma, los azules giran hacia el violeta. Es el famous _hue
  shift_, y es la razón por la que `lch()` no está en esta herramienta.

## 2015 · HSLuv

[HSLuv](https://www.hsluv.org/) intenta arreglar HSL poniéndole CIELUV debajo.
Logra que la luminosidad sea creíble, pero el tono sigue fallando en azul y
violeta por el llamado **efecto Abney**: la percepción del tono no se comporta
como una mezcla aditiva de luz.

## 2020 · OKLab

Björn Ottosson publica OKLab. El nombre es literal: **"OK"** (adecuado) + las
coordenadas **L, a, b**.

Dos decisiones de diseño que lo explican todo:

- El nombre lleva un "OK" porque Ottosson presenta el modelo como un
  **compromiso razonable**, no como la solución definitiva. Su propia
  documentación sobre el espacio lo describe como "un espacio de color decente".
- Se ajustó a datos reales de percepción: **CAM16** para luminosidad y croma,
  **IPT** para tono. Hereda de CIELAB la estructura de tres ejes pero corrige
  el gamut y el problema de los azules.

OKLab usa **D65**, que es el blanco de sRGB. Es el descendiente directo que la
web necesitaba.

## 2023 · `oklch()` llega a los navegadores

`oklch()` entró en los borradores de CSS Color 4 en diciembre de 2021 y llegó
a los navegadores en 2023: **Chrome 111, Safari 15.4 y Firefox 113**.

Desde ahí, `oklch()` es una función CSS normal.

## El resumen que importa

Cada modelo nació de una restricción distinta:

| Modelo    | Nació para                     | Se optimizó para           |
| --------- | ------------------------------ | -------------------------- |
| RGB       | Mostrar en pantallas           | Velocidad del hardware     |
| HSL / HSV | Leer y escribir colores rápido | Coste computacional (1978) |
| CIELAB    | Medir la percepción            | Corrección científica      |
| OKLab     | Corregir CIELAB para software  | Compromiso usable          |

**HSL y OKLCH no están en desacuerdo: responden a preguntas distintas.** HSL
responde "¿cómo escribo rápido un color que puedo ver en esta pantalla?".
OKLCH responde "¿cómo represento lo que el ojo realmente mide?".

Por eso sus ejes de tono no coinciden, y por eso no existe una tabla de
traducción entre ellos. La equivalencia es una conversión, y además depende de
la saturación y la luz.
