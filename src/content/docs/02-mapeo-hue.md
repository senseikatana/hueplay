---
title: Por qué los ejes de tono no coinciden
description: La equivalencia HSL→OKLCH es una conversión real, no una tabla. Y depende de la saturación y la luz.
order: 2
year: 2020
---

La pregunta que trae todo el mundo: _si el rojo es 0° en HSL, ¿qué es en
OKLCH?_

La respuesta corta: **no hay respuesta única.** Y esa es la parte
interesante.

## La conversión no es lineal

Llegar de un hex a OKLCH son cuatro pasos, dos de ellos curvas:

```text
hex / hsl()          sRGB, gamma-encoded, 8 bits
  → linealizar       curva sRGB: lineal bajo 0.04045 (pendiente 12.92),
                    si no ((c + 0.055) / 1.055)^2.4   → gamma ≈ 2.2
  → XYZ (D65)        matriz sobre RGB lineal
  → OKLab            matriz a LMS, CUBO RAÍZ, matriz
  → OKLCH            forma polar: C = √(a² + b²), H = atan2(b, a)
```

Como la función de transferencia **y** el cubo raíz doblan los números, la
rueda de color queda **girada y estirada de forma no uniforme**. No es la
misma rueda vista desde otro ángulo.

## Los seis primarios HSL, medidos

Con `s = 100%` y `l = 50%`, la conversión real da:

| HSL            | Hue OKLCH | Rotación |
| -------------- | --------- | -------- |
| Rojo (0°)      | 29.2°     | +29.2°   |
| Amarillo (60°) | 109.8°    | +49.8°   |
| Verde (120°)   | 142.5°    | +22.5°   |
| Cian (180°)    | 194.8°    | +14.8°   |
| Azul (240°)    | 264.1°    | +24.1°   |
| Magenta (300°) | 328.4°    | +28.4°   |

El desplazamiento no es constante, así que los sectores tampoco. El sector de
60° que va de rojo a amarillo abarca **80.6°** de tono OKLCH (estirado ~1.34×),
mientras el de amarillo a verde abarca apenas **32.7°** (comprimido ~0.55×).

Ese estirón es literalmente lo que muestra el anillo interior de esta
herramienta.

## Y depende además de saturación y luz

Este es el detalle que arruina cualquier tabla de traducción:

| Color               | Hue OKLCH  |
| ------------------- | ---------- |
| `hsl(240 100% 50%)` | **264.1°** |
| `hsl(240 50% 50%)`  | **275.6°** |
| `hsl(240 25% 50%)`  | **282.4°** |

**17° de diferencia con el mismo tono HSL.** La equivalencia no es función
del ángulo: es función del color entero.

Por eso, en el dial, mover la saturación HSL **re-deriva** el tono OKLCH. No es
un bug, es la única respuesta correcta.

## El round-trip no es único

Cerca de los primarios la relación no es inyectiva: un tramo de 10-15° de tono
HSL se aplana en un solo grado de OKLCH. Arrastrar el dial por esa zona mueve
el HSL a saltos visibles.

Eso **no es un redondeo**: es la forma del espacio de color. Esta herramienta lo
resuelve reconociendo el tono actual antes de buscar el más cercano, así que
el viaje de ida y vuelta HSL → OKLCH → HSL te devuelve exactamente donde
empezaste.

## Lo que esto significa

Un conversor **nunca** te va a devolver una tabla reutilizable. Y un hex que
elegiste hace seis meses lleva su propia saturación y luz, así que su tono
OKLCH es el que _ese_ color produce. No hay atajo.
