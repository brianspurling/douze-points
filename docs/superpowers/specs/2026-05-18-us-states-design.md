# US States Mode — Design Spec

## Overview

A third option in the existing menu — **USA** — sitting under Eurovision and Europe. Picking it loads a US states topojson, reframes the camera to a US bbox (contiguous 48 in view; Alaska and Hawaii rendered and playable but you pan/zoom to find them, as Australia works today in Eurovision mode), and plays the same 25-round game against all 50 states.

Tonally the game keeps its Eurovision shell unchanged in US mode — same scoring, same "Douze points" tier system, same Graham Norton voice clips, same confetti. The only US-specific change visible to the player is the map itself and the flags shown next to state names.

## Scope

**In scope:**

- New menu item **USA** sourcing data from `us-atlas@3/states-10m.json`.
- Playable set = all 50 states.
- SVG state flags in sidebar, current-round chip, and end-screen ✅/❌ grids.
- Postal abbreviations (`✅ CA TX FL`) in clipboard share text.
- Generalising the region descriptor so existing Eurovision/Europe sets continue to work via the same code path.
- Switching regions mid-session reloads data, refits camera, resets zoom, starts a new game.
- Share URLs that round-trip US games; existing Eurovision/Europe share URLs keep working unchanged.

**Out of scope:**

- US-specific theming (e.g. Electoral College tiers, US-themed audio personality). Eurovision shell stays as-is.
- DC, territories (Puerto Rico, Guam, US Virgin Islands, etc.).
- AlbersUSA projection — "normal globe" Mercator with US bounds is the call.
- A region picker on the end screen.
- Loading-state UI for the us-atlas fetch.

## Region Descriptor

`COUNTRY_SETS` + the `EU_WEST/EAST/SOUTH/NORTH` constants collapse into a single `REGIONS` table:

```js
const REGIONS = {
  eurovision: {
    source: 'world',                       // dataset key
    bbox:   [-11, 41, 34, 71],             // [W, E, S, N]
    set:    new Set(['Albania', 'Andorra', /* ... */ 'United Kingdom']),
  },
  europe: {
    source: 'world',
    bbox:   [-11, 41, 34, 71],
    set:    new Set(['Albania', 'Andorra', /* ... */ 'Vatican']),
  },
  usa: {
    source: 'us',
    bbox:   [-125, -66, 24, 50],
    set:    new Set(['California', 'Texas', /* ... 48 more ... */ 'Wyoming']),
  },
};
```

`currentSet` (string key) → `currentRegion` (looked up via `REGIONS[currentSet]`).

`feature.properties.name` is the match key for both world-atlas and us-atlas, so `isPlayable(f)` stays a one-liner: `currentRegion.set.has(f.properties.name)`.

## Data Loading

Two datasets, loaded on demand and cached on a `topoCache` map:

| Source key | URL                                                                 | Loaded when                          |
|------------|---------------------------------------------------------------------|--------------------------------------|
| `world`    | `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json`     | First Eurovision/Europe activation (today: at page load). |
| `us`       | `https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json`           | First USA activation.                |

Page load fetches the `world` source as today (so Eurovision still auto-starts with no extra latency). The `us` source is fetched on first switch to USA. No spinner; if perceptibly slow in practice, revisit.

## Projection

`buildProjection` takes the bbox as an argument instead of reading globals:

```js
function buildProjection([w, h], [west, east, south, north]) {
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const lonSpan = (east - west) * Math.PI / 180;
  const latSpan = mercY(north) - mercY(south);
  const scale = Math.min(w / lonSpan, h / latSpan);
  return d3.geoMercator()
    .scale(scale)
    .center([(west + east) / 2, (north + south) / 2])
    .translate([w / 2, h / 2]);
}
```

`EU_WEST/EAST/SOUTH/NORTH` constants are deleted (folded into the per-region `bbox`). The window-resize handler reads `currentRegion.bbox`.

USA bbox `[-125, -66, 24, 50]` frames the contiguous 48 with a small margin. Alaska and Hawaii are off-frame by default but still rendered in the world layer and still playable; the user pans/zooms to find them.

## Flag Rendering

The current emoji helper:

```js
function countryFlag(name) {
  const code = ISO2[name];
  if (!code) return '';
  return [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
```

Splits into two helpers — one returning HTML for the DOM, one returning a short token for share text:

```js
function flagHTML(name) {
  if (currentRegion.source === 'us') {
    const code = US_POSTAL[name];
    return code ? `<img class="flag-img" src="flags/us-${code.toLowerCase()}.svg" alt="${name}">` : '';
  }
  const code = ISO2[name];
  if (!code) return '';
  return [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

function flagShareToken(name) {
  if (currentRegion.source === 'us') {
    return US_POSTAL[name] || '';
  }
  return countryFlag(name);  // unchanged emoji string
}
```

`US_POSTAL` is a new lookup: `'California' → 'CA'`, `'Texas' → 'TX'`, etc.

Call sites:
- **Sidebar entry flag** — switch `textContent = countryFlag(name)` to `innerHTML = flagHTML(name)`.
- **Current-round chip flag** (`.esc-flag`) — same swap.
- **End-screen ✅/❌ grids** — already use template-literal HTML; just substitute `flagHTML` for `countryFlag`.
- **Share text** (`buildShareText`) — substitute `flagShareToken` for `countryFlag`.

