# UK Local Authority Districts Mode — Design Spec

## Overview

A fourth option in the existing menu — **UK** — sitting under Eurovision, Europe, and USA. Picking it loads a UK Local Authority Districts (LAD) topojson, reframes the camera to a UK bbox, and runs the existing 25-round game against a pool of ~360 LADs.

The pool is the "bottom tier" of UK local government: non-metropolitan (shire) districts where the two-tier system still exists; unitary authorities, metropolitan districts, London boroughs, Scottish council areas, Welsh principal areas, and Northern Ireland districts elsewhere. No second- or third-tier entities (county councils, combined authorities, ceremonial counties).

Tonally the game keeps its Eurovision shell unchanged. Same scoring, tier mapping, Graham Norton clips, confetti, 25 rounds. Only the map, names, sidebar visuals, and clipboard share text differ.

## Scope

**In scope:**

- New menu item **UK** sourcing data from an ONS LAD topojson (Dec 2024 release or later, covering post-2023 reorganisations).
- Playable set = all ~360 current LADs across the four home nations.
- Council coat-of-arms PNG assets in sidebar, current-round chip, and end-screen ✅/❌ grids. Graceful degradation to no-flag while assets are still being collected.
- Home-nation-emoji-prefixed full LAD names in clipboard share text (`✅ 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Glasgow City`).
- Share URLs round-trip UK games; existing Eurovision/Europe/USA share URLs keep working unchanged.

**Out of scope:**

- Combined authorities, ceremonial counties, historic counties, ITL regions.
- Crown Dependencies (Isle of Man, Jersey, Guernsey).
- British Overseas Territories.
- Region-by-region sub-modes (e.g. "just Scotland").
- UK-specific theming (audio personality, tier renames).
- A loading-state spinner for the LAD topojson fetch.

## Region Descriptor

Add one entry to the existing `REGIONS` table:

```js
uk: {
  source: 'uk',
  bbox:   [-8.5, 2, 49.8, 61],   // [W, E, S, N] — includes Shetland; crops on narrow screens
  set:    new Set(['Cornwall', 'Westminster', 'Glasgow City', /* ...~360... */]),
}
```

The set is keyed by display name. Internally, identity is established by GSS code (see `featureName` and `UK_GSS` below); names are display-only.

## Data Source

**Dataset:** Office for National Statistics "Local Authority Districts (BUC)" — generalised boundaries, suitable for web rendering. December 2024 (or latest available) release, covering the post-2023 single-tier reorganisations of Cumberland, Westmorland & Furness, North Yorkshire, Somerset.

**Sourcing approach** (decide during implementation spike):

1. Direct topojson from a CDN mirror if one publishes a current release.
2. martinjc/UK-GeoJSON if it has been updated post-2023.
3. Fallback: download ONS GeoJSON, convert with `topojson-server`, host at `/data/uk-lads.json` and serve from the same nginx container as `index.html`.

Add `'uk'` to the `loadSource` switch in the same lazy/cached pattern as `world` and `us`.

| Source key | Loaded when |
|------------|-------------|
| `world` | First Eurovision/Europe activation. |
| `us`    | First USA activation. |
| `uk`    | First UK activation. |

## Name Extraction

ONS LAD topojsons store the human-readable name on year-suffixed keys like `LAD24NM`, not `properties.name`. Introduce a per-source name extractor:

```js
function featureName(f) {
  if (currentRegion.source === 'uk') {
    return f.properties.LAD24NM || f.properties.LAD23NM || f.properties.name;
  }
  return f.properties.name;
}
```

Every `feature.properties.name` callsite (`isPlayable`, sidebar render, chip render, reveal handler, share text) routes through `featureName(f)`. Existing world / US callsites are unchanged in behaviour.

`setRegion` also learns the LAD topojson's `objects.<key>` (likely `lad` or similar — confirmed at implementation time and encoded in the small switch already there).

## Visual Identifiers (Coat-of-Arms PNGs)

Following the USA pattern: PNG assets at `flags/uk-<gss>.png`, where `<gss>` is the lowercased ONS GSS code (e.g. `e06000052` for Cornwall, `s12000049` for Glasgow City). GSS codes are stable, unique, and decoupled from name changes.

`UK_GSS` is a new lookup: `'Cornwall' → 'E06000052'`, `'Glasgow City' → 'S12000049'`, etc.

```js
function flagHTML(name) {
  if (currentRegion.source === 'uk') {
    const code = UK_GSS[name];
    return code
      ? `<img class="flag-img" src="flags/uk-${code.toLowerCase()}.png" alt="${name}" onerror="this.style.display='none'">`
      : '';
  }
  if (currentRegion.source === 'us') { /* ...existing... */ }
  /* ...emoji branch unchanged... */
}
```

The `onerror` hides the slot if the PNG is missing — keeps the mode playable while the asset library is still being assembled.

### Asset sourcing

~360 PNGs is significantly more than the 50 USA flags. Done as a scripted pass:

1. Script reads the LAD list (name → GSS code).
2. For each council, hit Wikipedia REST API `/page/summary/<Council name>` to pull the page's lead image URL.
3. Download, resize to ~160px wide, save as `flags/uk-<gss>.png`.
4. Manual cleanup pass for 404s, wrong-image pulls, or councils without a Wikipedia coat-of-arms (use the council logo, or omit and rely on graceful degradation).

Target total size: ~1.5 MB (USA was 224 KB for 50; expect 5–7× at similar per-file weight). Worth a `flags/` size check before merge.

### Share token

`flagShareToken` gets a UK branch:

