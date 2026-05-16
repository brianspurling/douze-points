# Points-Based Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `X / Y correct` chip with a Eurovision scoreboard widget under the hamburger menu that awards +12 per correct guess and subtracts miles-to-nearest-border per wrong guess, with a delta-chip + confetti fanfare and a running-total count animation. At game over, the cumulative points (clamped to 0 from below) are scaled against 300 (= 25 × 12) and mapped to the existing 11-band tier table.

**Architecture:** All changes are confined to `index.html`. A new `#scoreboard` element (purple chip matching the `.esc-entry` aesthetic) and a `#score-delta` element (transient chip below the scoreboard) are added to the body. `state.score.points` is the new canonical score; `correct`/`total` are kept for the bracketed headline and share text. `reveal()` computes wrong-guess distance via the existing `nearestBorderPoint` helper → `projection.invert` → `d3.geoDistance × 3959`. A `showScoreDelta(delta)` helper animates the chip in/out and (for positives) fires a small canvas-confetti burst. A `tweenScore(from, to)` helper drives the running total via `requestAnimationFrame`. `getEurovisionTier` is re-signatured to take `points` directly.

**Tech Stack:** Vanilla JS, CSS keyframe animations, `canvas-confetti@1.9.3` (already loaded), `d3.geoDistance` from D3 v7 (already loaded).

---

## File Map

| File | Role |
|------|------|
| `index.html` | All changes — HTML markup, inline `<style>`, inline `<script>` |

## Reference: spec

[`docs/superpowers/specs/2026-05-16-points-based-scoring-design.md`](../specs/2026-05-16-points-based-scoring-design.md)

---

### Task 1: Scoreboard + delta chip — HTML, CSS, and inert "0" render

Adds the new widgets to the page and removes the old `#score` chip. After this task the scoreboard renders `0` from game start and stays `0` (no scoring math yet).

**Files:**
- Modify: `index.html` (markup around lines 257–260, `<style>` block, inline `<script>` around lines 423–441, 552–572)

- [ ] **Step 1: Remove the old `#score` element**

Find this block in the markup (around line 257):

```html
  <div id="right">
    <span id="score"></span>
    <button id="new-game" aria-label="New Game"><span class="ng-icon">↻</span><span class="ng-text">New Game</span></button>
  </div>
```

Replace with:

```html
  <div id="right">
    <button id="new-game" aria-label="New Game"><span class="ng-icon">↻</span><span class="ng-text">New Game</span></button>
  </div>
```

- [ ] **Step 2: Add `#scoreboard` and `#score-delta` elements after the menu dropdown**

Find this block in the markup (around line 262–267):

```html
  <div id="menu-dropdown" class="hidden">
    <div class="menu-item" data-set="eurovision">Eurovision</div>
    <div class="menu-item" data-set="europe">Europe</div>
    <div class="menu-divider"></div>
    <div class="menu-item" id="menu-new-game">New Game</div>
  </div>
```

Immediately after that closing `</div>` (and before `<div id="overlay" ...>`), add:

```html
  <div id="scoreboard" aria-label="Score">
    <span class="sb-label">POINTS</span>
    <span class="sb-value">0</span>
  </div>
  <div id="score-delta"></div>
```

- [ ] **Step 3: Remove the old `#score` CSS rule**

In the `<style>` block, find this line (around line 99):

```css
    #score { font-size: 1rem; opacity: 0.85; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
```

Delete it.

- [ ] **Step 4: Also remove `#score { font-size: 1rem; }` from the mobile media query**

In the `@media (max-width: 700px)` block, find (around line 157):

```css
        #score { font-size: 1rem; }
```

Delete that line.

- [ ] **Step 5: Add scoreboard + delta chip CSS**

After the existing `#menu-dropdown` rules (around line 131, just before `.menu-item { ... }`), add:

