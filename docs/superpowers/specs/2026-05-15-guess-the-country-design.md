# Guess the Country — Design Spec
_2026-05-15_

## Overview

A single-file, client-side-only HTML geography game. The player is shown a map of Europe and asked to click on a named EU country. After a short delay the correct country fills in and the pin is coloured green (correct) or red (wrong). The game tracks a running score across all 27 EU countries, with all history visible on the map until "New Game" is pressed.

---

## File Structure

```
index.html   ← entire game: HTML + inline CSS + inline JS
```

No build step, no server. Open in a browser directly.

**CDN dependencies (loaded at runtime):**
- D3 v7 — `https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js`
- TopoJSON client — `https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js`
- World atlas data — `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`

---

## Map Rendering

- Full-viewport SVG element, no scrollbars.
- Projection: `d3.geoMercator()`, centred on Europe, scaled to fill the viewport. Recentred/rescaled on window resize.
- **Non-EU countries:** dim neutral (`#ccc` / dark mode equivalent) — visible for geographic context.
- **EU countries (unplayed):** slightly lighter neutral (`#e8e8e8`).
- **EU countries (revealed correct):** green fill (`#4caf50`).
- **EU countries (revealed wrong):** red fill (`#e53935`).
- Thin dark stroke (`#666`, 0.5px) on all country borders.

EU membership: the 27 current member states (post-Brexit, no UK).

---

## Game State

```js
{
  remaining: [],   // shuffled array of EU country feature objects not yet played
  current: null,   // feature object for the active round
  score: { correct: 0, total: 0 },
  pins: [],        // { x, y, correct, name } — screen coords + result
  phase: 'loading' | 'waiting' | 'clicked' | 'revealed'
}
```

---

## Round Loop

1. **Start round:** pop `current` from `remaining`, set `phase = 'waiting'`, show prompt "Click on: **[Country Name]**".
2. **User clicks SVG:** convert screen coords → geographic coords via projection invert. Drop a pin (grey/neutral while pending). Lock further clicks (`phase = 'clicked'`).
3. **After 1500ms:** run `d3.geoContains(current, [lon, lat])`. Fill `current` country (green or red). Colour pin (green or red). Add to `pins`. Increment `score`. Set `phase = 'revealed'`.
4. **After further 1000ms:** if `remaining` is empty → show end-of-game summary overlay. Otherwise advance to next round (step 1).

---

## Win/Lose Detection

`d3.geoContains(feature, [longitude, latitude])` — uses the actual GeoJSON boundary, no custom math.

Coordinates come from `projection.invert([screenX, screenY])`.

---

## Pins

Rendered in a dedicated SVG `<g class="pins">` layer on top of country paths.

Each pin:
- `<circle>` at `(x, y)`, radius 6px, filled green/red (or neutral while `phase = 'clicked'`)
- `<text>` below the circle showing the country name that was asked for

---

## UI Chrome

**Top bar (fixed, above SVG):**
- Left: prompt text — "Click on: **France**" or "Game Over!"
- Right: score — "3 / 7 correct" and "New Game" button

**End-of-game overlay:**
- Centred modal showing final score (e.g. "18 / 27 correct")
- "Play Again" button — same as New Game

**New Game / Play Again:**
- Reshuffles `remaining` with all 27 EU countries
- Resets score to `{ correct: 0, total: 0 }`
- Clears all pins from SVG
- Resets all country fills to unplayed neutral
- Starts round 1

---

## EU Country List (ISO 3166-1 numeric codes, used to filter world-atlas)

Austria (40), Belgium (56), Bulgaria (100), Croatia (191), Cyprus (196), Czechia (203), Denmark (208), Estonia (233), Finland (246), France (250), Germany (276), Greece (300), Hungary (348), Ireland (372), Italy (380), Latvia (428), Lithuania (440), Luxembourg (442), Malta (470), Netherlands (528), Poland (616), Portugal (620), Romania (642), Slovakia (703), Slovenia (705), Spain (724), Sweden (752).

---

## Non-Goals

- No tile maps / satellite imagery
- No animations beyond fill transitions
- No localStorage / persistence across sessions
- No mobile touch optimisation (mouse-first)
