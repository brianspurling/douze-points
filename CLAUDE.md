# Douze Points

Single-file client-side Eurovision-themed geography game. Player is asked to click on a named European country; after a 750ms delay the country fills in and a green/red pin reveals whether the click was inside its boundary. Running score, persistent pins/fills across rounds, auto-starts on page load.

## Stack

- **Single file:** `index.html` — inline CSS + inline JS, no build step.
- **D3 v7** + **TopoJSON client v3** loaded from jsDelivr.
- **world-atlas v2** (`countries-110m.json`) for country boundaries.
- **fly.io** for deployment: `Dockerfile` (nginx:alpine) + `fly.toml` (app `douze-points`, region `lhr`).

## Architecture

- `init()` loads the world-atlas data, filters to European-centroid countries (`isEuropean`: centroid in lon [-11, 32], lat [35, 72]), renders them as SVG paths, then calls `startGame()`.
- **Projection:** custom Mercator scale/translate math in `buildProjection()`. `d3.geoPath.bounds` was unusable on a polygon bbox because it curves great-circle edges and inflates the bounds wildly — we compute scale directly from `lonSpan` and `latSpan` in Mercator units and use `Math.min` (fit-mode) so no part of Europe is cropped at any aspect ratio.
- **Game loop:** `startGame` → `startRound` → click handler drops pending pin → 750ms → `reveal` fills country, colours pin, updates score → 1000ms → next round or `showGameOver`.
- **Match-by-reference:** countries are matched by feature object identity (`d === feature`), not numeric `id`, because Kosovo has `id: null` in the dataset. Names come from `feature.properties.name`.
- **Pins** store geographic coords (`{lon, lat, correct, name}`) so they reproject correctly on window resize.

## Visual

- Unified land colour (`#3a4a6b`) for every rendered country, with stroke matching fill so internal borders are invisible. Europe reads as a single shape.
- No top bar — prompt, score, and New Game button float as fixed-position overlays so the map fills the full viewport.

## Notable exclusions

- **Cyprus** — centroid (lon 33.04) is just outside the `isEuropean` filter, so it isn't rendered.
- **Malta** — not present in the 110m world-atlas dataset at all.
- **Russia / Turkey / North Africa** — excluded by the centroid filter.

## CI/CD

- **GitHub remote:** https://github.com/brianspurling/douze-points
- **Auto-deploy:** `.github/workflows/deploy.yml` — pushes to Fly.io on every merge to `main` via `flyctl deploy --remote-only`.
- Requires `FLY_API_TOKEN` secret set in GitHub repository settings.

## Run

Open `index.html` in any browser, or `fly deploy` to push to https://douze-points.fly.dev.

## Docs

- Design spec: [`docs/superpowers/specs/2026-05-15-guess-the-country-design.md`](docs/superpowers/specs/2026-05-15-guess-the-country-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-15-guess-the-country.md`](docs/superpowers/plans/2026-05-15-guess-the-country.md)