```css
    #scoreboard {
      position: fixed; top: 64px; right: 20px; z-index: 10;
      display: flex; align-items: center; border-radius: 5px; overflow: hidden;
      font-weight: bold; color: #fff; background: #7040b0;
      font-size: 0.95rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    .sb-label {
      background: rgba(0,0,0,0.28);
      padding: 8px 10px;
      font-size: 0.7rem; letter-spacing: 0.08em; opacity: 0.85;
    }
    .sb-value {
      padding: 8px 14px;
      font-variant-numeric: tabular-nums;
      min-width: 56px; text-align: right;
    }
    #score-delta {
      position: fixed; right: 20px; top: 110px; z-index: 10;
      padding: 5px 12px; border-radius: 5px;
      font-weight: bold; font-size: 1rem; color: #fff;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      opacity: 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    #score-delta.positive { background: #4caf50; }
    #score-delta.negative { background: #e53935; }
    #score-delta.animate {
      animation: scoreDeltaIn 1000ms ease-out forwards;
    }
    @keyframes scoreDeltaIn {
      0%   { opacity: 0; transform: translateY(0)   scale(0.4); }
      30%  { opacity: 1; transform: translateY(-4px) scale(1.15); }
      45%  { opacity: 1; transform: translateY(-6px) scale(1.0); }
      80%  { opacity: 1; transform: translateY(-10px) scale(1.0); }
      100% { opacity: 0; transform: translateY(-12px) scale(0.9); }
    }
```

- [ ] **Step 6: Mobile sizing for the scoreboard**

Inside the existing `@media (max-width: 700px)` block, after the `#new-game { display: none; }` line (around line 158), add:

```css
        #scoreboard { top: 56px; font-size: 0.85rem; }
        .sb-label   { padding: 6px 8px; font-size: 0.65rem; }
        .sb-value   { padding: 6px 10px; min-width: 50px; }
        #score-delta { top: 96px; font-size: 0.9rem; padding: 4px 10px; }
```

- [ ] **Step 7: Add `points` to `state.score` and reset in `startGame()`**

Find the state declaration (around line 421):

```js
      score:     { correct: 0, total: 0 },
```

Replace with:

```js
      score:     { correct: 0, total: 0, points: 0 },
```

Then find `startGame()` (around line 552):

```js
      state.score     = { correct: 0, total: 0 };
```

Replace with:

```js
      state.score     = { correct: 0, total: 0, points: 0 };
```

- [ ] **Step 8: Rewrite `updateScore()` to render the scoreboard**

Find the existing `updateScore()` function (around line 436–441):

```js
    function updateScore() {
      const el = document.getElementById('score');
      el.textContent = state.score.total > 0
        ? `${state.score.correct} / ${state.score.total} correct`
        : '';
    }
```

Replace with:

```js
    function updateScore() {
      const valueEl = document.querySelector('#scoreboard .sb-value');
      if (valueEl) valueEl.textContent = String(state.score.points);
    }
```

- [ ] **Step 9: Clear leftover delta chip in `startGame()`**

In `startGame()`, find the existing pin clear line (around line 568):

```js
      pinsGroup.selectAll('*').remove();
```

Immediately after that line, add:

```js
      const deltaEl = document.getElementById('score-delta');
      if (deltaEl) { deltaEl.classList.remove('animate', 'positive', 'negative'); deltaEl.textContent = ''; }
```

- [ ] **Step 10: Verify in browser**

Start the dev preview, load the page, and confirm:

