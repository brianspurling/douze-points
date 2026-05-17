# Web Audio Graham Clips — Design Spec

## Overview

Replace the `new Audio()` / HTMLAudioElement playback path for Graham Norton voice clips with a Web Audio API implementation. The current approach is flaky: clips fail to play, or play after a long delay, because (a) MP3s are decoded lazily on first `.play()` call, and (b) `.play()` is invoked from a `setTimeout` chain ~2.5s after the last user click, which has drifted outside the browser's autoplay-gesture window — especially on Safari and iOS.

After this change, every clip is fetched and decoded once at page load, an `AudioContext` is unlocked on the first user interaction, and playback at game-over is a synchronous `AudioBufferSourceNode.start()` call with no network, decode, or gesture-policy work in the hot path.

## Goals

- Game-over clip plays **immediately** when triggered (no perceptible cold-start latency).
- Works reliably across desktop Chrome, Safari, Firefox, and iOS Safari.
- No new runtime dependencies — hand-rolled in inline JS, consistent with the single-file ethos.
- Backwards-compatible with replay (`#replay=...`) and test (`?test=N/M`) URLs.

## Non-goals

- Volume control, ducking, crossfade, mute UI — out of scope.
- Audio sprites or combined-file optimisation — 8 small files load fine in parallel.
- Format fallbacks (Opus/AAC) — MP3 is universal enough for our targets.
- Preserving the old code path behind a feature flag — replace outright.

## Removed

- `currentGrahamAudio` module-local variable (HTMLAudioElement reference).
- The `grahamCache` preload map (`{ path → HTMLAudioElement }`) added in the previous fix.
- The `audio.play().catch(NotAllowedError)` retry-on-pointerdown branch — superseded by AudioContext unlock.
- All `new Audio(...)` construction inside `playGrahamForScore`.

## New module-local state

```js
let audioCtx = null;                       // AudioContext, lazily created
const grahamBuffers = {};                  // { path: AudioBuffer }
let currentGrahamSource = null;            // AudioBufferSourceNode currently playing
```

## Initialisation

At the bottom of `init()` (after `startGame()` is called), kick off preloading. It's fire-and-forget — the game starts immediately, decoding happens in the background.

```js
preloadGrahamClips();
```

`preloadGrahamClips` walks every path in `GRAHAM_CLIPS`, `fetch`es each MP3, calls `arrayBuffer()`, then `audioCtx.decodeAudioData(buf)`, storing the resulting `AudioBuffer` in `grahamBuffers[path]`. Errors are swallowed silently (logged to console only) — a missing clip should never break the game.

`audioCtx` is created lazily inside `preloadGrahamClips` using `new (window.AudioContext || window.webkitAudioContext)()`. Safari historically required the `webkit` prefix; modern Safari accepts plain `AudioContext` but the prefix fallback is a one-token cost.

## Unlocking the context

Browsers create the `AudioContext` in a `suspended` state until the page receives a user gesture. We attach a single one-shot pointerdown listener to the document that calls `audioCtx.resume()`:

```js
document.addEventListener('pointerdown', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true, capture: true });
```

The first click of the first round triggers the unlock. By the time game-over fires 25 rounds later, the context has been running for the whole session.

For test/replay URLs (where no click may have occurred yet), the resume call is harmless — it'll fire on the first interaction the user makes (e.g. clicking Play Again).

## Playback

Replace `playGrahamForScore` with a Web Audio version. Same signature, same bucket-selection logic — only the playback mechanism changes.

```js
function stopGrahamAudio() {
  if (currentGrahamSource) {
    try { currentGrahamSource.stop(); } catch {}
    currentGrahamSource = null;
  }
}

function playGrahamForScore(correct, total) {
  stopGrahamAudio();
  if (total === 0 || !audioCtx) return;
  const pct = (correct / total) * 100;
  const bucket = pct < 41 ? 'brutal' : pct < 63 ? 'backhanded' : 'good';
  const clips = GRAHAM_CLIPS[bucket];
  const path  = clips[Math.floor(Math.random() * clips.length)];
  const buffer = grahamBuffers[path];
  if (!buffer) return;  // still decoding or fetch failed — fail silently

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  currentGrahamSource = source;
  source.onended = () => {
    if (currentGrahamSource === source) currentGrahamSource = null;
  };
}
```

Key properties:

- `source.start()` is synchronous and has no gesture-policy check — the context is already running.
- If the buffer hasn't decoded yet (rare; race condition for very fast game-over via `?test=`), we silently skip rather than fall back to anything async. Decoded clips are typically ready within a few hundred ms of page load.
- `currentGrahamSource` tracking lets `stopGrahamAudio()` cancel an in-flight clip (e.g. user starts a new game while Graham is still speaking).

## Call sites — no changes

- `stopGrahamAudio()` still called from `startGame()` to cancel any in-flight clip on Play Again.
- `playGrahamForScore(state.score.correct, state.score.total)` still called from the 2500ms timeout inside `showGameOver()`.

## Test plan

- **Desktop Chrome**: full game → game-over → clip plays immediately, no delay.
- **Desktop Safari**: same. Especially watch for autoplay-policy console warnings.
- **iOS Safari**: full game on iPhone. Most fragile platform — verify clip plays without requiring an extra tap after game-over.
- **Replay URL**: open `#replay=...` directly. Clip should play after the user clicks anywhere (e.g. Play Again) to unlock the context. If they never click, no clip — acceptable.
- **Test URL**: `?test=3/25` → score card → clip plays after the user clicks anywhere on the page (same caveat as replay).
- **Play Again mid-clip**: start a game while Graham is still talking. Clip should stop cleanly, no overlap with next round's audio.
- **Cold start race**: throttle network to "Slow 3G" in DevTools, then open `?test=12/25` — clip should either play (if decoded in time) or skip silently (if not). No errors in console.

## File-by-file change list

Single file: `index.html`.

- **Remove**: `currentGrahamAudio`, the `grahamCache` preload loop, the old `playGrahamForScore` body, the `stopGrahamAudio` body.
- **Add**: `audioCtx`, `grahamBuffers`, `currentGrahamSource` module-local vars; `preloadGrahamClips` function; the pointerdown unlock listener; the new `playGrahamForScore` and `stopGrahamAudio` bodies; the `preloadGrahamClips()` call at the end of `init()`.

No CSS, no HTML, no other JS changes.
