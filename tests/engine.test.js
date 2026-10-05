// Behaviour tests for the Workload Engine. Runs the real www/index.html in jsdom.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function boot() {
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; } }).window;
  const d = w.document, $ = s => d.querySelector(s), st = () => JSON.parse(w.localStorage.getItem('classvault.v1'));
  return { w, d, $, st };
}
async function onboarded() { const a = boot(); await sleep(100); a.$('[data-a=on]').click(); a.$('[data-a=on]').click(); a.$('[data-a=fin]').click(); return a; }
const titles = a => [...a.d.querySelectorAll('article.card h3')].map(x => x.textContent);

test('fresh install is empty and has no demo data', async () => {
  const a = await onboarded(); assert.equal(a.st().classes.length, 0); assert.equal(a.st().items.length, 0);
});
test('estimate is saved and used in the plan', async () => {
  const a = await onboarded(); a.$('[data-id=classes]').click(); a.$('[data-a=addc]').click(); a.$('#nc').value = 'X'; a.$('[data-a=addc2]').click();
  a.$('[data-a=qs]').click(); a.$('[data-a=ty]').click(); a.$('#f-t').value = 'Essay'; a.$('#f-due').value = '2099-01-01'; a.$('#f-e').value = '90'; a.$('[data-a=sv]').click(); await sleep(80);
  assert.equal(a.st().items[0].est, 90);
});
test('finishing a task asks for actual time and stores it', async () => {
  const a = await onboarded(); a.$('[data-id=classes]').click(); a.$('[data-a=addc]').click(); a.$('#nc').value = 'X'; a.$('[data-a=addc2]').click();
  a.$('[data-a=qs]').click(); a.$('[data-a=ty]').click(); a.$('#f-t').value = 'T'; a.$('#f-e').value = '30'; a.$('[data-a=sv]').click(); await sleep(80);
  a.$('[data-id=home]').click(); a.$('[data-a=st]').click(); a.$('[data-a=st]').click();
  assert.match(a.$('#modal').textContent, /How long did it take/); a.$('[data-a=act][data-m="60"]').click();
  assert.equal(a.st().items[0].actual, 60);
});
test('demo data: learned slowness inflates predictions and ranking is sane', async () => {
  const a = await onboarded(); a.d.body.insertAdjacentHTML('beforeend', '<button data-a="go" data-id="plan"></button>'); a.$('body > button[data-a=go]').click(); a.$('[data-a=demo]').click();
  const text = a.d.body.textContent; assert.match(text, /Essay draft/);
  assert.match(text, /About 1h 55m/, '90 min estimate in a class where the student runs ~1.3x slow'); // 90 * ~1.28 rounded to 5
  assert.equal(titles(a)[0], 'Photosynthesis write-up', 'task due tomorrow ranks first');
});
test('fewer hours per day pulls start dates earlier', async () => {
  const a = await onboarded(); a.d.body.insertAdjacentHTML('beforeend', '<button data-a="go" data-id="plan"></button>'); a.$('body > button[data-a=go]').click(); a.$('[data-a=demo]').click();
  const chips = () => [...a.d.querySelectorAll('article.card .chip')].map(c => c.textContent);
  const before = chips(); a.$('#hrs').value = '1'; a.$('#hrs').dispatchEvent(new a.w.Event('change', { bubbles: true }));
  assert.notDeepEqual(chips(), before);
});
test('demo data is fully removable', async () => {
  const a = await onboarded(); a.d.body.insertAdjacentHTML('beforeend', '<button data-a="go" data-id="plan"></button>'); a.$('body > button[data-a=go]').click(); a.$('[data-a=demo]').click(); a.$('[data-a=demox]').click();
  assert.ok(a.st().items.every(i => !i.demo) && a.st().classes.every(c => !c.demo));
});