1. The "X / Y correct" chip is gone from the top-right.
2. A purple chip labelled `POINTS │ 0` appears directly below the hamburger button (top: 64px, right: 20px).
3. Click a country — answer correct or wrong — and the scoreboard still reads `0` (we haven't wired the math yet). The widget should NOT flicker or move during reveals.
4. Resize to a narrow mobile viewport (≤ 700px wide); the scoreboard shrinks to a smaller variant.

Check the console for errors.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: scoreboard widget HTML/CSS + state.points field

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wrong-guess distance math + score updates in `reveal()`

After this task the scoreboard updates correctly on every reveal: +12 on correct, -miles on wrong. Still no animation — just instant snapping.

**Files:**
- Modify: `index.html` (inline `<script>`, `reveal()` around lines 970–1044)

- [ ] **Step 1: Compute wrong-guess miles inside `reveal()`**

Find this block inside `reveal()` (around line 1014–1024):

```js
      state.pendingClick = null;
      state.pins.push({ lon, lat, correct, name });
      renderPins();

      state.score.total++;
      if (correct) state.score.correct++;
      state.phase = 'revealed';
      updateScore();
      state.status.set(state.current, correct ? 'correct' : 'wrong');
      renderSidebar();
```

Replace with:

```js
      state.pendingClick = null;
      state.pins.push({ lon, lat, correct, name });
      renderPins();

      const delta = correct ? 12 : -milesFromClickToBorder(feature, lon, lat);
      state.score.total++;
      if (correct) state.score.correct++;
      state.score.points += delta;
      state.phase = 'revealed';
      updateScore();
      state.status.set(state.current, correct ? 'correct' : 'wrong');
      renderSidebar();
```

- [ ] **Step 2: Add the `milesFromClickToBorder` helper**

Find the existing `nearestBorderPoint` function (around line 954–967). Immediately after its closing `}`, add:

```js
    // Great-circle miles from the click coords to the nearest point on the
    // rendered border of `feature`. Uses the screen-space nearest-border
    // sampler (good enough for Europe; Mercator distortion is negligible
    // at the scales involved) and inverts back to lon/lat for the geo math.
    function milesFromClickToBorder(feature, clickLon, clickLat) {
      const [px, py] = projection([clickLon, clickLat]);
      const [bx, by] = nearestBorderPoint(feature, px, py);
      const [borderLon, borderLat] = projection.invert([bx, by]);
      const radians = d3.geoDistance([clickLon, clickLat], [borderLon, borderLat]);
      return Math.round(radians * 3959);
    }
```

- [ ] **Step 3: Capture `lon`/`lat` BEFORE the leeway-snap mutates them**

Note: `reveal()` already reassigns `lon` and `lat` after the leeway-snap (line 1011 — `[lon, lat] = projection.invert([sx, sy]);`). That branch only runs when `correct && !insidePolygon`, so it never affects wrong guesses. No code change needed for this step — the existing flow is correct. (This step exists to make the reader confirm the ordering: the snap is guarded by `correct`, so `milesFromClickToBorder` for wrong guesses is computed from raw click coords.)

- [ ] **Step 4: Verify in browser**

Start a new game, then:

1. Click squarely inside a country (correct guess) — scoreboard should jump from `0` to `12`.
2. Click in another correct country — scoreboard should jump to `24`.
3. Now click somewhere far off (wrong guess) — scoreboard should drop by roughly the great-circle miles. For example: prompted "Iceland" but click on Italy → expect roughly -1300.
4. Confirm the scoreboard renders a leading minus sign for negative values (e.g. `-127`).
5. Click *just outside* a country but within the leeway buffer — should still be `+12` (no penalty).

In the console, sanity-check the distance helper with a known input:

```js
milesFromClickToBorder(europeFeatures.find(f => f.properties.name === 'Iceland'), 12.5, 41.9)
```

(Click coord: Rome, Italy. Expected: ~1300–1500 miles to the Iceland border.)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: award +12 per correct, subtract miles-to-border per wrong

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Re-signature `getEurovisionTier` and update game-over headline + share text

Switches the tier mapping from `correct/total` to `points/300` (with negatives clamped), and reformats the game-over score line as `240 (15 / 25)`.

**Files:**
- Modify: `index.html` (inline `<script>`, `getEurovisionTier` around 467–480, `buildShareText` around 714–723, `showGameOver` around 1089)

- [ ] **Step 1: Rewrite `getEurovisionTier` to take points**

Find the existing function (around lines 467–480):

```js
    function getEurovisionTier(correct, total) {
      const pct = total === 0 ? 0 : (correct / total) * 100;
      if (pct < 20) return { points: 0,  label: 'Nul points',    colour: '#c62828' };
      if (pct < 27) return { points: 1,  label: 'Un point',      colour: '#e65100' };
      if (pct < 34) return { points: 2,  label: 'Deux points',   colour: '#e65100' };
      if (pct < 41) return { points: 3,  label: 'Trois points',  colour: '#e65100' };
      if (pct < 48) return { points: 4,  label: 'Quatre points', colour: '#ffffff' };
      if (pct < 55) return { points: 5,  label: 'Cinq points',   colour: '#ffffff' };
      if (pct < 62) return { points: 6,  label: 'Six points',    colour: '#ffffff' };
      if (pct < 68) return { points: 7,  label: 'Sept points',   colour: '#ffd600' };
      if (pct < 74) return { points: 8,  label: 'Huit points',   colour: '#ffd600' };
      if (pct < 83) return { points: 10, label: 'Dix points',    colour: '#ffab00' };
      return              { points: 12, label: 'Douze points',   colour: '#ffe57f' };
    }
```

Replace with:

```js
    const MAX_POINTS = 25 * 12; // 300 — also the divisor for tier %
    function getEurovisionTier(rawPoints) {
      const clamped = Math.max(0, rawPoints);
      const pct = (clamped / MAX_POINTS) * 100;
      if (pct < 20) return { points: 0,  label: 'Nul points',    colour: '#c62828' };
      if (pct < 27) return { points: 1,  label: 'Un point',      colour: '#e65100' };
      if (pct < 34) return { points: 2,  label: 'Deux points',   colour: '#e65100' };
      if (pct < 41) return { points: 3,  label: 'Trois points',  colour: '#e65100' };
      if (pct < 48) return { points: 4,  label: 'Quatre points', colour: '#ffffff' };
      if (pct < 55) return { points: 5,  label: 'Cinq points',   colour: '#ffffff' };
      if (pct < 62) return { points: 6,  label: 'Six points',    colour: '#ffffff' };
      if (pct < 68) return { points: 7,  label: 'Sept points',   colour: '#ffd600' };
      if (pct < 74) return { points: 8,  label: 'Huit points',   colour: '#ffd600' };
      if (pct < 83) return { points: 10, label: 'Dix points',    colour: '#ffab00' };
      return              { points: 12, label: 'Douze points',   colour: '#ffe57f' };
    }
```

- [ ] **Step 2: Update the `showGameOver` tier call**

Find this line in `showGameOver` (around line 1070):

```js
      const tier    = getEurovisionTier(state.score.correct, state.score.total);
```

Replace with:

```js
      const tier    = getEurovisionTier(state.score.points);
```

- [ ] **Step 3: Reformat the `#final-score` headline**

Find (around line 1089):

```js
      scoreEl.textContent  = `${state.score.correct} / ${state.score.total}`;
```

Replace with:

```js
      scoreEl.textContent  = `${state.score.points} (${state.score.correct} / ${state.score.total})`;
```

- [ ] **Step 4: Update the `buildShareText` tier call and headline**

Find this block (around lines 714–723):

```js
    function buildShareText() {
      const correctPins = state.pins.filter(p => p.correct);
      const wrongPins   = state.pins.filter(p => !p.correct);
      const tier = getEurovisionTier(state.score.correct, state.score.total);
      const lines = [`Douze Points — ${state.score.correct} right, ${wrongPins.length} wrong — ${tier.label}`];
      if (correctPins.length) lines.push('✅ ' + correctPins.map(p => countryFlag(p.name)).join(''));
      if (wrongPins.length)   lines.push('❌ ' + wrongPins.map(p => countryFlag(p.name)).join(''));
      lines.push('', buildShareUrl());
      return lines.join('\n');
    }
```

Replace with:

```js
    function buildShareText() {
      const correctPins = state.pins.filter(p => p.correct);
      const wrongPins   = state.pins.filter(p => !p.correct);
      const tier = getEurovisionTier(state.score.points);
      const lines = [`Douze Points — ${state.score.points} (${state.score.correct}/${state.score.total}) — ${tier.label}`];
      if (correctPins.length) lines.push('✅ ' + correctPins.map(p => countryFlag(p.name)).join(''));
      if (wrongPins.length)   lines.push('❌ ' + wrongPins.map(p => countryFlag(p.name)).join(''));
      lines.push('', buildShareUrl());
      return lines.join('\n');
    }
```

- [ ] **Step 5: Verify in browser**

Play through a full game (or use `?test=15/25` for a quick scenario):

1. The game-over headline should read e.g. `180 (15 / 25)` — the points come first, the correct count is in brackets.
2. The tier label above (Nul/Un/Deux/.../Douze points) should reflect the points-based mapping. For `?test=15/25` (which gives ~15×12 = 180 minus small centroid-to-border distances ≈ 60% of 300), expect roughly **Six points** or **Sept points**.
3. For `?test=25/25` (perfect), expect **Douze points**.
4. For `?test=0/25` (all wrong), expect **Nul points** (negative clamp).
5. Click "Share your map!" and verify the copied text contains the new `points (correct/total)` format.

Console sanity check:

```js
getEurovisionTier(300).label  // "Douze points"
getEurovisionTier(249).label  // "Douze points" (boundary)
getEurovisionTier(248).label  // "Dix points"
getEurovisionTier(59).label   // "Nul points"
getEurovisionTier(-500).label // "Nul points" (clamped)
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: tier mapping uses points/300, headline shows points (correct/total)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Delta chip animation + confetti burst

Adds the transient `+12` / `-127` chip that animates in when the score changes, plus a small canvas-confetti burst on positive deltas.

**Files:**
- Modify: `index.html` (inline `<script>`, new helper before `reveal()` around line 970, and a call inside `reveal()`)

- [ ] **Step 1: Add the `showScoreDelta` helper**

Find the existing `pulseFeature` function (around lines 933–948). Immediately after its closing `}`, add:

```js
    function showScoreDelta(delta) {
      const el = document.getElementById('score-delta');
      if (!el) return;
      el.classList.remove('animate', 'positive', 'negative');
      // Force reflow so re-adding the class restarts the CSS animation.
      void el.offsetWidth;
      const sign = delta >= 0 ? '+' : '−'; // U+2212 minus for nicer rendering
      el.textContent = `${sign}${Math.abs(delta)}`;
      el.classList.add('animate', delta >= 0 ? 'positive' : 'negative');

      if (delta > 0 && typeof confetti === 'function') {
        const rect = el.getBoundingClientRect();
        confetti({
          particleCount: 24,
          spread: 50,
          startVelocity: 22,
          ticks: 90,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top  + rect.height / 2) / window.innerHeight,
          },
          colors: ['#4caf50', '#ffd600', '#ffffff'],
        });
      }
    }