```js
function flagShareToken(name) {
  if (currentRegion.source === 'uk') {
    return `${homeNationEmoji(name)} ${name}`;
  }
  if (currentRegion.source === 'us') { return US_POSTAL[name] || ''; }
  return countryFlag(name);
}

function homeNationEmoji(name) {
  const code = UK_GSS[name] || '';
  if (code.startsWith('E')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (code.startsWith('S')) return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
  if (code.startsWith('W')) return '🏴󠁧󠁢󠁷󠁬󠁳󠁿';
  return '🇬🇧';   // Northern Ireland (no widely-rendered Unicode flag)
}
```

Share text example: `✅ 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Cornwall 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Glasgow City 🇬🇧 Belfast`. Longer than the USA postal-code line but readable.

### Flag CSS

No new rules — reuses the existing `.flag-img` styling shipped with USA mode (`width: 100%; height: 100%; object-fit: cover; border-radius: 3px`). Container sizes (28×20 sidebar, 44×30 mobile, 1.7rem chip) already established.

## Menu, Switching, Lifecycle

### Menu HTML

```html
<div class="menu-item" data-region="eurovision">Eurovision</div>
<div class="menu-item" data-region="europe">Europe</div>
<div class="menu-item" data-region="usa">USA</div>
<div class="menu-item" data-region="uk">UK</div>
<div class="menu-divider"></div>
<div class="menu-item" id="menu-new-game"><span class="menu-icon">↻</span>New Game</div>
```

### `setRegion` flow

Unchanged from the USA work — `setRegion('uk')` already does the right thing once the descriptor is added:

1. Load `topoCache.uk` if missing.
2. Rebuild `allFeatures` from `topojson.feature(topo, topo.objects.<lad-key>).features`.
3. Refilter `playableFeatures` via `isPlayable` (which now consults `featureName`).
4. Rebuild projection from `currentRegion.bbox`.
5. Reset d3 zoom transform.
6. `startGame()`.

### State on switching

Pin state, score, joyrides, sidebar — all reset by `startGame()`. No new wiring.

### Share URLs

`buildShareUrl` already encodes the region as `s: currentSet`. `'uk'` is just another accepted value. `replayFromHash` awaits the `uk` source load if the cache is empty, then reconstructs pins from coords as today.

## Projection

Unchanged: the existing `buildProjection([w, h], [west, east, south, north])` is bbox-driven. UK bbox `[-8.5, 2, 49.8, 61]` frames Great Britain with Shetland just inside the north edge. On narrow portrait screens Shetland may crop; user pans/zooms to find it (same model as USA hiding AK/HI).

## Game Loop

Identical to existing modes. `startGame` samples 25 LADs from `playableFeatures`; rounds render prompt → click → 750ms pending pin → fill + reveal pin → 1000ms → next round → `showGameOver`. Scoring, tiers, joyrides, sidebar, click-to-zoom, confetti, Graham clips — all unchanged.

## Rename / Refactor Pass

Limited to:

- New `featureName(f)` helper introduced and used at every `feature.properties.name` callsite.
- New `homeNationEmoji(name)` helper.
- `flagHTML` and `flagShareToken` gain a UK branch (existing branches untouched).
- `UK_GSS` and `REGIONS.uk` added; no existing constant deleted or renamed.

No other rename needed — the USA work already collapsed the constants we'd otherwise have to touch.

## Verification

Browser preview, prior to claiming done:

- **Region switching:** All four menu options load and render cleanly. Switching mid-game wipes state and starts a fresh game. Zoom resets on switch.
- **UK game loop:** Click correct LAD → green pin + green ring on sidebar entry; click wrong → red. Pins persist across rounds. Score and miles-off increment.
- **Boundaries are current:** North Yorkshire renders as a single unitary, not the old districts; Cumberland and Westmorland & Furness present as two unitaries, not Cumbria's six districts. Somerset is one unitary.
- **Share round-trip:** Play a UK game, copy URL, open in new tab → board recreates with all pins positioned correctly and the UK region active. Repeat for Eurovision/Europe/USA (back-compat).
- **Share text:** Touch-share text contains the home-nation emoji + full name format.
- **Shetland / Western Isles:** Pan/zoom to find them; verify they click-hit correctly and appear in the sampled pool over a few games.
- **Mobile sidebar:** Expand button works; PNGs render at 44px width; tooltip on tap shows the LAD name. Sidebar scrolling stays smooth with ~360 entries.
- **Missing-asset fallback:** Mode is playable even if some `flags/uk-<gss>.png` files are absent; missing slots render empty rather than as broken-image icons.
- **Pool sampling:** Across ~360 LADs with `ROUND_COUNT = 25`, no duplicates in a single game.

## Risks

- **LAD asset sourcing:** ~360 council coat-of-arms PNGs is the dominant effort and the main scope risk. Scripted Wikipedia scrape gets us most of the way; manual cleanup pass needed. The graceful-degradation `onerror` keeps the mode shippable before the asset library is complete.
- **ONS topojson availability:** Exact stable URL needs research. Worst case: we host our own derived topojson alongside `index.html`. Plan flags this as a first-step implementation spike.
- **LAD name collisions or oddities:** Watch for "City of London" vs "Westminster", "City of Edinburgh", duplicate "Highland" / "Highlands" variants. Match by GSS code internally; names are display-only.
- **Recent boundary changes:** Dataset must be post-2023. Pre-2023 datasets will have wrong shapes for North Yorkshire, Cumbria's successors, and Somerset.
- **Sidebar performance:** 360 DOM entries vs ~50 today. Existing sidebar scrolls; verify perf and consider virtualisation only if needed.
- **Total asset weight:** USA was 224 KB; UK at similar per-file weight is ~1.5 MB. Within reason but should be checked.
