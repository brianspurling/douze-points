# Country Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's "play every country in the set" cycle with a fixed 25-round game surfaced through a left-edge sidebar (current / to-do / correct / wrong). Mobile hides the sidebar behind an expand button on the existing chip; tapping it unfurls a flag-only column upward along the left edge.

**Architecture:** All changes stay in the project's single `index.html` (inline HTML + CSS + JS). The state refactor introduces `state.pool: Array<feature>` and `state.status: Map<feature, 'todo'|'correct'|'wrong'>` replacing today's `state.remaining` queue. A new `<aside id="sidebar">` element wraps the existing chip and a new `<div id="entries">` list; a new `renderSidebar()` function derives the four visual zones from pool/status/current and re-renders on each state change. FLIP animation handles the "drops into alphabetical position" motion.

**Tech Stack:** Vanilla HTML/CSS/JS, D3 v7 (already loaded via jsDelivr), topojson-client (already loaded). No build step. No automated test framework — verification is manual via the browser preview tools (`preview_start`, `preview_resize`, `preview_screenshot`, `preview_snapshot`).

**Spec:** [`docs/superpowers/specs/2026-05-16-country-sidebar-design.md`](../specs/2026-05-16-country-sidebar-design.md)

---

## File Structure

Single file modified: `index.html`. All HTML, CSS, JS inline.

**HTML additions:**
- New `<aside id="sidebar">` wrapping the existing `<span id="prompt">` and a new `<div id="entries">` container.
- New `<button class="expand-btn">` inside the chip's rendered HTML (mobile-only).
- New `<div class="menu-divider">` + `<div class="menu-item" id="menu-new-game">` inside the hamburger dropdown.

**CSS additions/changes:**
- New `#sidebar`, `#entries`, `.entry`, `.entry-flag`, `.entry-name`, `.expand-btn`, `.flag-tooltip`, `.menu-divider` rules.
- Updates to existing `#prompt` (no longer fixed-positioned), `#right` mobile rules (move score to top-right, hide new game button).
- New `@media (max-width: 700px)` rules for collapsed/expanded sidebar states.

**JS additions/changes:**
- New `ROUND_COUNT` constant.
- `state` shape changes: drop `remaining`, add `pool` and `status`.
- `startGame`, `startRound`, `reveal`, `replayFromHash`, `?test=` handler updated to use new state.
- New `renderSidebar()` function (with FLIP animation by Task 5).
- New event handlers for expand button and flag-tap tooltip.
- New menu handler for "New Game" menu item.

---

## Tasks

### Task 1: State refactor — pool + status + 25-round cap

**Files:**
- Modify: `index.html` (JS section)

**Goal:** Replace `state.remaining` queue with `state.pool` + `state.status` Map. Cap the game at 25 rounds. Chip-based UI stays unchanged for now — sidebar comes in later tasks. Game should be fully playable end-to-end with everything else looking identical to today.

- [ ] **Step 1: Add `ROUND_COUNT` constant.**

Find line ~207 in `index.html`:

```js
const TOPBAR_H = 0;
```

Add immediately below:

```js
const ROUND_COUNT = 25;
```

- [ ] **Step 2: Update `state` shape — replace `remaining` with `pool` + `status`.**

Find the state declaration (~line 326):

```js
let state = {
  remaining: [],
  current:   null,
  score:     { correct: 0, total: 0 },
  pins:      [],    // { lon, lat, correct, name }
  pendingClick: null,
  phase:     'idle',
};
```

Replace with:

```js
let state = {
  pool:      [],           // Array<feature> — the 25 sampled countries for this game
  status:    new Map(),    // Map<feature, 'todo'|'correct'|'wrong'> — current is NOT in here
  current:   null,
  score:     { correct: 0, total: 0 },
  pins:      [],           // { lon, lat, correct, name } — unchanged
  pendingClick: null,
  phase:     'idle',
};
```

- [ ] **Step 3: Update `startGame` to sample the pool and init status.**