```

- [ ] **Step 2: Call `showScoreDelta` from `reveal()`**

Find this line inside `reveal()` (added in Task 2):

```js
      state.score.points += delta;
      state.phase = 'revealed';
      updateScore();
```

Replace with:

```js
      state.score.points += delta;
      state.phase = 'revealed';
      updateScore();
      if (delta !== 0) showScoreDelta(delta);
```

- [ ] **Step 3: Verify in browser**

Start a new game and answer one correct, one wrong:

1. On a correct answer: a green `+12` chip appears under the scoreboard, scales in with a small overshoot, drifts upward ~12px, and fades. A small confetti burst fires from its location.
2. On a wrong answer: a red `−127` (or however many miles) chip appears in the same place, scales in, drifts, fades. **No confetti.**
3. The chip should fully clear before the next round starts (within ~1000ms).
4. Trigger several deltas in a row by clicking through countries — each new delta should restart the animation cleanly, not stack.
5. Confirm the chip uses the minus character (`−`, U+2212), not a hyphen, on negative deltas.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: animated delta chip with confetti burst on positives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Running-total count tween

Instead of snapping, the scoreboard's value ticks from the old number to the new one over ~500ms after the delta chip appears.

**Files:**
- Modify: `index.html` (inline `<script>`, `updateScore` and the call site in `reveal()`)

- [ ] **Step 1: Refactor `updateScore` to accept a "from" value and tween**

Replace the current `updateScore` (rewritten in Task 1) with:

```js
    let scoreTweenRAF = 0;
    let scoreTweenStartTimer = 0;
    function updateScore(fromValue) {
      const valueEl = document.querySelector('#scoreboard .sb-value');
      if (!valueEl) return;
      const target = state.score.points;
      if (scoreTweenRAF) { cancelAnimationFrame(scoreTweenRAF); scoreTweenRAF = 0; }
      if (fromValue === undefined || fromValue === target) {
        valueEl.textContent = String(target);
        return;
      }
      const start = performance.now();
      const duration = 500;
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 2); // easeOutQuad
        const val = Math.round(fromValue + (target - fromValue) * eased);
        valueEl.textContent = String(val);
        if (t < 1) {
          scoreTweenRAF = requestAnimationFrame(frame);
        } else {
          scoreTweenRAF = 0;
          valueEl.textContent = String(target);
        }
      }
      scoreTweenRAF = requestAnimationFrame(frame);
    }
