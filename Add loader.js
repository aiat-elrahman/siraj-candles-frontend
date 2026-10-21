// Run once from your frontend folder:  node add-loader.js
// Adds the page-load counter to every .html page that doesn't have it yet.
const fs = require('fs');
const path = require('path');
const TAG = '<script src="assets/js/loader.js"></script>';
let changed = 0, skipped = 0;
for (const file of fs.readdirSync(__dirname)) {
  if (!file.toLowerCase().endsWith('.html')) continue;
  const full = path.join(__dirname, file);
  let html = fs.readFileSync(full, 'utf8');
  if (html.includes('loader.js')) { skipped++; console.log('already has it :', file); continue; }
  const m = html.match(/<head[^>]*>/i);
  if (!m) { console.log('NO <head> found, skipped:', file); continue; }
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  html = html.replace(m[0], m[0] + eol + '    ' + TAG);
  fs.writeFileSync(full, html, 'utf8');
  changed++; console.log('added          :', file);
}
console.log(`\nDone. ${changed} page(s) updated, ${skipped} already had it.`);