Find `startGame` (~line 460):

```js
state.remaining = d3.shuffle([...europeFeatures]);
state.score     = { correct: 0, total: 0 };
state.pins      = [];
state.pendingClick = null;
state.phase     = 'idle';
```

Replace with:

```js
state.pool      = d3.shuffle([...europeFeatures]).slice(0, Math.min(ROUND_COUNT, europeFeatures.length));
state.status    = new Map(state.pool.map(f => [f, 'todo']));
state.current   = null;
state.score     = { correct: 0, total: 0 };
state.pins      = [];
state.pendingClick = null;
state.phase     = 'idle';
```

- [ ] **Step 4: Update `startRound` to pick a random to-do feature.**

Find `startRound` (~line 479):

```js
function startRound() {
  state.current = state.remaining.pop();
  state.phase   = 'waiting';
  ...
}
```

Replace the line `state.current = state.remaining.pop();` with:

```js
const todo = state.pool.filter(f => state.status.get(f) === 'todo');
state.current = todo[Math.floor(Math.random() * todo.length)];
state.status.delete(state.current);
```

- [ ] **Step 5: Update `reveal` to record status and check end condition against status.**

Find `reveal` (~line 700). Locate this block:

```js
state.phase = 'revealed';
updateScore();
```

Add immediately after:

```js
state.status.set(state.current, correct ? 'correct' : 'wrong');
```

Then find the end-of-round logic at the bottom of `reveal` (~line 756):

```js
setTimeout(() => {
  if (state.remaining.length === 0) {
    showGameOver();
  } else {
    startRound();
  }
}, nextDelay);
```

Replace with:

```js
setTimeout(() => {
  const remaining = state.pool.filter(f => state.status.get(f) === 'todo');
  if (remaining.length === 0) {
    showGameOver();
  } else {
    startRound();
  }
}, nextDelay);
```

- [ ] **Step 6: Update the `?test=c/t` URL handler.**

Find the test block in `init` (~line 299):

```js
if (p.has('test')) {
  const [c, t] = (p.get('test') || '40/40').split('/').map(Number);
  const chosen = d3.shuffle([...europeFeatures]).slice(0, t);
  const pins = chosen.map((feat, idx) => {
    const [lon, lat] = d3.geoCentroid(feat);
    return { name: feat.properties.name, correct: idx < c, lon, lat };
  });
  state.pins = d3.shuffle(pins);
  state.score = { correct: c, total: t };
  state.pins.forEach(pin => {
    const feature = europeFeatures.find(f => f.properties.name === pin.name);
    if (feature) {
      countriesGroup.selectAll('path')
        .filter(d => d === feature)
        .attr('fill', pin.correct ? '#4caf50' : '#e53935');
    }
  });
  renderPins();
  showGameOver();
}
```

Replace with:

```js
if (p.has('test')) {
  const [c, t] = (p.get('test') || '40/40').split('/').map(Number);
  const cap = Math.min(t, ROUND_COUNT, europeFeatures.length);
  const cCapped = Math.min(c, cap);
  const chosen = d3.shuffle([...europeFeatures]).slice(0, cap);
  const pins = chosen.map((feat, idx) => {
    const [lon, lat] = d3.geoCentroid(feat);
    return { name: feat.properties.name, correct: idx < cCapped, lon, lat };
  });
  state.pool    = chosen;
  state.status  = new Map(chosen.map((f, i) => [f, i < cCapped ? 'correct' : 'wrong']));
  state.current = null;
  state.pins    = d3.shuffle(pins);
  state.score   = { correct: cCapped, total: cap };
  state.pins.forEach(pin => {
    const feature = europeFeatures.find(f => f.properties.name === pin.name);
    if (feature) {
      countriesGroup.selectAll('path')
        .filter(d => d === feature)
        .attr('fill', pin.correct ? '#4caf50' : '#e53935');
    }
  });
  renderPins();
  showGameOver();
}
```

