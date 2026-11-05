// Checks the installable-app files are consistent, so a rename or missing icon cannot silently break install or offline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = p => fs.readFileSync('dist/' + p, 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.name && manifest.short_name && manifest.start_url && manifest.theme_color);
for (const i of manifest.icons) {
  const png = fs.readFileSync('dist/' + i.src);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', i.src + ' is a PNG');
  const [w, h] = i.sizes.split('x').map(Number);
  assert.equal(png.readUInt32BE(16), w, i.src + ' width');
  assert.equal(png.readUInt32BE(20), h, i.src + ' height');
}
assert.ok(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'));
assert.ok(manifest.icons.some(i => i.purpose === 'maskable'));
const sw = read('sw.js');
const files = [...sw.match(/const FILES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const f of files) if (f !== './') assert.ok(fs.existsSync('dist/' + f), 'sw.js caches a missing file: ' + f);
const html = read('index.html');
const imports = [...read('app.mjs').matchAll(/from '\.\/([^']+)'/g)].map(m => m[1]);
for (const m of imports) assert.ok(files.includes(m), m + ' is imported by the app but not cached for offline');
for (const f of ['app.mjs', 'style.css', 'manifest.webmanifest']) assert.ok(html.includes(f), 'index.html links ' + f);
assert.ok(files.includes('app.mjs') && files.includes('style.css') && files.includes('index.html'));
for (const v of ['dashboard', 'plan', 'recipes', 'equipment', 'costs', 'shopping', 'reports']) {
  assert.ok(html.includes(`data-view="${v}"`), 'nav has ' + v);
}
console.log('pwa tests passed');
