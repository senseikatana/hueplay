---
title: "Fuera de gamut: lo que pedís y lo que ves"
description: CSS no recorta tus colores, los mapea. La insignia "Fuera de Gamut" mide la diferencia perceptual, no la contención.
order: 4
---

Cada color sRGB tiene exactamente un triple OKLCH: la conversión es
reversible. El problema va en la otra dirección — **muchos triples `oklch()`
no tienen representación sRGB en absoluto.**

## Los techos

El gamut sRGB llega hasta una croma de alrededor de **0.32**, cerca del magenta.
Y en luminancias medias el techo es bastante más bajo:

| Tono     | Croma máxima en sRGB con L = 50% |
| -------- | -------------------------------- |
| Rojo     | ~0.20                            |
| Amarillo | ~0.11                            |
| Cian     | ~0.09                            |
| Azul     | ~0.28                            |

Esto tiene una consecuencia incómoda: el slider de croma llega a `100%`
(= `0.4`), que está fuera del gamut para **todos** los tonos. Hasta el estado
por defecto, `oklch(50% 65% 29)`, ya supera el ~0.20 disponible para el rojo a
esa luminosidad.

## Lo que hace el navegador

CSS **conserva** el valor fuera de gamut como valor computado. Pero cuando lo
rasteriza sobre una pantalla sRGB lo mapea de vuelta. CSS Color 4 especifica un
algoritmo de **reducción de croma**: baja la croma, mantiene la luz y el tono.

Los motores más antiguos directamente recortan los canales, lo que **rota el
tono** — el azul se vuelve violeta. Por eso esta herramienta nunca recorta
canales: siempre reduce croma.

El píxel que ves, entonces, tiene **menos croma que el número que escribiste**.

## Cómo se mide la insignia

Acá está lo importante, y no es obvio.

La pregunta que la insignia tiene que responder no es _"¿cabe exactamente en
[0,1]?"_ sino **"¿el navegador me va a mostrar algo distinto de lo que
escribí?"**.

Eso se responde con una distancia perceptual, no con una comparación de rango:

```text
ΔE_OK = distancia euclidiana en OKLab entre
        el triple que pediste y el color realmente mostrado
```

El umbral es **0.01**, que es el piso del _just noticeable difference_ en
OKLab.

### Por qué importa, con un ejemplo real

El rojo puro de la herramienta es `oklch(62.8% 64.42% 29.23)`. Ese triple se
sale de `[0,1]` en luz lineal por unos 4e-5 — o sea, técnicamente "fuera de
gamut" según un test de contención. Pero su **ΔE es 0.00003**: el recorte es
completamente invisible.

Si la insignia lo marcara, tendrías una falsa alarma en el color más usado de
la herramienta, y en cada primaria.

Al revés: `oklch(50% 100% 30)` tiene **ΔE = 0.19**, que es perfectamente
visible. Eso sí se marca.

## Por qué el round-trip a través del gamut pierde información

Si copiás un píxel desde DevTools, o tomás un color de una captura, o lo
pasás por un selector nativo, el triple que te devuelven es **otro**. No es un
bug de conversión: es gamut mapping.

El color que pediste y el color que se muestra son el mismo _concepto_ con
valores distintos, y solo uno de los dos cabe en tu pantalla.
