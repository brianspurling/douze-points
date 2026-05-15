# Guess the Country — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file client-side HTML geography game where the player clicks EU countries on a Europe map to score points.

**Architecture:** One `index.html` file with inline CSS and JS. D3 v7 renders a full-viewport SVG map using Mercator projection fitted to a Europe bounding box. TopoJSON world-atlas data provides country boundaries. Game state lives in a plain JS object; the DOM/SVG is updated imperatively after each state change. Pins store geographic coordinates so they reproject correctly on window resize.

**Tech Stack:** D3 v7, TopoJSON client v3, world-atlas v2 (all via jsDelivr CDN). No build step. Open `index.html` directly in a browser.

---

## File Map

| File | Role |
|------|------|
| `index.html` | Everything — HTML structure, inline CSS, inline JS |

---

### Task 1: HTML Skeleton

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html with full structure and styles**

Write this as the complete file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Guess the Country</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f1923; color: #eee; font-family: system-ui, sans-serif; overflow: hidden; }

    #topbar {
      position: fixed; top: 0; left: 0; right: 0; height: 56px;
      background: #16213e; display: flex; align-items: center;
      justify-content: space-between; padding: 0 24px; z-index: 10;
      border-bottom: 1px solid #2a3a5c;
    }
    #prompt { font-size: 1.15rem; }
    #prompt strong { color: #f0c040; }
    #right { display: flex; align-items: center; gap: 16px; }
    #score { font-size: 0.95rem; opacity: 0.75; }
    #new-game {
      background: #e94560; border: none; color: #fff;
      padding: 7px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;
    }
    #new-game:hover { background: #c73652; }

    #map { display: block; position: fixed; top: 56px; left: 0; }

    #overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.72);
      display: flex; align-items: center; justify-content: center; z-index: 20;
    }
    #overlay.hidden { display: none; }
    #overlay-box {
      background: #16213e; border-radius: 12px;
      padding: 48px 64px; text-align: center; border: 1px solid #2a3a5c;
    }
    #final-score { font-size: 2.4rem; font-weight: bold; margin-bottom: 6px; }
    #final-label { font-size: 1rem; opacity: 0.6; margin-bottom: 28px; }
    #play-again {
      background: #4caf50; border: none; color: #fff;
      padding: 12px 36px; border-radius: 4px; cursor: pointer; font-size: 1rem;
    }
    #play-again:hover { background: #3d8b40; }

    .pin-label { font-size: 10px; fill: #fff; text-anchor: middle; pointer-events: none; }
  </style>
</head>
<body>
  <div id="topbar">
    <span id="prompt">Loading map…</span>
    <div id="right">
      <span id="score"></span>
      <button id="new-game">New Game</button>
    </div>
  </div>
  <svg id="map"></svg>
  <div id="overlay" class="hidden">
    <div id="overlay-box">
      <div id="final-score"></div>
      <div id="final-label">correct</div>
      <button id="play-again">Play Again</button>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
  <script>
    // game code goes here
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify structure**

Open `index.html` (double-click the file or `open index.html` on Mac).

Expected:
- Dark background (#0f1923)
- Top bar visible, reading "Loading map…"
- Red "New Game" button top-right
- No scrollbars
- Main area is empty (JS stub does nothing yet)

- [ ] **Step 3: Commit**

```bash
cd /Users/Cogo/_claude/guess-the-country
git init
git add index.html
git commit -m "feat: HTML skeleton with styles and CDN script tags"
```

---

### Task 2: Map Rendering

**Files:**
- Modify: `index.html` — replace `// game code goes here` with map rendering code

- [ ] **Step 1: Replace the JS stub with constants, SVG setup, and map loader**

Replace `// game code goes here` with:

```js
const TOPBAR_H = 56;

const EU_IDS = new Set([
  40, 56, 100, 191, 196, 203, 208, 233, 246, 250,
  276, 300, 348, 372, 380, 428, 440, 442, 470, 528,
  616, 620, 642, 703, 705, 724, 752
]);

const EU_NAMES = {
  40: 'Austria',     56: 'Belgium',     100: 'Bulgaria',  191: 'Croatia',
  196: 'Cyprus',    203: 'Czechia',     208: 'Denmark',   233: 'Estonia',
  246: 'Finland',   250: 'France',      276: 'Germany',   300: 'Greece',
  348: 'Hungary',   372: 'Ireland',     380: 'Italy',     428: 'Latvia',
  440: 'Lithuania', 442: 'Luxembourg',  470: 'Malta',     528: 'Netherlands',
  616: 'Poland',    620: 'Portugal',    642: 'Romania',   703: 'Slovakia',
  705: 'Slovenia',  724: 'Spain',       752: 'Sweden'
};

// Bounding box that frames Europe for the Mercator projection
const EUROPE_FEATURE = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[
    [-25, 34], [45, 34], [45, 71], [-25, 71], [-25, 34]
  ]]}
};

const svg           = d3.select('#map');
const countriesGroup = svg.append('g').attr('class', 'countries');
const pinsGroup      = svg.append('g').attr('class', 'pins');

let projection, pathGen, allFeatures;

function mapSize() {
  return [window.innerWidth, window.innerHeight - TOPBAR_H];
}

function buildProjection([w, h]) {
  return d3.geoMercator().fitSize([w, h], EUROPE_FEATURE);
}

function euFill(feature) {
  return EU_IDS.has(+feature.id) ? '#3a4a6b' : '#1e2a3a';
}

async function init() {
  const topo = await d3.json(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  );
  allFeatures = topojson.feature(topo, topo.objects.countries).features;

  const [w, h] = mapSize();
  svg.attr('width', w).attr('height', h);
  projection = buildProjection([w, h]);
  pathGen    = d3.geoPath().projection(projection);

  countriesGroup.selectAll('path')
    .data(allFeatures)
    .join('path')
      .attr('d', pathGen)
      .attr('fill', euFill)
      .attr('stroke', '#4a5a7a')
      .attr('stroke-width', 0.5);

  document.getElementById('prompt').textContent = 'Map loaded — click New Game to play';
}

init();
```

- [ ] **Step 2: Verify map renders in browser**

Refresh the browser.

Expected:
- Europe map fills the area below the top bar
- EU countries are slightly lighter blue-grey (#3a4a6b) vs non-EU darker (#1e2a3a)
- Country borders visible
- Prompt updates from "Loading map…" to "Map loaded — click New Game to play"
- Russia, Turkey, North Africa are visible but darker for geographic context

If the map doesn't appear: open DevTools → Console and check for fetch errors (CDN connectivity, CORS, etc.). The file:// protocol is fine for these jsDelivr CDN calls.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: render Europe map via D3 + TopoJSON world-atlas"
```

---

### Task 3: Game State and Round Loop

**Files:**
- Modify: `index.html` — add state object, game functions, and button listeners after `init();`

- [ ] **Step 1: Add state object and helper functions**

After the `init();` line, add:

```js
// ── State ───────────────────────────────────────────────────────────────
let state = {
  remaining: [],
  current:   null,
  score:     { correct: 0, total: 0 },
  pins:      [],    // { lon, lat, correct, name }
  phase:     'idle',
};

// ── Helpers ─────────────────────────────────────────────────────────────
function currentName() {
  return EU_NAMES[+state.current.id];
}

function setPrompt(html) {
  document.getElementById('prompt').innerHTML = html;
}

function updateScore() {
  const el = document.getElementById('score');
  el.textContent = state.score.total > 0
    ? `${state.score.correct} / ${state.score.total} correct`
    : '';
}
```

- [ ] **Step 2: Add startGame and startRound**

Immediately after the helpers:

```js
// ── Round loop ──────────────────────────────────────────────────────────
function startGame() {
  const euFeatures = allFeatures.filter(f => EU_IDS.has(+f.id));
  state.remaining = d3.shuffle([...euFeatures]);
  state.score     = { correct: 0, total: 0 };
  state.pins      = [];
  state.phase     = 'idle';

  countriesGroup.selectAll('path').attr('fill', euFill);
  pinsGroup.selectAll('*').remove();
  document.getElementById('overlay').classList.add('hidden');
  updateScore();
  startRound();
}

function startRound() {
  state.current = state.remaining.pop();
  state.phase   = 'waiting';
  setPrompt(`Click on: <strong>${currentName()}</strong>`);
}
```

- [ ] **Step 3: Wire up New Game and Play Again buttons**

Immediately after `startRound`:

```js
document.getElementById('new-game').addEventListener('click', () => {
  if (allFeatures) startGame();
});
document.getElementById('play-again').addEventListener('click', () => {
  if (allFeatures) startGame();
});
```

- [ ] **Step 4: Verify in browser**

Refresh and click **New Game**.

Expected:
- Prompt changes to "Click on: **[Country Name]**" with the name highlighted yellow
- Score display is empty
- Clicking New Game again reshuffles and shows a new (possibly different) country name
- Map looks the same, no pins yet

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: game state, shuffle, round loop, button wiring"
```

---

### Task 4: Click Handler, Pin Drop, and Reveal

**Files:**
- Modify: `index.html` — add `renderPins`, `reveal`, click handler, and `showGameOver` after the button listeners

- [ ] **Step 1: Add renderPins**

After the button listeners, add:

```js
// ── Pins ────────────────────────────────────────────────────────────────
function renderPins() {
  pinsGroup.selectAll('*').remove();
  state.pins.forEach(({ lon, lat, correct, name }) => {
    const [cx, cy] = projection([lon, lat]);
    const g = pinsGroup.append('g');
    g.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', 7)
      .attr('fill', correct ? '#4caf50' : '#e53935')
      .attr('stroke', '#fff').attr('stroke-width', 1.5);
    g.append('text')
      .attr('class', 'pin-label')
      .attr('x', cx).attr('y', cy + 19)
      .text(name);
  });
}
```

- [ ] **Step 2: Add reveal**

Immediately after `renderPins`:

```js
// ── Reveal ──────────────────────────────────────────────────────────────
function reveal(lon, lat, pendingCircle) {
  const feature = state.current;
  const name    = currentName();
  const correct = d3.geoContains(feature, [lon, lat]);

  countriesGroup.selectAll('path')
    .filter(d => +d.id === +feature.id)
    .attr('fill', correct ? '#4caf50' : '#e53935');

  pendingCircle.remove();
  state.pins.push({ lon, lat, correct, name });
  renderPins();

  state.score.total++;
  if (correct) state.score.correct++;
  state.phase = 'revealed';
  updateScore();

  setTimeout(() => {
    if (state.remaining.length === 0) {
      showGameOver();
    } else {
      startRound();
    }
  }, 1000);
}
```

- [ ] **Step 3: Add SVG click handler**

After `reveal`:

```js
// ── Click handler ───────────────────────────────────────────────────────
svg.on('click', function (event) {
  if (state.phase !== 'waiting') return;

  const [sx, sy] = d3.pointer(event);
  const [lon, lat] = projection.invert([sx, sy]);

  state.phase = 'clicked';

  const pending = pinsGroup.append('circle')
    .attr('cx', sx).attr('cy', sy).attr('r', 7)
    .attr('fill', '#aaa')
    .attr('stroke', '#fff').attr('stroke-width', 1.5);

  setTimeout(() => reveal(lon, lat, pending), 1500);
});
```

- [ ] **Step 4: Add showGameOver**

After the click handler:

```js
// ── Game over ───────────────────────────────────────────────────────────
function showGameOver() {
  state.phase = 'gameover';
  setPrompt('Game over!');
  document.getElementById('final-score').textContent =
    `${state.score.correct} / ${state.score.total}`;
  document.getElementById('overlay').classList.remove('hidden');
}
```

- [ ] **Step 5: Play through a full game in the browser**

Refresh, click **New Game**, then click somewhere for each country.

Expected sequence per round:
1. Grey pending pin appears at click point immediately
2. After ~1.5s: target country fills green (correct) or red (wrong); pin turns the same colour; country name label appears below pin; score updates (e.g. "1 / 1 correct")
3. After ~1s more: next prompt appears

After all 27 rounds:
- Overlay appears with "X / 27" and "Play Again" button
- "Play Again" resets and reshuffles correctly
- All previous pins and fills are cleared

Note: Small countries (Malta, Luxembourg, Cyprus) have lower-resolution boundaries in the 110m dataset — being just outside the boundary is acceptable for this version.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: click-to-pin, reveal with country fill, score tracking, game over overlay"
```

---

### Task 5: Window Resize

**Files:**
- Modify: `index.html` — add resize handler after `showGameOver`

- [ ] **Step 1: Add resize handler**

After `showGameOver`, add:

```js
// ── Resize ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const [w, h] = mapSize();
  svg.attr('width', w).attr('height', h);
  projection = buildProjection([w, h]);
  pathGen    = d3.geoPath().projection(projection);
  countriesGroup.selectAll('path').attr('d', pathGen);
  renderPins();
});
```

- [ ] **Step 2: Verify resize in browser**

With a game in progress (some pins placed, some countries filled), resize the browser window.

Expected:
- SVG expands/contracts to fill the new viewport
- Country shapes reproject correctly
- Existing pins move to the correct geographic positions (stored as lon/lat, reprojected on render)
- Top bar remains fixed at top
- Game state is unaffected (score, phase, remaining rounds unchanged)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: reproject map and rerender pins on window resize"
```
