# Eurovision End Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain game-over overlay with a theatrical Eurovision-style reveal sequence that maps score percentage to a points tier (nul → douze), with confetti for top scores and a 💔 rain for nul points.

**Architecture:** All changes are confined to `index.html`. A `getEurovisionTier()` helper computes the tier from the raw score. `showGameOver()` is rewritten to run a timed sequence: spokesperson text → dramatic pause → points label slam → effect. `canvas-confetti` is loaded from CDN for the douze-points burst; heart rain is pure JS/CSS.

**Tech Stack:** Vanilla JS, CSS keyframe animations, `canvas-confetti@1.9.3` from jsDelivr CDN.

---

### Task 1: Add CDN script, CSS, and overlay HTML

**Files:**
- Modify: `index.html` (script tags, `<style>` block, overlay markup)

- [ ] **Step 1: Add canvas-confetti script tag**

In `index.html`, after the existing two `<script src="...">` tags on lines 63–64, add:

```html
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
```

- [ ] **Step 2: Add CSS for spokesperson, points label, and heart rain**

Inside the `<style>` block, after the `.pin-label` rule (line 46), add:

```css
    #spokesperson {
      font-size: 1rem; font-style: italic; color: #ccc;
      margin-bottom: 24px;
    }
    #eur-points-label {
      font-size: 3.5rem; font-weight: bold; margin-bottom: 24px;
      will-change: transform, opacity;
    }
    @keyframes fallDown {
      to { transform: translateY(110vh); opacity: 0; }
    }
```

- [ ] **Step 3: Update overlay HTML to include new elements**

Replace the existing `#overlay-box` contents (lines 57–61):

```html
  <div id="overlay" class="hidden">
    <div id="overlay-box">
      <div id="spokesperson"></div>
      <div id="eur-points-label"></div>
      <div id="final-score"></div>
      <div id="final-label">correct</div>
      <button id="play-again">Play Again</button>
    </div>
  </div>
```

- [ ] **Step 4: Verify in browser**

Open `index.html` in a browser. Open the console and run:

```javascript
typeof confetti
```

Expected: `"function"`

Also confirm the overlay markup exists:

```javascript
document.getElementById('spokesperson').textContent = 'test'
document.getElementById('eur-points-label').textContent = 'DOUZE POINTS'
```

Both elements should appear (overlay is hidden but DOM is present).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add canvas-confetti CDN, Eurovision overlay elements and CSS"
```

---

### Task 2: Add `getEurovisionTier()` and effect helpers

**Files:**
- Modify: `index.html` (inline `<script>` block — helpers section around line 145)

- [ ] **Step 1: Add `getEurovisionTier()` after the `updateScore` function**

In the `<script>` block, after the `updateScore()` function (around line 159), add:

```javascript
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
      if (pct < 80) return { points: 10, label: 'Dix points',    colour: '#ffab00' };
      return              { points: 12, label: 'Douze points',   colour: '#ffe57f' };
    }

    function triggerConfetti() {
      const opts = {
        particleCount: 80, spread: 60,
        colors: ['#0093dd', '#ffde00', '#ffffff'],
      };
      confetti({ ...opts, origin: { x: 0.1, y: 0.9 } });
      setTimeout(() => confetti({ ...opts, origin: { x: 0.9, y: 0.9 } }), 300);
    }

    function triggerHeartRain() {
      for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.textContent = '💔';
        el.style.cssText = [
          'position:fixed', 'top:-2rem',
          `left:${Math.random() * 100}vw`,
          `font-size:${1 + Math.random()}rem`,
          'z-index:30', 'pointer-events:none',
          `animation:fallDown ${2 + Math.random()}s ease-in forwards`,
          `animation-delay:${Math.random() * 1}s`,
        ].join(';');
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
      }
    }