```

- [ ] **Step 2: Snapshot the old points value before applying the delta in `reveal()`**

Find this block inside `reveal()`:

```js
      const delta = correct ? 12 : -milesFromClickToBorder(feature, lon, lat);
      state.score.total++;
      if (correct) state.score.correct++;
      state.score.points += delta;
      state.phase = 'revealed';
      updateScore();
      if (delta !== 0) showScoreDelta(delta);
```

Replace with:

```js
      const delta = correct ? 12 : -milesFromClickToBorder(feature, lon, lat);
      const pointsBefore = state.score.points;
      state.score.total++;
      if (correct) state.score.correct++;
      state.score.points += delta;
      state.phase = 'revealed';
      if (delta !== 0) {
        showScoreDelta(delta);
        // Let the chip scale in (~300ms) before the running total starts ticking.
        if (scoreTweenStartTimer) clearTimeout(scoreTweenStartTimer);
        scoreTweenStartTimer = setTimeout(() => {
          scoreTweenStartTimer = 0;
          updateScore(pointsBefore);
        }, 300);
      } else {
        updateScore();
      }
```

- [ ] **Step 3: Ensure `startGame` and `replayFromHash` callers still work**

`startGame()` already calls `updateScore()` with no args — that path falls through the `fromValue === undefined` branch and snaps to the (reset) zero. No change needed.

Similarly the test-mode and replay paths call `updateScore()` with no args. They'll snap to whatever `state.score.points` is at the time (set in Task 6).

- [ ] **Step 4: Cancel any tween mid-flight when starting a new game**

Find this line in `startGame()` (the delta chip clear added in Task 1):

```js
      const deltaEl = document.getElementById('score-delta');
      if (deltaEl) { deltaEl.classList.remove('animate', 'positive', 'negative'); deltaEl.textContent = ''; }
