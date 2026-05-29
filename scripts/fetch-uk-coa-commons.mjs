// Commons-search crest pass for LADs still missing after the Wikidata passes.
//
// For each missing LAD, search Wikimedia Commons (File namespace) for the council
// name + "coat of arms". Accept a result ONLY if its filename contains a strong
// heraldry keyword AND a distinctive token from the council name — this keeps out
// neighbouring towns, football clubs, and historic counties. Downloads ACCEPTED
// candidates to flags/_commons_staging/ (NOT flags/) so they can be eyeballed
// before promotion. Writes a manifest mapping code -> chosen file for review.
//
// Run: node scripts/fetch-uk-coa-commons.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const UA = 'douze-points-game/1.0 (https://douze-points.fly.dev; brian.spurling@cogo.co)';
const STAGE = 'flags/_commons_staging';
if (!existsSync(STAGE)) mkdirSync(STAGE, { recursive: true });

const missing = JSON.parse(readFileSync('scripts/uk-missing.json', 'utf8'));

const HERALDRY = /(coat[\s_-]?of[\s_-]?arms|\barms\b|crest|heraldry|coa\b|armorial)/i;
const STOP = new Set(['city','council','borough','district','county','of','and','the','royal','metropolitan','upon','le','north','south','east','west','central','greater']);

// Distinctive lower-cased tokens from a council name (drop generic admin words).
function nameTokens(name) {
  return name.toLowerCase()
    .replace(/[,'().]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOP.has(t));
}

async function jget(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const manifest = [];
let staged = 0;

for (const { name, code } of missing) {
  const tokens = nameTokens(name);
  if (!tokens.length) { manifest.push({ code, name, result: 'no distinctive token' }); continue; }

  const searchUrl = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search'
    + '&srnamespace=6&srlimit=15&srsearch=' + encodeURIComponent(`${name} coat of arms`);
  let hits;
  try { hits = (await jget(searchUrl)).query?.search || []; }
  catch (e) { manifest.push({ code, name, result: 'search failed: ' + e.message }); continue; }

  // Accept first hit whose title has a heraldry keyword AND a distinctive name token.
  const chosen = hits.map(h => h.title).find(title => {
    const low = title.toLowerCase();
    return HERALDRY.test(low) && tokens.some(t => low.includes(t));
  });

  if (!chosen) { manifest.push({ code, name, result: 'no confident match', candidates: hits.slice(0, 5).map(h => h.title) }); continue; }

  const file = chosen.replace(/^File:/, '');
  const thumbUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=200';
  const out = `${STAGE}/uk-${code.toLowerCase()}.png`;
  try {
    let buf = null, lastErr = null;
    for (let a = 0; a < 5; a++) {
      const r = await fetch(thumbUrl, { headers: { 'User-Agent': UA } });
      if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); break; }
      lastErr = new Error('HTTP ' + r.status);
      if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1000 * (a + 1))); continue; }
      break;
    }
    if (!buf) throw lastErr;
    await sharp(buf).resize({ width: 80 }).png({ palette: true, quality: 90, effort: 8 }).toFile(out);
    staged++;
    manifest.push({ code, name, result: 'staged', file: chosen });
    console.log('stage', out, '<-', chosen);
  } catch (e) {
    manifest.push({ code, name, result: 'download failed: ' + e.message, file: chosen });
    console.log('FAIL ', name, '-', e.message);
  }
  await new Promise(r => setTimeout(r, 250));
}

writeFileSync('scripts/uk-commons-manifest.json', JSON.stringify(manifest, null, 2));
const matched = manifest.filter(m => m.result === 'staged').length;
const noMatch = manifest.filter(m => m.result === 'no confident match').length;
console.log(`\nStaged ${staged} candidates (${matched} matched). ${noMatch} had no confident match.`);
console.log('Review flags/_commons_staging/ then run the promote step for accepted ones.');
console.log('Manifest: scripts/uk-commons-manifest.json');
