# Points-Based Scoring — Design Spec

## Overview

Replace the existing "X / Y correct" chip with a Eurovision-style scoreboard widget positioned below the hamburger menu. Each correct guess awards +12 points; each wrong guess subtracts the great-circle distance in miles from the click to the nearest border of the asked-for country. The score is cumulative and may go negative. At game over, the final score (clamped to 0 from below) is scaled against the theoretical max (25 × 12 = 300) and mapped to the existing 11-band Eurovision tiers.

## Removed

- The `#score` chip (`X / Y correct`) at `top: 14px; right: 76px` and its container behaviour in `#right`.
- The `correct/total` percentage path through `getEurovisionTier`.

## Scoreboard Widget

### Position & visibility

- Lives top-right, directly below the hamburger menu — `position: fixed; top: 64px; right: 20px; z-index: 10`.
- Always visible from game start, showing `0` before any guesses have been made.
- Hidden during game-over overlay (overlay's `z-index: 20` covers it naturally).

### Visual style

Eurovision scoreboard chip — reuses the `.esc-entry` aesthetic (purple `#7040b0`, two-section layout, `font-variant-numeric: tabular-nums`).

```
┌──────────────────┐
│ POINTS │   240   │
└──────────────────┘
```

- Left section (label): "POINTS", smaller font, slight transparency to read as a label.
- Right section (value): big tabular-nums number, identical typography to `.esc-num`.
- Right-aligned to the hamburger (so the value cell sits flush under the hamburger's right edge).
- Smaller than the round-prompt chip — roughly 60–70% scale.
- Negative scores render with a minus sign (`-127`) in the same colour as positive — colour stays neutral on the resting value; transient feedback is in the delta chip.

### Mobile

- The widget stays in the same top-right slot. It does not move into the hamburger dropdown.
- Slightly smaller font so it doesn't crowd the map on narrow viewports.

## Scoring Math

### Correct guess

- `points += 12`
- Triggered when `reveal()` resolves `correct = true` — covers the polygon-contains case, the LEEWAY border buffer, and the tiny-country centroid bonus equally.

### Wrong guess

- `points -= round(d3.geoDistance([clickLon, clickLat], [borderLon, borderLat]) × 3959)`
- The "closest border point" is obtained by:
  1. Projecting the click to screen-space `[px, py]`.
  2. Passing it through the existing `nearestBorderPoint(feature, px, py)` helper, which samples the rendered SVG path with `getPointAtLength` and returns the closest sampled border point in screen-space.
  3. Inverting the screen-space point back to lon/lat via `projection.invert`.
- `d3.geoDistance` returns radians; multiplied by Earth's mean radius `3959` (statute miles) gives miles.
- `round()` to an integer for display and arithmetic.
- No floor — score can go negative.

### State

Adds `points: 0` to `state.score`. Existing `correct` and `total` are kept (used by share-text, sidebar, and the bracketed correct count in the game-over headline).

```js
state.score = { correct: 0, total: 0, points: 0 };
```

### Replay reconstruction

The share URL already encodes pins as `[name, correct, lon, lat]`. On `replayFromHash`, the points total is recomputed by replaying the same math: `+12` per correct pin, `-round(distance × 3959)` per wrong pin using the encoded lon/lat. No share-URL format bump.

## Delta Animation

When `reveal()` determines correctness, the delta chip animates *before* the existing 1000ms round-end timer (or 1800ms after wrong-guess pulse) fires. The animation must complete inside that window.

### Timeline

| Time (ms) | Event |
|---|---|
| 0 | Delta chip appears: `+12` (green) or `-127` (red). CSS transform `scale(0)` → `scale(1.15)` → `scale(1.0)`, cubic-bezier overshoot, ~300ms. |
| 0 | **Correct only:** canvas-confetti small burst at the chip's screen position (~30 particles, green + Eurovision-gold colours, modest spread). |
| 300 | Chip at rest; running total begins tweening from old → new value (`requestAnimationFrame` loop, ~500ms ease-out). |
| 800 | Chip fades + shrinks (`opacity: 0; transform: scale(0.9)`, ~200ms). |
| 1000 | Chip removed from DOM. |

Total animation: ~1000ms. Fits inside the correct-guess `nextDelay = 1000ms` window. For wrong guesses (with pan + pulse, `nextDelay ≈ 1800–2650ms`) it finishes well before the next round starts.

### Delta chip styling

- Positioned just below the scoreboard chip, right-aligned to its right edge (e.g. `position: fixed; right: 20px; top: ~110px`). Below avoids collision with the hamburger button (which occupies `top: 14–50px`).
- During its lifetime, the chip drifts upward via `translateY(0) → translateY(-12px)` — visually rising toward the scoreboard's value cell as it fades.
- Same chip aesthetic as the scoreboard but smaller; background tinted by sign:
  - `+12`: green background tint, white text.
  - `-127`: red background tint, white text.
- Number font matches scoreboard value typography (tabular-nums, bold).
- Confetti origin: the chip's centre converted to canvas-confetti's normalized `[0, 1]` viewport coords.

### Count animation

Tween `state.score.points` between old and new value over ~500ms, updating the displayed text each frame. `Math.round()` each frame so the number reads as ticking integers. Use `requestAnimationFrame` rather than CSS transitions because the text content needs to update, not just opacity/transform.

## Game Over Tier Mapping

`getEurovisionTier` is reworked to accept the points total directly:

```js
function getEurovisionTier(points) {
  const clamped = Math.max(0, points);
  const pct = (clamped / 300) * 100;
  // identical band thresholds to today, just measured against pct of 300
  if (pct < 20) return { points: 0,  label: 'Nul points',    colour: '#c62828' };
  // ...etc, unchanged
}
```

The 11 bands are unchanged in shape — they're just measured against `max(0, points) / 300` instead of `correct / total`.

| Points (of 300) | Tier |
|---|---|
| ≤ 0 or < 60 | Nul points |
| 60 – 80 | Un point |
| 81 – 101 | Deux points |
| 102 – 122 | Trois points |
| 123 – 143 | Quatre points |
| 144 – 164 | Cinq points |
| 165 – 185 | Six points |
| 186 – 203 | Sept points |
| 204 – 221 | Huit points |
| 222 – 248 | Dix points |
| ≥ 249 | Douze points |

(Boundaries match the existing percentage thresholds projected onto 300.)

### Headline format

The overlay's `#final-score` element shows the total points with the correct count in brackets:

```
240 (15 / 25)
```

- Big number = `points` (negative shown with leading minus, e.g. `-83`).
- Bracketed text = `correct / total` in smaller, dimmer typography.
- Existing tier label (`Douze points`, etc.) and animation sequence above it are unchanged.

## Touched Functions / Elements

- `state` — adds `points`.
- `updateScore()` — re-targeted to update the new widget's value cell rather than the old text chip; also handles count-animation on transition.
- `reveal()` — computes wrong-guess distance via `nearestBorderPoint` + `geoDistance`, updates `state.score.points`, triggers delta-chip + confetti.
- `getEurovisionTier(points)` — signature change.
- `showGameOver()` — `final-score` content becomes `${points} (${correct} / ${total})`.
- `replayFromHash()` — recomputes `state.score.points` from pins.
- `init()` test-mode path — sets `points` to match the synthesised pins.
- `startGame()` — resets `points: 0`, removes any leftover delta chip.
- HTML: `#score` removed; new `#scoreboard` + `#score-delta` elements added.
- CSS: new rules for `#scoreboard`, `#score-delta`, count/scale animations. `#right` container simplified (only contains New Game button now).

## Out of Scope

- No change to leeway / tiny-country detection — those still count as correct (+12).
- No change to the pin colours, sidebar, joyride, or share URL format.
- No change to the existing game-over reveal sequence (spokesperson → slam → confetti / hearts → score) beyond the headline text.