```

- [ ] **Step 2: Verify tier logic in browser console**

Open `index.html` and run in console:

```javascript
getEurovisionTier(0, 40)   // 0%    → { points: 0,  label: 'Nul points',   colour: '#c62828' }
getEurovisionTier(7, 40)   // 17.5% → { points: 0,  label: 'Nul points',   colour: '#c62828' }
getEurovisionTier(8, 40)   // 20%   → { points: 1,  label: 'Un point',     colour: '#e65100' }
getEurovisionTier(32, 40)  // 80%   → { points: 12, label: 'Douze points', colour: '#ffe57f' }
getEurovisionTier(40, 40)  // 100%  → { points: 12, label: 'Douze points', colour: '#ffe57f' }
```

- [ ] **Step 3: Verify effects in browser console**

```javascript
triggerConfetti()    // Two bursts of blue/yellow/white confetti appear
triggerHeartRain()   // 💔 emojis fall from top of screen
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add getEurovisionTier helper and confetti/heart-rain effects"
```

---

### Task 3: Rewrite `showGameOver()` with theatrical sequence

**Files:**
- Modify: `index.html` (the `showGameOver` function, lines 251–257)

- [ ] **Step 1: Replace `showGameOver()`**

Replace the entire existing `showGameOver` function:

```javascript
    // ── Game over ────────────────────────────────────────────────────────
    function showGameOver() {
      state.phase = 'gameover';
      setPrompt('Game over!');

      const tier   = getEurovisionTier(state.score.correct, state.score.total);
      const isNul  = tier.points === 0;
      const isDouze = tier.points === 12;

      const scoreEl  = document.getElementById('final-score');
      const labelEl  = document.getElementById('final-label');
      const btnEl    = document.getElementById('play-again');
      const spokesEl = document.getElementById('spokesperson');
      const tierEl   = document.getElementById('eur-points-label');

      // Reset state (clear any previous-game transitions before setting values)
      [scoreEl, labelEl, btnEl, spokesEl, tierEl].forEach(el => {
        el.style.transition = 'none';
        el.style.opacity    = '0';
      });
      tierEl.style.transform = 'scale(0.5)';
      tierEl.style.textShadow = '';

      scoreEl.textContent  = `${state.score.correct} / ${state.score.total}`;
      spokesEl.textContent = isNul
        ? 'Oh dear… Europe has voted…'
        : 'Ladies and gentlemen, Europe has voted…';
      tierEl.textContent  = tier.label;
      tierEl.style.color  = tier.colour;
      if (isDouze) tierEl.style.textShadow = `0 0 20px ${tier.colour}`;

      document.getElementById('overlay').classList.remove('hidden');

      // 1. Fade in spokesperson text
      setTimeout(() => {
        spokesEl.style.transition = 'opacity 0.5s';
        spokesEl.style.opacity    = '1';
      }, 50);

      // 2. Slam in points label after spokesperson fade (500ms) + pause (1500ms)
      setTimeout(() => {
        tierEl.style.transition = 'opacity 0.1s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        tierEl.style.opacity    = '1';
        tierEl.style.transform  = 'scale(1)';
        if (isDouze) triggerConfetti();
        if (isNul)   triggerHeartRain();
      }, 2000);

      // 3. Fade in score and Play Again button
      setTimeout(() => {
        [scoreEl, labelEl, btnEl].forEach(el => {
          el.style.transition = 'opacity 0.5s';
          el.style.opacity    = '1';
        });
      }, 4000);
    }
```

- [ ] **Step 2: Verify end-to-end in browser**

Open `index.html`. To skip playing all rounds, in the console:

```javascript
state.remaining = [state.remaining[0]];
```

Then click once on the map (right or wrong). After the reveal delay, the game-over sequence should run:
- Dark overlay appears
- Spokesperson text fades in
- ~2s later: points label slams in with scale animation
- Score and Play Again button fade in ~2s after that

- [ ] **Step 3: Test nul points**

In console, force a nul-points result:

```javascript
state.score = { correct: 0, total: 39 };
state.remaining = [state.remaining[0]];
```

Click somewhere wrong on the map. Verify:
- Spokesperson text reads "Oh dear… Europe has voted…"
- Label reads "Nul points" in red
- 💔 rain falls from the top

- [ ] **Step 4: Test douze points**

In console, force a douze-points result:

```javascript
state.score = { correct: 39, total: 39 };
state.remaining = [state.remaining[0]];
```

Click correctly on the map. Verify:
- Spokesperson text reads "Ladies and gentlemen, Europe has voted…"
- Label reads "Douze points" in gold with glow
- Confetti bursts from bottom-left then bottom-right

- [ ] **Step 5: Test Play Again resets cleanly**

After the game-over sequence completes, click Play Again. Verify:
- Overlay hides immediately
- New game starts with fresh score
- Playing to the end again runs the sequence cleanly (no residual opacity/transform from the previous run)

- [ ] **Step 6: Commit and push**

```bash
git add index.html
git commit -m "feat: Eurovision theatrical end screen with confetti and heart rain"
git push
```