- [ ] **Step 7: Update `replayFromHash` to populate `pool` and `status`.**

Find `replayFromHash` (~line 600). Locate this block:

```js
state.pins = data.p.map(([n, c, x, y]) => ({ name: n, correct: c === 1, lon: x, lat: y }));
state.score = {
  correct: state.pins.filter(p => p.correct).length,
  total:   state.pins.length,
};
state.remaining = [];
state.phase = 'gameover';
```

Replace with:

```js
state.pins = data.p.map(([n, c, x, y]) => ({ name: n, correct: c === 1, lon: x, lat: y }));
state.pool   = state.pins
  .map(pin => europeFeatures.find(f => f.properties.name === pin.name))
  .filter(Boolean);
state.status = new Map(state.pool.map(f => {
  const pin = state.pins.find(p => p.name === f.properties.name);
  return [f, pin.correct ? 'correct' : 'wrong'];
}));
state.current = null;
state.score = {
  correct: state.pins.filter(p => p.correct).length,
  total:   state.pins.length,
};
state.phase = 'gameover';
```

- [ ] **Step 8: Verify the game runs end-to-end.**

Start a local preview of the project root:

```
preview_start
```

Then open the served URL.

Expected:
- The game starts as today (chip at top-left desktop / bottom mobile).
- Play through ~25 clicks; verify the game ends after **25 rounds** (not 44/45) with the game-over overlay showing `X / 25`.
- Navigate to `<url>?test=20/25` — game-over screen shows `20 / 25` with 20 correct (green) pins and 5 wrong (red) pins on the map.
- After playing a game and getting a share URL, reload that URL — the same correct/wrong pin layout reappears with the same score.

Use `preview_console_logs` to confirm no JavaScript errors. Use `preview_screenshot` to capture the game-over state for visual confirmation.

- [ ] **Step 9: Commit.**

```bash
git add index.html
git commit -m "feat: cap game at 25 random rounds, refactor state to pool+status"
```

---

### Task 2: Add sidebar DOM + desktop CSS (no entries rendered yet)

**Files:**
- Modify: `index.html` (HTML + CSS sections)

**Goal:** Introduce the `<aside id="sidebar">` element that wraps the existing chip on desktop. Visually a 240px-wide column with a semi-transparent dark background, chip sitting at the top. Mobile still looks the same as today (chip at bottom, no sidebar visible).

- [ ] **Step 1: Wrap the chip and add the entries container.**

Find this block in the HTML body (~line 176):

```html
<svg id="map"></svg>
<span id="prompt"></span>
<div id="joyride" class="hidden">
```

Replace with:

```html
<svg id="map"></svg>
<aside id="sidebar">
  <span id="prompt"></span>
  <div id="entries"></div>
</aside>
<div id="joyride" class="hidden">
```

- [ ] **Step 2: Add desktop sidebar CSS, replacing the old `#prompt` positioning.**

Find the `#prompt` rule in the `<style>` block (~line 13):

```css
#prompt {
  position: fixed; top: 16px; left: 20px; z-index: 10;
}
```

Replace with:

```css
#sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
  width: 240px; padding: 12px;
  background: rgba(15,25,35,0.75);
  display: flex; flex-direction: column;
  overflow: hidden;
}
#prompt {
  display: block; flex: 0 0 auto;
  margin-bottom: 16px;
}
#prompt:empty { display: none; }   /* hide chip slot during game-over */
#entries {
  flex: 1 1 auto;
  display: flex; flex-direction: column; gap: 6px;
  overflow-y: auto;
}
```

- [ ] **Step 3: Update the mobile media query so the sidebar wraps the chip at the bottom and hides entries.**

Find the mobile media query (~line 90):

```css
@media (max-width: 700px) {
  #prompt { top: auto; bottom: 20px; left: 10px; right: 10px; }
```

Replace with (only this rule changes — leave the rest of the block alone for now):