```

Replace with:

```js
      const deltaEl = document.getElementById('score-delta');
      if (deltaEl) { deltaEl.classList.remove('animate', 'positive', 'negative'); deltaEl.textContent = ''; }
      if (scoreTweenRAF) { cancelAnimationFrame(scoreTweenRAF); scoreTweenRAF = 0; }
      if (scoreTweenStartTimer) { clearTimeout(scoreTweenStartTimer); scoreTweenStartTimer = 0; }
```

- [ ] **Step 5: Verify in browser**

1. Click a correct country — the `+12` chip animates in first, then the scoreboard ticks `0 → 12` smoothly over ~500ms (not instant).
2. Click a wrong country — the `-XYZ` chip animates in, then the scoreboard ticks down to the new (possibly negative) value smoothly.
3. Click "New Game" mid-tween — the score should immediately reset to `0` (no half-finished tween hanging).
4. Confirm the scoreboard's final value always lands exactly on `state.score.points` (no off-by-one from rounding).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: running-total count tween after delta chip animates in

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Replay + test-mode reconstruct points from pins

Share-URL replays and `?test=…` synthetic games need to populate `state.score.points` so the game-over tier and headline are correct.

**Files:**
- Modify: `index.html` (inline `<script>`, `init()` test-mode block around lines 382–407 and `replayFromHash` around lines 748–790)

- [ ] **Step 1: Add a `pointsFromPins` helper**

Find the `milesFromClickToBorder` helper (added in Task 2). Immediately after its closing `}`, add:

```js
    function pointsFromPins(pins) {
      let total = 0;
      for (const pin of pins) {
        if (pin.correct) {
          total += 12;
        } else {
          const feature = europeFeatures.find(f => f.properties.name === pin.name);
          if (feature) total -= milesFromClickToBorder(feature, pin.lon, pin.lat);
        }
      }
      return total;
    }
