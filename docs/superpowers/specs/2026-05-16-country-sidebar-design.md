# Country Sidebar — Design Spec

## Overview

Replace today's "cycle through every country" game flow with a fixed-length **25-round** game, surfaced through a vertical **sidebar on the left of the screen**. The sidebar groups the 25 sampled countries into four implicit zones (current, to-do, correct, wrong) so the player can see what's been done, what's coming, and how they're doing — at a glance.

On mobile the sidebar is hidden behind an expand button on the existing current-country chip; tapping it unfurls a flag-only column upward along the left edge.

## Game Flow Changes

### Pool sampling
- New constant `ROUND_COUNT = 25`.
- On `startGame`: `pool = d3.shuffle([...europeFeatures]).slice(0, Math.min(ROUND_COUNT, europeFeatures.length))`.
- The whole game is played against this 25-country pool. Other countries in the set are not shown in the sidebar.

### Round selection
- Each round's `current` is picked **randomly** from the pool's remaining to-do entries (not in any sorted order — the surprise is part of the game).
- `state.remaining` (today's playable queue) goes away. Remaining-to-do is derived as `pool.filter(f => status.get(f) === 'todo')`.

### End condition
- Game over when every entry in `pool` has `status` of `'correct'` or `'wrong'` (no entries left in to-do). Triggers the existing Eurovision game-over overlay unchanged.

## State Shape

```js
state = {
  pool: [feature, ...25],          // sampled at game start, fixed for the game
  current: feature,                // currently being asked (NOT in status map)
  status: Map<feature, 'todo' | 'correct' | 'wrong'>,
  pins: [...],                     // unchanged — kept for map rendering & share hash
  pendingClick: null,
  phase: 'idle' | 'waiting' | 'clicked' | 'revealed' | 'gameover',
};
```

The `current` feature is removed from `status` while it's the active prompt, and put back into `status` with `'correct'` or `'wrong'` on reveal. This keeps the four zones cleanly derivable from `pool` + `status` + `current`.

## Sidebar Structure

Vertically stacked, top to bottom. **No explicit dividers** — grouping is visual only via styling and order.

1. **Current chip** (1 entry) — the existing purple `.esc-entry` chip with number + flag + name. Pinned at the top.
2. **To-do pile** (alphabetical by `feature.properties.name`) — upcoming countries, dimmed.
3. **Correct pile** (alphabetical) — done & right, green ring around flag.
4. **Wrong pile** (alphabetical) — done & wrong, red ring around flag.

## Visual Details

### Desktop sidebar

- Position: `fixed; top: 0; left: 0; bottom: 0; z-index: 10;`
- Width: 240px (room for flag + longest names like "Bosnia and Herz.")
- Background: `rgba(15,25,35,0.75)` (semi-transparent over the map)
- Vertical flex column, ~6px gap; vertical scroll if 25 entries overflow on short viewports
- Internal padding: ~12px
- Current chip sits at the top, with a small extra margin (~16px) separating it from the piles below

### Non-current entries (desktop)

- Row: ~32px tall, flex row containing a flag-box + name
- Flag-box: 32×24, `border-radius: 4px`, flag emoji at ~18px font-size inside
- Name: 14px, white text, ~6px left padding from flag-box

| State | Styling |
|---|---|
| To-do | Row at `opacity: 0.4` |
| Correct | Full opacity, flag-box `box-shadow: 0 0 0 2px #4caf50` |
| Wrong | Full opacity, flag-box `box-shadow: 0 0 0 2px #e53935` |

Hover: subtle brighten on the row. No click action on done/to-do entries in v1.

### Mobile collapsed

- Sidebar hidden entirely.
- Current chip becomes **left-aligned, content-width** (drops today's `right: 10px` so short names don't leave empty space).
- A small up-arrow button (`▲`) sits **directly above the "01" number block** on the chip — like a pull tab on the corner. ~16px square.

### Mobile expanded

- Container: `fixed; left: 0; top: ~50px; bottom: <chip top>;` — narrow column ~56px wide, semi-transparent backdrop matching desktop.
- 24 flag-boxes stacked vertically, **scaled to fit** the available vertical span. Each ~26–30px tall on a typical phone (24 flags × ~28px ≈ 672px, fits between top of screen and chip).
- Flag-boxes use the same ring/dim styling as desktop, but **no name** beside them.
- Tap a flag → name floats as a tooltip to the right of the flag for ~1.5s, then fades.
- Up-arrow button on the chip flips to `▼` while expanded. Tap to collapse.
- Stays open across round transitions; flags re-flow into new positions as the game proceeds.
- **Map clicks beneath the expanded column**: the column's backdrop is `pointer-events: none` so map clicks pass through; only the flag-boxes themselves intercept pointer events (for the tooltip). This means the player can still click on western Europe (UK, Ireland, Portugal, Spain) without first closing the column.

### Top-of-screen UI on mobile

- **New Game** → moves into the hamburger menu (alongside Eurovision/Europe).
- **Score** → moves to top-right next to the ☰ menu, freeing the top-left for the expanded column.
- **Menu** stays top-right (unchanged).

## Transitions

When a round completes and the sidebar's contents change (current moves to a done pile, next current rises from to-do):

- **FLIP technique** (First-Last-Invert-Play):
  1. Capture each entry's `getBoundingClientRect()` before re-render.
  2. Re-render with the new layout.
  3. For each entry that existed before, compute `(dx, dy)` from old → new position.
  4. Apply `transform: translate(dx, dy)` initially (inverse), then transition to `translate(0,0)` over ~300ms ease-out.
- Sequencing per round:
  1. Click → 750ms pending state (existing).
  2. Reveal: country fills green/red on map (existing).
  3. ~300ms sidebar FLIP transition (current entry drops to its done pile position; next current rises to top).
  4. New round prompt updates.

If FLIP turns out fiddly in implementation (e.g., issues with the mobile dynamic-height flag column), fall back to a snap-and-fade (instant re-render with a quick opacity fade on the affected entries). Animation is polish; correctness comes first.

## Joyride

No changes. The first-time joyride tooltip currently points to the chip's top-left area (top:90px below the chip on desktop; bottom:110px above the chip on mobile). The chip stays at top-left on desktop and bottom-left on mobile, so the existing anchors still work. The mobile chip becoming content-width doesn't move its left edge, so the triangle pointer (`left: 28px` inside the joyride box) still lands on the chip.

## Backwards Compatibility

### Share / replay (`#s=` hash)

- The hash format (`{s, p: [[name, correct, lon, lat], ...]}`) is unchanged.
- New games encode 25 pins instead of 44/45.
- Replay handler should populate `pool` and `status` from the pins (treat all pins as done) so the sidebar renders correctly in game-over state. No "current chip" is shown — replays start in `phase: 'gameover'`.
- Old shared links with 44/45 pins still work; the sidebar's render code derives zones from the pool/status/current, so any pool size is fine.
- In game-over/replay state (`state.current === null`), the sidebar omits the current chip entirely — the to-do pile (typically empty), correct pile, and wrong pile render directly from the top. On mobile, the expand button has nothing to anchor to in game-over state, so the sidebar collapses to nothing visible (the player can see the full results on the game-over overlay or by closing it and seeing the map's filled countries / pins).

### Test URL (`?test=c/t`)

- Today: shuffles `europeFeatures`, takes `t`, marks first `c` correct, jumps to game-over.
- New: sample `Math.min(t, ROUND_COUNT)` features, mark `c` correct and the rest wrong, populate `pool`/`status` accordingly, render the sidebar in its final game-over state, show game-over.

## Unchanged Behavior

- Map rendering, projection, zoom/pan, click handling
- Border leeway and tiny-country radius bonus on `reveal`
- Pin rendering on the map (green/red dots + labels)
- Country fill on reveal (green/red)
- Pan-to-feature + pulse animation for off-screen / tiny countries when wrong
- Game-over overlay: Eurovision tier (`getEurovisionTier`), Graham audio, confetti for douze, hearts for nul
- Share button behavior (`shareGame`)
- Round number on the chip (`01`–`25` now, derived from `score.total + 1` as today)
- Country-set switching mid-game (calls `startGame` which re-samples the pool from the new set)

## Out of Scope for v1

- Clicking a done entry in the sidebar to pan/zoom to that country on the map
- Configurable `ROUND_COUNT` per set
- Section dividers / header labels (✓/✗) between zones
- Animated entry for the very first round at game start (sidebar can just snap into existence)