```css
@media (max-width: 700px) {
  #sidebar {
    position: fixed; top: auto; bottom: 20px; left: 10px; right: auto;
    width: auto; height: auto;
    padding: 0; background: transparent;
    overflow: visible;
  }
  #prompt { margin-bottom: 0; }
  #entries { display: none; }
```

(The existing `#prompt { top: auto; bottom: 20px; left: 10px; right: 10px; }` line is replaced by the new `#sidebar` rules above.)

- [ ] **Step 4: Verify the layout on desktop and mobile.**

Open the preview at desktop size:
- A 240px dark column appears on the left edge.
- The chip sits at the top-left of that column.
- Right of the column, the map fills the rest of the viewport. The map's left edge (UK / Ireland) is partially obscured by the sidebar — this is the intended overlay behavior.

Use `preview_resize` to switch to mobile (e.g. 390×844):
- Looks identical to today — chip at the bottom-left as a content-sized strip. No dark column visible.

Use `preview_screenshot` for both states. `preview_console_logs` should show no errors.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: wrap chip in sidebar element with desktop column layout"
```

---

### Task 3: Render to-do / correct / wrong piles on desktop

**Files:**
- Modify: `index.html` (CSS + JS sections)

**Goal:** Populate `#entries` with the 24 non-current countries on desktop, styled per their state (dim / green ring / red ring). Mobile still hides entries (Task 4 brings them back via the expand button).

- [ ] **Step 1: Add entry / flag-box CSS.**

Add this CSS block immediately after the `#entries` rule from Task 2 (and before the mobile media query):

```css
.entry {
  display: flex; align-items: center; gap: 8px;
  padding: 2px 4px;
}
.entry-flag {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 24px; border-radius: 4px;
  font-size: 18px; line-height: 1;
  flex: 0 0 auto;
}
.entry-name {
  font-size: 14px; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.entry.todo { opacity: 0.4; }
.entry.correct .entry-flag { box-shadow: 0 0 0 2px #4caf50; }
.entry.wrong   .entry-flag { box-shadow: 0 0 0 2px #e53935; }
.entry:hover { filter: brightness(1.2); }
```

- [ ] **Step 2: Add the `renderSidebar()` function.**

Find a logical place near `renderPins` (~line 636). Insert this function above `renderPins`:

```js
function renderSidebar() {
  const container = document.getElementById('entries');
  const alphaCompare = (a, b) => a.properties.name.localeCompare(b.properties.name);
  const todo    = state.pool.filter(f => state.status.get(f) === 'todo').sort(alphaCompare);
  const correct = state.pool.filter(f => state.status.get(f) === 'correct').sort(alphaCompare);
  const wrong   = state.pool.filter(f => state.status.get(f) === 'wrong').sort(alphaCompare);
  const zones = [
    { features: todo,    klass: 'todo' },
    { features: correct, klass: 'correct' },
    { features: wrong,   klass: 'wrong' },
  ];
  container.innerHTML = zones.flatMap(({ features, klass }) =>
    features.map(f => {
      const name = f.properties.name;
      return `<div class="entry ${klass}" data-name="${name}">
        <span class="entry-flag">${countryFlag(name)}</span>
        <span class="entry-name">${name}</span>
      </div>`;
    })
  ).join('');
}
```

- [ ] **Step 3: Call `renderSidebar()` from each state-changing point.**

In `startRound`, add `renderSidebar();` at the very end of the function (after `maybeShowJoyride();`).

In `reveal`, find the line you added in Task 1:

```js
state.status.set(state.current, correct ? 'correct' : 'wrong');
```

Add immediately after:

```js
renderSidebar();
```

In `replayFromHash`, find the line `renderPins();` near the bottom of the function and add immediately after:

```js
renderSidebar();
```

In the `?test=` handler (in `init`), find the line `renderPins();` and add immediately after:

```js
renderSidebar();
```

- [ ] **Step 4: Verify on desktop.**