### Flag assets

50 SVG state flags committed at `flags/us-<code>.svg` (lowercase postal code). Sourced from public-domain Wikipedia versions, normalised to ~1.5:1 aspect to fit the existing 28×20 sidebar slot. Highly detailed flags (Maryland, Massachusetts, Louisiana etc.) downsampled if needed to keep the total under ~250KB.

### Flag CSS

A new rule sits alongside the existing emoji-driven `.entry-flag`:

```css
.flag-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  border-radius: 3px;
}
```

The 28×20 / 44×~30 (mobile expanded) / 1.7rem (current-chip) sizes already live on the parent `.entry-flag` / `.esc-flag`; the img fills its container.

## Menu, Switching, and Lifecycle

### Menu HTML

```html
<div class="menu-item" data-region="eurovision">Eurovision</div>
<div class="menu-item" data-region="europe">Europe</div>
<div class="menu-item" data-region="usa">USA</div>
<div class="menu-divider"></div>
<div class="menu-item" id="menu-new-game"><span class="menu-icon">↻</span>New Game</div>
```

`data-set` → `data-region` everywhere; `setCountrySet(setName)` → `setRegion(regionKey)`.

### `setRegion` flow

1. If `topoCache[REGIONS[key].source]` is missing, `await d3.json(url)`, cache it.
2. Rebuild `allFeatures` from the cached topojson (`topojson.feature(topo, topo.objects.<states|countries>).features`).
3. Refilter into `playableFeatures` (`europeFeatures` is renamed throughout to this clearer name).
4. Rebuild projection from `currentRegion.bbox`.
5. `renderWorld()` and `renderCountries()`.
6. Reset the d3 zoom transform (`svg.call(zoom.transform, d3.zoomIdentity)`) so a Europe→USA switch doesn't leave the camera mid-Atlantic.
7. `startGame()`.

### Topojson object key

`world-atlas` uses `topo.objects.countries`; `us-atlas` uses `topo.objects.states`. The descriptor carries an implicit assumption: `source: 'world' → objects.countries`, `source: 'us' → objects.states`. Encoded in a small switch inside `setRegion`.

### State on switching

Pin state, score, joyrides, sidebar — all reset by `startGame()`, which is already called at the end of `setRegion`. No new wiring.

### Share URLs

`buildShareUrl()` already encodes the region as `s: currentSet`. After this change `currentSet` can be `'usa'` in addition to `'eurovision'` / `'europe'` — no schema change needed beyond accepting the new value in `replayFromHash`.

`replayFromHash`:
- Reads `data.s` and looks it up in `REGIONS`. If the region's source is `'us'` and the cache is empty, `await` the us-atlas load before reconstructing pins. (One added `await`; existing flow otherwise unchanged.)
- Old `s=eurovision` and `s=europe` URLs continue to round-trip unchanged.

### Favicon

Stays 🇪🇺. Not worth swapping per region.

## Rename Pass

Bundled with this change rather than deferred — limited to one file:

- `EU_WEST`, `EU_EAST`, `EU_SOUTH`, `EU_NORTH` constants → deleted (subsumed into `REGIONS.*.bbox`).
- `COUNTRY_SETS` → deleted (subsumed into `REGIONS.*.set`).
- `currentSet` → kept as a string key (`'eurovision' | 'europe' | 'usa'`); `currentRegion` derived as `REGIONS[currentSet]` where needed.
- `europeFeatures` → `playableFeatures`.
- `isPlayable(feature)` → unchanged signature; body reads from `currentRegion.set`.
- `setCountrySet` → `setRegion`.
- `data-set` HTML attribute → `data-region`.

## Verification

Browser preview, prior to claiming done:

- **Region switching:** All three menu options load and render cleanly. Switching mid-game wipes state and starts a fresh game. Zoom resets on switch.
- **US game loop:** Click correct state → green pin + green ring on sidebar entry; click wrong → red. Pins persist across rounds. Score and miles-off increment.
- **Share round-trip:** Play a US game, copy URL, open in a new tab — board recreates with all pins positioned correctly and the USA region active. Repeat for an Eurovision game (back-compat).
- **Share text:** Touch-share text contains `✅ CA TX FL` style postal abbreviations, not emoji.
- **AK / HI:** Pan/zoom out far enough to find them; verify they click-hit correctly and are present in the sampled pool over a few games.
- **Mobile sidebar:** Expand button works; state flags render at the 44px width; tooltip on tap shows the state name.
- **Pool sampling:** Across 50 states with `ROUND_COUNT = 25`, no duplicates in a single game.

## Risks

- **us-atlas property shape:** If `feature.properties.name` isn't populated by us-atlas v3 the way world-atlas populates it, the set-membership check needs a per-source name extractor. The fallback name source on us-atlas is `properties.name` or a FIPS-id-to-name lookup table — easy to add if needed but worth confirming first thing during implementation.
- **SVG weight:** Some state flags (Maryland, Massachusetts, Louisiana, Mississippi) have heavy detail. Need to downsample or pick lower-detail public-domain variants to keep `flags/` directory under ~250KB total.
- **Mercator stretches Alaska:** Mercator on a bbox that doesn't include AK still projects AK if the user pans there — and Mercator badly distorts at AK latitudes. Acceptable cost; the user is choosing to look there.
