// Fallback crest fetch for LADs the GSS-code pass (fetch-uk-coa.mjs) missed.
//
// Many councils have a coat of arms on Commons but their Wikidata item lacks the
// P836 GSS code we matched on. This pass instead resolves each missing LAD's
// Wikidata QID via its English Wikipedia article (pageprops.wikibase_item), then
// reads P94 (coat of arms) / P41 (flag) from that item. Still accurate — we only
// accept an explicit coat-of-arms/flag claim, never a lead-image guess.
//
// Run: node scripts/fetch-uk-coa-fallback.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';

const UA = 'douze-points-game/1.0 (https://douze-points.fly.dev; brian.spurling@cogo.co)';
const misses = JSON.parse(readFileSync('scripts/fetch-uk-coa.misses.json', 'utf8'))
  .filter(m => m.reason === 'no wikidata image' || /HTTP/.test(m.reason));

// Candidate enwiki article titles for a LAD name.
function titleCandidates(name) {
  const c = [name];
  // "Kingston upon Hull, City of" -> "Kingston upon Hull"; "Herefordshire, County of" -> "Herefordshire"
  const stripped = name.replace(/,\s*(City|County|Borough) of$/i, '').trim();
  if (stripped !== name) c.push(stripped);
  // "Bristol, City of" -> "Bristol"
  if (/^Bristol/.test(name)) c.push('Bristol');
  return [...new Set(c)];
}

async function jget(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// 1. Resolve QIDs via enwiki pageprops (batch up to 40 titles).
const titleToCode = {};
const allTitles = [];
for (const m of misses) {
  for (const t of titleCandidates(m.name)) { titleToCode[t] = m.code; allTitles.push(t); }
}
const qidByCode = {};
for (let i = 0; i < allTitles.length; i += 40) {
  const batch = allTitles.slice(i, i + 40);
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item&redirects=1&titles='
    + encodeURIComponent(batch.join('|'));
  const data = await jget(url);
  // map redirected/normalised titles back to our codes
  const norm = {};
  for (const n of (data.query?.normalized || [])) norm[n.to] = n.from;
  for (const rd of (data.query?.redirects || [])) norm[rd.to] = rd.from;
  for (const p of Object.values(data.query?.pages || {})) {
    const qid = p.pageprops?.wikibase_item;
    if (!qid) continue;
    let title = p.title;
    // walk normalisation/redirect chain back to an original candidate
    let guard = 0;
    while (norm[title] && guard++ < 5) title = norm[title];
    const code = titleToCode[title] || titleToCode[p.title];
    if (code && !qidByCode[code]) qidByCode[code] = qid;
  }
  await new Promise(r => setTimeout(r, 200));
}
console.log('Resolved QIDs for', Object.keys(qidByCode).length, 'of', misses.length, 'missing LADs.');

// 2. wbgetentities -> P94 (coat of arms) / P41 (flag) Commons filename.
const codeByQid = Object.fromEntries(Object.entries(qidByCode).map(([c, q]) => [q, c]));
const qids = Object.values(qidByCode);
const fileByCode = {};
for (let i = 0; i < qids.length; i += 40) {
  const batch = qids.slice(i, i + 40);
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' + batch.join('|');
  const data = await jget(url);
  for (const [qid, ent] of Object.entries(data.entities || {})) {
    const claim = ent.claims?.P94?.[0] || ent.claims?.P41?.[0];
    const file = claim?.mainsnak?.datavalue?.value;
    if (file) fileByCode[codeByQid[qid]] = file;
  }
  await new Promise(r => setTimeout(r, 200));
}
console.log('Found coat-of-arms/flag for', Object.keys(fileByCode).length, 'additional LADs.\n');

// 3. Download + resize.
const stillMissing = [];
let ok = 0;
for (const m of misses) {
  const out = `flags/uk-${m.code.toLowerCase()}.png`;
  if (existsSync(out)) { ok++; continue; }
  const file = fileByCode[m.code];
  if (!file) { stillMissing.push({ name: m.name, code: m.code }); continue; }
  const thumbUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=200';
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
    await sharp(buf).resize({ width: 160 }).png().toFile(out);
    ok++;
    console.log('ok  ', out, '(' + m.name + ')');
  } catch (e) {
    stillMissing.push({ name: m.name, code: m.code, reason: e.message });
    console.log('FAIL', m.name, '-', e.message);
  }
  await new Promise(r => setTimeout(r, 300));
}

writeFileSync('scripts/fetch-uk-coa.misses.json', JSON.stringify(stillMissing, null, 2));
console.log(`\nFallback done. ${ok - (misses.length - stillMissing.length - Object.keys(fileByCode).length)} new. Still missing: ${stillMissing.length} -> scripts/fetch-uk-coa.misses.json`);