Open the preview at desktop size. Expected at game start:
- Sidebar shows the chip at the top + 24 dimmed entries below, each with a flag + name in alphabetical order.

Play a round, deliberately misclick:
- The country that was current moves into the wrong pile with a red ring around its flag, between the (still dim) to-do entries above and any other wrong entries below.

Play another round, click the correct country:
- Likewise but with a green ring; appears in the correct pile.

Continue until 25 rounds done; game-over overlay appears. The sidebar at game-over shows no current chip (the `:empty` rule from Task 2 hides the empty `#prompt`) and just the correct/wrong piles.

Also reload a shared replay link: sidebar shows the correct/wrong split from the share data.

Use `preview_snapshot` to verify alphabetical order in each pile.

- [ ] **Step 5: Verify test mode.**

Visit `?test=15/25`. Expected: sidebar shows 15 green-ringed entries followed by 10 red-ringed entries, each pile alphabetical. Game-over overlay shows `15 / 25`.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "feat: render to-do/correct/wrong piles in desktop sidebar"
```

---

### Task 4: Mobile expand button + flag-only column

**Files:**
- Modify: `index.html` (HTML + CSS + JS)

**Goal:** Mobile shows a small up-arrow button above the chip's number block. Tapping it unfurls a narrow flag-only column upward along the left edge. Tap a flag to flash its name as a tooltip. Tap the arrow again to collapse. New Game moves into the hamburger menu; Score moves to top-right next to the menu.

- [ ] **Step 1: Add the expand button to the chip's rendered HTML.**

Find `startRound` (~line 479):

```js
setPrompt(`<div class="esc-entry">
  <span class="esc-num">${num}</span>
  <span class="esc-flag">${countryFlag(name)}</span>
  <span class="esc-name">${name}</span>
</div>`);
```

Replace with:

```js
setPrompt(`<div class="esc-entry">
  <button class="expand-btn" aria-label="Toggle list">▲</button>
  <span class="esc-num">${num}</span>
  <span class="esc-flag">${countryFlag(name)}</span>
  <span class="esc-name">${name}</span>
</div>`);
```

- [ ] **Step 2: Style the expand button (visible only on mobile).**

Find the `.esc-name` rule (~line 52). Add this block immediately after:

```css
.expand-btn {
  display: none; /* desktop hides it */
  position: absolute; left: 8px; top: -22px;
  background: #7040b0; color: #fff;
  border: none; border-radius: 4px 4px 0 0;
  width: 40px; height: 22px;
  font-size: 1rem; line-height: 1;
  box-shadow: 0 -2px 6px rgba(0,0,0,0.3);
  cursor: pointer;
  padding: 0;
}
```

Inside the mobile `@media (max-width: 700px)` block, add (near the `.esc-entry` rule already there):

```css
.expand-btn { display: inline-flex; align-items: center; justify-content: center; }
.esc-entry  { position: relative; display: inline-flex; width: auto; }
```

(The `display: inline-flex; width: auto;` left-aligns the chip and lets it size to content, per the spec.)

- [ ] **Step 3: Add the expanded-state CSS for the entries column on mobile.**

Inside the mobile media query, add:

```css
#sidebar.expanded #entries {
  display: flex; flex-direction: column; gap: 4px;
  position: fixed; left: 0; top: 50px; bottom: 80px;
  width: 56px; padding: 8px 6px;
  background: rgba(15,25,35,0.75);
  pointer-events: none; /* clicks pass through to map */
}
#sidebar.expanded .entry { padding: 0; pointer-events: auto; }
#sidebar.expanded .entry-name { display: none; } /* flag-only */
#sidebar.expanded .entry-flag {
  width: 44px; height: auto; min-height: 20px;
  font-size: clamp(14px, 3vw, 20px);
  flex: 1 1 auto;
}
.flag-tooltip {
  position: fixed; z-index: 12;
  background: #16213e; color: #fff;
  padding: 4px 10px; border-radius: 4px; font-size: 14px;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  opacity: 0; transition: opacity 0.15s;
}
.flag-tooltip.show { opacity: 1; }
```

The `flex: 1 1 auto` on `.entry-flag` plus `top: 50px; bottom: 80px` on `#entries` makes the 24 entries divide the available vertical space evenly. `bottom: 80px` matches the chip's footprint (`bottom: 20px` + ~60px chip height).

