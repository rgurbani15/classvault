// End-to-end: paste -> worker (real code) -> Workers AI (MOCKED) -> review/edit -> save -> workload plan. Runs the real www/index.html in jsdom.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lymd = n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let current;
const aiReturns = x => { current = x; };
const EXAMPLE = { response: { tasks: [
  { title: 'Read chapters 4-5', className: '', dueText: 'Monday', estimatedMinutes: 60, type: 'reading', subtasks: ['Read chapter 4', 'Read chapter 5'] },
  { title: 'Answer questions 1-10', className: '', dueText: 'Monday', estimatedMinutes: 40, type: 'homework', subtasks: [] },
  { title: '500-word response', className: '', dueText: 'Monday', estimatedMinutes: 75, type: 'essay', subtasks: ['Outline', 'Draft', 'Proofread'] },
  { title: 'Study vocabulary for quiz', className: '', dueText: 'Tuesday', estimatedMinutes: 30, type: 'quiz', subtasks: [] }] } };
async function app(env0 = { RATE_PER_MINUTE: '50', RATE_PER_DAY: '50' }) {
  const env = { ...env0, AI: { run: async () => { if (current instanceof Error) throw current; return current; } } };
  const W = await import('../worker/src/index.js'); W.resetForTests();
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, beforeParse(w) { w.scrollTo = () => {}; w.fetch = (u, i) => W.default.fetch(new Request(u, i), env); } }).window;
  w.eval("SMART_IMPORT_URL='https://proxy.test/api/smart-import'");
  const d = w.document, $ = s => d.querySelector(s), st = () => JSON.parse(w.localStorage.getItem('classvault.v1'));
  await sleep(100); $('[data-a=on]').click(); $('[data-a=on]').click(); $('[data-a=fin]').click();
  return { w, d, $, st, fetchCalls: () => 0 };
}
const paste = (a, text) => { a.$('[data-a=si]').click(); if (a.$('[data-a=siok]')) a.$('[data-a=siok]').click(); a.$('#si-text').value = text; a.$('#si-text').dispatchEvent(new a.w.Event('input', { bubbles: true })); };

test('consent notice explains text goes to an external AI before anything is sent', async () => {
  const a = await app(); a.$('[data-a=si]').click();
  assert.match(a.$('#modal').textContent, /sends the text you paste to ClassVault's AI service/); assert.match(a.$('#modal').textContent, /Built with Llama/); assert.ok(!a.$('#si-text'), 'no textbox before consent');
  a.$('[data-a=siok]').click(); assert.ok(a.$('#si-text')); assert.equal(a.st().aiConsent, true);
});
test('full flow: paste -> AI (mock) -> review/edit -> save -> workload plan', async () => {
  const a = await app(); aiReturns(EXAMPLE);
  paste(a, 'Read chapters 4-5 for Monday, answer questions 1-10, and write a 500-word response. Study the vocabulary because there is a quiz Tuesday.');
  a.$('[data-a=sirun]').click(); await sleep(250);
  assert.match(a.$('#modal').textContent, /Review 4 assignments/); assert.equal(a.st().items.length, 0, 'nothing saved before confirmation');
  a.$('#si-t-0').value = 'Read chapters 4-5 (edited)'; a.$('[data-a=sirm][data-id="1"]').click();
  assert.match(a.$('#modal').textContent, /Review 3 assignments/); assert.equal(a.$('#si-t-0').value, 'Read chapters 4-5 (edited)', 'edit survives removing another task');
  for (let i = 0; i < 3; i++) { a.$('#si-c-' + i).value = '__new__'; a.$('#si-n-' + i).value = 'English'; }
  a.$('[data-a=sisave]').click();
  const s = a.st(); assert.equal(s.items.length, 3); assert.equal(s.classes.length, 1); assert.ok(s.items.every(i => i.ai === 1 && i.type === 'assignment' && i.est > 0 && i.due));
  assert.equal(s.items[0].title, 'Read chapters 4-5 (edited)');
  const text = a.d.body.textContent; assert.match(text, /Workload plan/); assert.match(text, /Read chapters 4-5 \(edited\)/); assert.match(text, /500-word response/);
});
test('review requires a title and a class; cancel saves nothing', async () => {
  const a = await app(); aiReturns(EXAMPLE); paste(a, 'x'); a.$('[data-a=sirun]').click(); await sleep(250);
  a.$('[data-a=sisave]').click(); assert.equal(a.st().items.length, 0, 'class not chosen -> blocked');
  a.$('[data-a=x]').click(); assert.equal(a.st().items.length, 0);
});
test('errors are shown, the text is kept, and the rest of the app still works', async () => {
  let a = await app(); paste(a, ''); a.$('[data-a=sirun]').click(); assert.match(a.$('#modal').textContent, /Paste some assignment text first/);
  a = await app(); aiReturns({ response: 'not json at all' }); paste(a, 'homework'); a.$('[data-a=sirun]').click(); await sleep(250);
  assert.match(a.$('#modal').textContent, /couldn't be used/); assert.equal(a.$('#si-text').value, 'homework');
  a = await app({ RATE_PER_MINUTE: '1' }); aiReturns(EXAMPLE); paste(a, 'a'); a.$('[data-a=sirun]').click(); await sleep(250);
  a.$('[data-a=x]').click(); paste(a, 'b'); a.$('[data-a=sirun]').click(); await sleep(250);
  assert.match(a.$('#modal').textContent, /limit/i);
  a = await app(); aiReturns(new Error('3036: You have used up your daily free allocation of 10,000 neurons')); paste(a, 'd'); a.$('[data-a=sirun]').click(); await sleep(250);
  assert.match(a.$('#modal').textContent, /AI budget/); a.$('[data-a=x]').click();
  a = await app(); a.w.fetch = () => Promise.reject(new TypeError('offline')); paste(a, 'c'); a.$('[data-a=sirun]').click(); await sleep(150);
  assert.match(a.$('#modal').textContent, /Couldn't reach Smart Import/); a.$('[data-a=x]').click();
  a.$('[data-id=classes]').click(); a.$('[data-a=addc]').click(); a.$('#nc').value = 'Still works'; a.$('[data-a=addc2]').click(); assert.equal(a.st().classes.length, 1);
});
