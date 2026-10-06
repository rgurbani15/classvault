// UI bug-bash: first-launch visibility, empty states, and every screen renders without JS errors.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function boot() {
  const errs = []; const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.addEventListener('error', e => errs.push(e.message)); } }).window;
  const d = w.document, $ = s => d.querySelector(s), st = () => JSON.parse(w.localStorage.getItem('classvault.v1'));
  return { w, d, $, st, errs };
}
async function fresh() { const a = boot(); await sleep(100); a.$('[data-a=on]').click(); a.$('[data-a=on]').click(); a.$('[data-a=fin]').click(); return a; }
const go = (a, id) => { a.$(`nav [data-id=${id}]`).click(); };
const addClass = (a, n) => { go(a, 'classes'); a.$('[data-a=addc]').click(); a.$('#nc').value = n; a.$('[data-a=addc2]').click(); };

test('first launch: Smart Import and Analyze my workload are both visible on Home with zero data', async () => {
  const a = await fresh(); assert.equal(a.st().items.length, 0);
  assert.ok(a.$('main [data-a=si]'), 'Smart Import visible'); assert.ok(a.$('main [data-a=go][data-id=plan]'), 'Analyze visible');
  assert.match(a.$('main').textContent, /Smart Import/); assert.match(a.$('main').textContent, /Analyze my workload/);
});
test('Analyze with no assignments shows guidance and a Smart Import shortcut, not a blank page', async () => {
  const a = await fresh(); a.$('main [data-a=go][data-id=plan]').click();
  assert.match(a.$('main').textContent, /Nothing to plan yet/); assert.ok(a.$('main [data-a=si]'));
});
test('Search tab is never blank: empty vault guidance, then browse pills and recent items', async () => {
  const a = await fresh(); go(a, 'search'); assert.match(a.$('#sres').textContent, /Nothing to search yet/);
  addClass(a, 'Biology'); a.$('[data-a=qs]').click(); a.$('[data-a=ty][data-id=note]').click(); a.$('#f-t').value = 'Cell notes'; a.$('[data-a=sv]').click(); await sleep(80);
  go(a, 'search'); const t = a.$('#sres').textContent; assert.match(t, /Recently saved/); assert.match(t, /Cell notes/); assert.match(t, /Biology/);
  a.$('#sres [data-a=sq][data-q=Biology]').click(); assert.match(a.$('#sres').textContent, /Cell notes/); assert.equal(a.$('#sq').value, 'Biology');
  a.$('#sq').value = 'zzz'; a.$('#sq').dispatchEvent(new a.w.Event('input', { bubbles: true })); assert.match(a.$('#sres').textContent, /No results/);
});
test('every screen renders with no JS errors: empty, with data, and with demo data', async () => {
  const a = await fresh();
  const views = () => { for (const v of ['home', 'vault', 'classes', 'search']) { go(a, v); assert.ok(a.$('main').textContent.trim().length > 20, v + ' is not blank'); } a.$('[data-id=home]'); };
  views();
  addClass(a, 'Math'); for (const t of ['assignment', 'note', 'link', 'file']) { a.$('[data-a=qs]').click(); a.$(`[data-a=ty][data-id=${t}]`).click(); a.$('#f-t').value = 'Item ' + t; a.$('[data-a=sv]').click(); await sleep(60); }
  assert.equal(a.st().items.length, 4); views();
  a.$('[data-id=classes]') && go(a, 'classes'); a.$('[data-a=cl]').click(); assert.ok(a.$('main').textContent.includes('Math'));
  go(a, 'home'); a.$('main [data-a=go][data-id=plan]').click(); a.$('[data-a=demo]').click(); assert.match(a.$('main').textContent, /Workload plan/); views();
  a.$('main [data-id]'); assert.deepEqual(a.errs, []);
});