- [ ] **Step 4: Wire up the expand button (event delegation).**

Find the existing menu-button handler block (~line 527). Below the line `document.querySelectorAll('.menu-item').forEach(item => { ... });`, add:

```js
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.expand-btn');
  if (!btn) return;
  e.stopPropagation();
  const sidebar = document.getElementById('sidebar');
  const expanded = sidebar.classList.toggle('expanded');
  btn.textContent = expanded ? '▼' : '▲';
});
```

(Event delegation on `document.body` because the chip's HTML is re-rendered on every round; the button doesn't have a stable reference.)

- [ ] **Step 5: Wire up the flag tooltip on mobile tap.**

Below the expand-button handler, add:

```js
let flagTooltipEl = null;
let flagTooltipTimer = null;
document.getElementById('entries').addEventListener('click', (e) => {
  const entry = e.target.closest('.entry');
  if (!entry) return;
  if (!document.getElementById('sidebar').classList.contains('expanded')) return;
  const rect = entry.getBoundingClientRect();
  if (!flagTooltipEl) {
    flagTooltipEl = document.createElement('div');
    flagTooltipEl.className = 'flag-tooltip';
    document.body.appendChild(flagTooltipEl);
  }
  flagTooltipEl.textContent = entry.dataset.name;
  flagTooltipEl.style.left = (rect.right + 8) + 'px';
  flagTooltipEl.style.top  = (rect.top + rect.height / 2 - 14) + 'px';
  flagTooltipEl.classList.add('show');
  if (flagTooltipTimer) clearTimeout(flagTooltipTimer);
  flagTooltipTimer = setTimeout(() => flagTooltipEl.classList.remove('show'), 1500);
});
```

- [ ] **Step 6: Move the "New Game" button into the hamburger menu.**

Find the menu dropdown HTML (~line 187):

```html
<div id="menu-dropdown" class="hidden">
  <div class="menu-item" data-set="eurovision">Eurovision</div>
  <div class="menu-item" data-set="europe">Europe</div>
</div>
```

Replace with:

```html
<div id="menu-dropdown" class="hidden">
  <div class="menu-item" data-set="eurovision">Eurovision</div>
  <div class="menu-item" data-set="europe">Europe</div>
  <div class="menu-divider"></div>
  <div class="menu-item" id="menu-new-game">New Game</div>
</div>
```

Add divider CSS — find the `.menu-item.active` rule (~line 88) and add immediately after:

```css
.menu-divider { height: 1px; background: #2a3a5c; margin: 4px 0; }
```

Wire up the menu item. Find the existing menu-item handler (~line 531):

```js
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    setCountrySet(item.dataset.set);
    document.getElementById('menu-dropdown').classList.add('hidden');
  });
});
```

Replace with:

```js
document.querySelectorAll('.menu-item[data-set]').forEach(item => {
  item.addEventListener('click', () => {
    setCountrySet(item.dataset.set);
    document.getElementById('menu-dropdown').classList.add('hidden');
  });
});
document.getElementById('menu-new-game').addEventListener('click', () => {
  if (allFeatures) startGame();
  document.getElementById('menu-dropdown').classList.add('hidden');
});
```

