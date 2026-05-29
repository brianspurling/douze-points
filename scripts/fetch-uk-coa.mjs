// Fetches council coat-of-arms (or flag) PNGs for every UK LAD.
//
// Strategy: query Wikidata by GSS code (P836) for each LAD's item, read the
// coat-of-arms image (P94), falling back to flag (P41). Download the Commons
// file at 200px wide, resize to 160px PNG, save as flags/uk-<gss>.png.
// Wikidata-by-code is far more accurate than scraping Wikipedia lead images
// (which often return council-building photos or locator maps).
//
// Misses (no Wikidata item, or item with no P94/P41) are written to
// scripts/fetch-uk-coa.misses.json for a manual pass. Missing crests degrade
// gracefully in the UI via the <img onerror> handler.
//
// Run: npm i sharp && node scripts/fetch-uk-coa.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';
import sharp from 'sharp';

const topo = JSON.parse(readFileSync('data/uk-lads.json', 'utf8'));
const objKey = Object.keys(topo.objects)[0];
const lads = feature(topo, topo.objects[objKey]).features.map(f => ({
  name: f.properties.LAD24NM,
  code: f.properties.LAD24CD,
}));

if (!existsSync('flags')) mkdirSync('flags');

// --- 1. One SPARQL query: GSS code -> coat of arms / flag Commons filename ---
const codes = lads.map(l => `"${l.code}"`).join(' ');
const query = `
SELECT ?code ?coa ?flag WHERE {
  VALUES ?code { ${codes} }
  ?item wdt:P836 ?code .
  OPTIONAL { ?item wdt:P94 ?coa . }
  OPTIONAL { ?item wdt:P41 ?flag . }
}`;

console.log('Querying Wikidata for', lads.length, 'GSS codes...');
const sparqlUrl = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
const res = await fetch(sparqlUrl, {
  headers: { 'User-Agent': 'douze-points-game/1.0 (UK LAD crest fetch)', 'Accept': 'application/sparql-results+json' },
});
if (!res.ok) { console.error('SPARQL failed:', res.status, await res.text()); process.exit(1); }
const data = await res.json();

// code -> commons file URL (prefer coat of arms, else flag)
const imageByCode = {};
for (const b of data.results.bindings) {
  const code = b.code.value;
  const url = b.coa?.value || b.flag?.value;
  if (url && !imageByCode[code]) imageByCode[code] = url;
}
console.log('Wikidata returned images for', Object.keys(imageByCode).length, 'of', lads.length, 'LADs.\n');

// --- 2. Download + resize each ---
// Commons image URLs from Wikidata look like
//   http://commons.wikimedia.org/wiki/Special:FilePath/<File>.svg
// Append ?width=200 to get a rasterised thumbnail (works for SVG and bitmap).
const misses = [];
let ok = 0;

for (const { name, code } of lads) {
  const out = `flags/uk-${code.toLowerCase()}.png`;
  if (existsSync(out)) { ok++; continue; }

  const commonsUrl = imageByCode[code];
  if (!commonsUrl) { misses.push({ name, code, reason: 'no wikidata image' }); continue; }

  try {
    const thumbUrl = commonsUrl + '?width=200';
    let buf = null, lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await fetch(thumbUrl, {
        headers: { 'User-Agent': 'douze-points-game/1.0 (https://douze-points.fly.dev; brian.spurling@cogo.co)' },
      });
      if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); break; }
      lastErr = new Error('HTTP ' + r.status);
      if (r.status === 429 || r.status >= 500) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));  // linear backoff
        continue;
      }
      break;  // non-retryable
    }
    if (!buf) throw lastErr;
    await sharp(buf).resize({ width: 160, withoutEnlargement: false }).png().toFile(out);
    ok++;
    console.log('ok  ', out, '(' + name + ')');
  } catch (e) {
    misses.push({ name, code, reason: e.message, url: commonsUrl });
    console.log('FAIL', name, '-', e.message);
  }
  await new Promise(r => setTimeout(r, 300));
}

writeFileSync('scripts/fetch-uk-coa.misses.json', JSON.stringify(misses, null, 2));
console.log(`\nDone. ${ok}/${lads.length} crests saved. ${misses.length} misses -> scripts/fetch-uk-coa.misses.json`);
