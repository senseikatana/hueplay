---
title: La trampa del 100% de croma
description: En oklch(), 100% de croma no es 1.0. Es 0.4. Y esa confusión te da colores 2.5× más saturados.
order: 3
year: 2022
---

CSS Color 4 permite escribir la croma de `oklch()` como número **o** como
porcentaje, y el porcentaje tiene su propio rango de referencia:

```css
oklch(60% 0.15 29)   /* croma = 0.15        */
oklch(60% 15% 29)    /* croma = 0.06  (!!)   */
```

**`100%` de croma equivale a `0.4`, no a `1.0`.**

## Por qué la luminosidad no tiene la trampa

Porque `100%` de L **sí** es `1.0`, así que `65%` y `0.65` coinciden.

Esa asimetría es la trampa. La misma palabra "porcentaje" significa dos cosas
distintas según el eje, y la regla del 0.4 aplica a la croma y a los ejes a/b
de `oklab()`.

## Lo que emite esta herramienta

Esta herramienta siempre emite la croma como **porcentaje**:

```css
oklch(50% 65% 29)    /* resuelve a croma absoluta 0.26 */
```

Si lo reescribís como `oklch(50% 0.65 29)` porque "65% parecía 0.65", obtenés
un color **2.5× más cromático** que el que ves en pantalla.

Cuando el navegador computa el estilo, convierte el porcentaje a número por
vos. Nunca hagas esa conversión a ojo.

## El rango completo

| Notación              | Croma absoluta |
| --------------------- | -------------- |
| `oklch(60% 0.15 29)`  | 0.15           |
| `oklch(60% 37.5% 29)` | 0.15           |
| `oklch(60% 15% 29)`   | 0.06           |
| `oklch(60% 100% 29)`  | 0.40           |

El rango útil de croma en sRGB es aproximadamente 0 a 0.32. Cualquier cosa
por encima de `80%` en la escala de porcentaje ya está fuera del gamut para
casi todos los tonos.