(The selector tightens to `.menu-item[data-set]` so the new "New Game" item — which has no `data-set` — doesn't trigger `setCountrySet(undefined)`.)

- [ ] **Step 7: Hide the floating New Game button on mobile; move score to top-right.**

Inside the mobile media query, find these existing rules:

```css
#right { left: 20px; right: auto; flex-direction: row-reverse; gap: 12px; }
#score { font-size: 1.1rem; }
#new-game { font-size: 1.5rem; padding: 6px 12px; line-height: 1; }
#new-game .ng-icon { display: inline; }
#new-game .ng-text { display: none; }
```

Replace with:

```css
#right { left: auto; right: 70px; gap: 12px; }
#score { font-size: 1rem; }
#new-game { display: none; } /* moved into hamburger menu on mobile */
```

(70px reserves room for the ☰ menu at right:20px which is 42px wide + ~8px gap.)

- [ ] **Step 8: Verify on mobile.**

Use `preview_resize` to switch to mobile width (e.g. 390×844).

Expected — collapsed state:
- Chip is left-aligned (content-width) at bottom-left.
- An up-arrow `▲` button sits above the "01" number block.
- Score visible at top-right next to the ☰ menu.
- No floating New Game button in the top bar.
- Open the menu (tap ☰): "Eurovision" / "Europe" / divider / "New Game" — three options + separator.

Expected — expanded state (tap the up-arrow):
- 24 flag-boxes appear in a narrow column up the left edge, evenly scaled.
- Arrow flips to `▼`.

Expected — tap interactions:
- Tap a flag in the column: its country name floats next to the flag for ~1.5s.
- Tap a country on the map (under the column): the click registers — the round proceeds normally (because the column's backdrop has `pointer-events: none`; only the flag-boxes intercept clicks).
- Tap the menu's "New Game": game restarts; column re-flows with the new pool; chip updates.

Use `preview_screenshot` for the collapsed and expanded states. `preview_console_logs` should show no errors.

- [ ] **Step 9: Verify desktop still works.**

Use `preview_resize` to switch back to desktop width (e.g. 1440×900).

Expected:
- Expand button is hidden (CSS `display: none` on desktop).
- Sidebar entries column on the left shows flag + name for each of the 24 non-current countries.
- Chip at top of sidebar (no button above it).
- New Game button remains visible in the top-right bar.

- [ ] **Step 10: Verify joyride still anchors to the chip.**

Open the preview in a fresh browser context (clear `localStorage` first via `preview_eval`: `localStorage.removeItem('douze-points-joyride-seen')`). Reload.

Expected:
- Desktop: joyride yellow tooltip appears below the chip at top-left of the sidebar. The triangle points up at the chip. Close it via the ×.
- Mobile (resize): joyride appears above the chip at bottom-left. Triangle points down at the chip.

- [ ] **Step 11: Commit.**

```bash
git add index.html
git commit -m "feat: mobile expand button + flag-only column, move New Game into menu"
```

---

### Task 5: FLIP transition animations on sidebar reflow

**Files:**
- Modify: `index.html` (CSS + JS)

**Goal:** When a country moves from to-do → done (and the next current rises to the top), animate the position change with a FLIP technique so the "drop into alphabetical position" feels physical.

- [ ] **Step 1: Wrap `renderSidebar` with FLIP capture/play.**

Replace the entire `renderSidebar` function (added in Task 3) with this version:

```js
function renderSidebar() {
  const container = document.getElementById('entries');

  // FIRST: capture old positions by name
  const oldRects = new Map();
  container.querySelectorAll('.entry').forEach(el => {
    oldRects.set(el.dataset.name, el.getBoundingClientRect());
  });

  // LAST: render the new layout
  const alphaCompare = (a, b) => a.properties.name.localeCompare(b.properties.name);
  const todo    = state.pool.filter(f => state.status.get(f) === 'todo').sort(alphaCompare);
  const correct = state.pool.filter(f => state.status.get(f) === 'correct').sort(alphaCompare);
  const wrong   = state.pool.filter(f => state.status.get(f) === 'wrong').sort(alphaCompare);
  const zones = [
    { features: todo,    klass: 'todo' },
    { features: correct, klass: 'correct' },
    { features: wrong,   klass: 'wrong' },
  ];
  container.innerHTML = zones.flatMap(({ features, klass }) =>
    features.map(f => {
      const name = f.properties.name;
      return `<div class="entry ${klass}" data-name="${name}">
        <span class="entry-flag">${countryFlag(name)}</span>
        <span class="entry-name">${name}</span>
      </div>`;
    })
  ).join('');

  // INVERT + PLAY: for entries that existed before, apply inverse translate then transition back
  container.querySelectorAll('.entry').forEach(el => {
    const oldRect = oldRects.get(el.dataset.name);
    if (!oldRect) return;
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top  - newRect.top;
    if (dx === 0 && dy === 0) return;
    el.style.transition = 'none';
    el.style.transform  = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms ease-out';
      el.style.transform  = 'translate(0, 0)';
    });
  });
}
```

- [ ] **Step 2: Verify the animation feels right on desktop.**

Open preview at desktop size. Play a round:
- After the 750ms reveal (existing map fill animation), the entry that was current visibly slides from where it would have been at the top of the to-do pile down into its alphabetical position in the correct or wrong pile. The other to-do entries slide up/down to make room.

Repeat several times. The animation should feel smooth and ~300ms.

- [ ] **Step 3: Verify on mobile expanded.**

Use `preview_resize` to switch to mobile. Tap the expand arrow. Play a round:
- The flag in the expanded column slides from its old position to its new alphabetical position in the correct/wrong area of the column.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: FLIP animation for sidebar entry reflow"
```

---

## Self-Review

**Spec coverage:**
- ✅ 25-round pool sampling — Task 1, steps 1–3
- ✅ State shape: pool + status — Task 1, step 2
- ✅ Random current selection — Task 1, step 4
- ✅ End condition based on status (not queue length) — Task 1, step 5
- ✅ Test-URL handler updated — Task 1, step 6
- ✅ Replay-from-hash handler updated — Task 1, step 7
- ✅ Sidebar HTML wrapper — Task 2, step 1
- ✅ Desktop sidebar layout (240px, semi-transparent, fixed left) — Task 2, step 2
- ✅ `#prompt:empty` hides chip slot during game-over — Task 2, step 2
- ✅ Mobile chip stays at bottom (sidebar acts as wrapper) — Task 2, step 3
- ✅ Entry styling: dim / green ring / red ring — Task 3, step 1
- ✅ `renderSidebar()` derives 4 zones — Task 3, step 2
- ✅ Re-render on every state change — Task 3, step 3
- ✅ Mobile: left-aligned content-width chip — Task 4, step 2 (`.esc-entry { width: auto }`)
- ✅ Up-arrow expand button above number block — Task 4, steps 1 & 2
- ✅ Expanded mobile column: flag-only, scaled-to-fit, `pointer-events: none` backdrop — Task 4, step 3
- ✅ Flag-tap tooltip — Task 4, step 5
- ✅ New Game in hamburger menu — Task 4, step 6
- ✅ Score moved to top-right on mobile — Task 4, step 7
- ✅ Joyride still works — Task 4, step 10 (verification)
- ✅ FLIP animations on entry reflow — Task 5
- ✅ Country-set switching (re-samples pool) — already handled by `setCountrySet` → `startGame` chain, no plan step needed

**Placeholder scan:** No "TBD", "TODO", "appropriate", "similar to" placeholders. Every code step has the full code an engineer needs to type.

**Type consistency:**
- `state.pool` (Array<feature>) used identically across Tasks 1, 3, 5.
- `state.status` (Map<feature, 'todo'|'correct'|'wrong'>) consistent — `.get()`, `.set()`, `.delete()` all match.
- `state.current` is feature | null — set to feature in `startRound`, set to null in `startGame` / replay / test, deleted from `status` map throughout.
- `renderSidebar()` signature stable: no args, returns nothing, mutates `#entries.innerHTML`.
- `countryFlag(name)` reused (already exists in the codebase).

**Scope check:** Single, focused feature change. One spec → one plan → one feature branch. Each task is a discrete commit that leaves the project in a working state.
