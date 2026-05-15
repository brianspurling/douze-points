# Eurovision End Screen — Design Spec

## Overview

Replace the plain game-over overlay with a theatrical Eurovision-style reveal sequence. Score percentage maps to a Eurovision points tier; the reveal mimics the dramatic scoreboard announcement. Top scores get confetti, nul points gets a 💔 rain.

## Score Tier Mapping

| Score % | Points | French label |
|---|---|---|
| 0–19% | 0 | Nul points |
| 20–26% | 1 | Un point |
| 27–33% | 2 | Deux points |
| 34–40% | 3 | Trois points |
| 41–47% | 4 | Quatre points |
| 48–54% | 5 | Cinq points |
| 55–61% | 6 | Six points |
| 62–67% | 7 | Sept points |
| 68–73% | 8 | Huit points |
| 74–79% | 10 | Dix points |
| 80–100% | 12 | Douze points |

## Reveal Sequence

1. Overlay fades in (dark background). Score and Play Again button hidden.
2. Spokesperson text fades in (~0.5s fade):
   - Default: *"Ladies and gentlemen, Europe has voted…"*
   - Nul points: *"Oh dear… Europe has voted…"*
3. 1.5s dramatic pause.
4. Points label slams in — CSS scale animation (0.5 → 1.05 → 1.0, ~0.4s ease-out), large bold text.
5. Effect triggers simultaneously with slam:
   - **Douze points:** confetti cannon (two bursts, bottom-left and bottom-right, ~0.3s apart)
   - **Nul points:** 💔 rain (~20 hearts, CSS fall animation, 2–3s, then removed from DOM)
   - **All other tiers:** label only
6. Score and Play Again button fade in after 2s.

Total time from overlay appearing to Play Again button visible: ~5 seconds.

## Visual Design

### Label colours

| Tier | Colour |
|---|---|
| Nul points | `#c62828` (muted red) |
| 1–3 points | `#e65100` (dull orange) |
| 4–6 points | `#ffffff` (white) |
| 7–8 points | `#ffd600` (warm gold) |
| 10 points | `#ffab00` (bright gold) |
| Douze points | `#ffe57f` (brilliant gold) + text glow |

### Confetti palette
Blue (`#0093dd`), yellow (`#ffde00`), white (`#ffffff`) — Eurovision flag colours.

## Dependencies

- `canvas-confetti@1.9.3` from jsDelivr CDN (douze points only)
- No other new dependencies; 💔 rain is pure CSS/JS

## Implementation Scope

Changes confined to `index.html`:
- Add `canvas-confetti` `<script>` tag
- Add CSS for spokesperson fade, label slam, and 💔 rain keyframes
- Modify `showGameOver()` to run the sequence instead of immediately showing the overlay
- Add `getEurovisionTier(correct, total)` helper returning `{ points, label, colour }`
