// Rewinds rings in data/uk-lads.json so outer rings are CCW per GeoJSON RFC 7946.
// d3.geoPath under d3.geoMercator treats a CW outer ring as "sphere minus sliver" and
// renders the clipped Mercator projection of the sphere — a viewport-filling rect.
// This script decodes the topojson, rewinds any malformed outer ring, re-encodes,
// and writes the result back in place.
//
// Run: npm i topojson-client topojson-server d3-geo && node scripts/rewind-uk-lads.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import { geoArea } from 'd3-geo';

const INPUT = 'data/uk-lads.json';
const OUTPUT = 'data/uk-lads.json';

const topo = JSON.parse(readFileSync(INPUT, 'utf8'));
const objKey = Object.keys(topo.objects)[0];
const fc = feature(topo, topo.objects[objKey]);

let rewindCount = 0;
function rewindRing(ring) { ring.reverse(); }
function isCW(ring) {
  // d3.geoArea on a Polygon with a single CW outer ring returns ~4π
  // (the sphere area minus the small sliver area). CCW returns the small area.
  return geoArea({ type: 'Polygon', coordinates: [ring] }) > 1;
}

for (const f of fc.features) {
  const g = f.geometry;
  if (g.type === 'Polygon') {
    if (isCW(g.coordinates[0])) {
      rewindRing(g.coordinates[0]);
      rewindCount++;
      console.log('rewound outer ring of', f.properties.LAD24NM);
    }
    // Holes should be CW; we don't touch them here — none flagged in the audit.
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) {
      if (isCW(poly[0])) {
        rewindRing(poly[0]);
        rewindCount++;
        console.log('rewound outer ring (multi) of', f.properties.LAD24NM);
      }
    }
  }
}

console.log(`\nrewound ${rewindCount} ring(s); re-encoding topojson...`);

const newTopo = topology({ [objKey]: fc }, 1e4);
writeFileSync(OUTPUT, JSON.stringify(newTopo));
console.log('wrote', OUTPUT);