```

- [ ] **Step 2: Use it in the test-mode block in `init()`**

Find this block in `init()` (around lines 396–397):

```js
        state.pool    = chosen;
        state.status  = new Map(chosen.map((f, i) => [f, i < cCapped ? 'correct' : 'wrong']));
        state.current = null;
        state.pins    = d3.shuffle(pins);
        state.score   = { correct: cCapped, total: cap };
```

Replace with:

```js
        state.pool    = chosen;
        state.status  = new Map(chosen.map((f, i) => [f, i < cCapped ? 'correct' : 'wrong']));
        state.current = null;
        state.pins    = d3.shuffle(pins);
        state.score   = { correct: cCapped, total: cap, points: pointsFromPins(pins) };
        updateScore();
```

- [ ] **Step 3: Use it in `replayFromHash`**

Find this block (around lines 772–775):

```js
      state.score = {
        correct: state.pins.filter(p => p.correct).length,
        total:   state.pins.length,
      };
```

Replace with:

```js
      state.score = {
        correct: state.pins.filter(p => p.correct).length,
        total:   state.pins.length,
        points:  pointsFromPins(state.pins),
      };
```

- [ ] **Step 4: Verify in browser**

1. Visit `?test=25/25` — game-over headline shows `300 (25 / 25)`, tier label is **Douze points**, confetti fires.
2. Visit `?test=0/25` — headline shows a small negative number `(0 / 25)` (since centroid-to-border distances are non-zero), tier is **Nul points**, hearts rain.
3. Visit `?test=15/25` — headline shows something around `~170 (15 / 25)`, tier roughly **Six** or **Sept points**.
4. Play a full real game, then click "Share your map!" to copy the URL. Open that URL in a new tab — the game-over screen should show the **same** headline and tier as the original game (points recomputed from pin lon/lat).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: replay and test-mode reconstruct points from pins

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final acceptance check

After Task 6, run through the spec once more end-to-end:

- [ ] **Scoreboard** is visible from page load, sits below the hamburger, reads `0` at start, follows the Eurovision purple chip aesthetic, no longer shows `X / Y correct`.
- [ ] **Correct guess** awards exactly `+12`. Delta chip is green, confetti fires, running total ticks up.
- [ ] **Wrong guess** subtracts the rounded miles from the raw click to the nearest border (no confetti, red chip, running total ticks down — possibly into negatives).
- [ ] **Game over headline** reads `<points> (<correct> / <total>)`. Tier label uses `max(0, points) / 300`. Confetti on Douze, hearts on Nul, identical reveal sequence otherwise.
- [ ] **Share URL** roundtrips: opening a shared URL reproduces the same headline and tier.
- [ ] **Mobile (≤ 700px)** layout: scoreboard sits at top-right, slightly smaller; delta chip fits below it without crowding the hamburger.
- [ ] **No stale UI**: starting a new game clears the delta chip mid-flight, cancels any in-progress count tween, and snaps the scoreboard to `0`.
