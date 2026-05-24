// Run: npm i topojson-client && node scripts/build-uk-lads.mjs <NAME_KEY> <CODE_KEY>
// Reads data/uk-lads.json, prints two constants ready to paste into index.html.
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const topo = JSON.parse(readFileSync('data/uk-lads.json', 'utf8'));
const objKey = Object.keys(topo.objects)[0];
const features = feature(topo, topo.objects[objKey]).features;

const NAME_KEY = process.argv[2] || 'LAD24NM';
const CODE_KEY = process.argv[3] || 'LAD24CD';

const lads = features.map(f => ({
  name: f.properties[NAME_KEY],
  code: f.properties[CODE_KEY],
})).sort((a, b) => a.name.localeCompare(b.name));

console.log(`// ${lads.length} LADs`);
console.log('REGIONS.uk.set:');
console.log('new Set([');
for (const { name } of lads) console.log(`  ${JSON.stringify(name)},`);
console.log(']),');
console.log();
console.log('UK_GSS:');
console.log('{');
for (const { name, code } of lads) console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(code)},`);
console.log('}');
