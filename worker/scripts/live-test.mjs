// LIVE test against a deployed (or `wrangler dev`) Worker through Cloudflare Workers AI (no API key involved).
//   WORKER_URL=https://classvault-smart-import.<you>.workers.dev/api/smart-import node worker/scripts/live-test.mjs
// Sends 3 realistic inputs (waits 21s between calls to respect the 3/minute limit), prints what came back, and runs sanity checks.
// The checks are heuristics: ALWAYS read the printed output yourself, especially for invented titles/dates.
const URL_ = process.env.WORKER_URL; if (!URL_) { console.error('Set WORKER_URL'); process.exit(2); }
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nextDow = dow => { const d = new Date(), n = ((dow - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + n); return ymd(d); };
const deviceId = 'live-' + Math.random().toString(36).slice(2, 12), today = ymd(new Date());
const cases = [
  { name: 'Example 1: reading + questions + response + quiz', text: 'Read pages 142-158 for Monday, answer questions 1-10, and write a 500 word response. Study vocabulary because there is a quiz Tuesday.', classes: [],
    check: t => [[t.length >= 3 && t.length <= 5, `3-5 tasks (got ${t.length})`], [t.some(x => /vocab|quiz/i.test(x.title) && x.dueDate === nextDow(2)), 'vocab/quiz task due next Tuesday'], [t.filter(x => /read|question|response/i.test(x.title)).every(x => x.dueDate === nextDow(1)), 'reading/questions/response due next Monday'], [t.every(x => x.estimatedMinutes >= 5 && x.estimatedMinutes <= 480), 'estimates in range']] },
  { name: 'Example 2: chemistry worksheet', text: 'Finish the chemistry lab worksheet, calculate the molarity for each solution, and turn it in by Friday.', classes: ['Chemistry', 'English'],
    check: t => [[t.length >= 1 && t.length <= 3, `1-3 tasks (got ${t.length})`], [t.every(x => x.dueDate === nextDow(5)), 'all due next Friday'], [t.some(x => /chem/i.test(x.className)), 'class identified as Chemistry']] },
  { name: 'Example 3: deliberately messy / incomplete', text: 'ok so mr patterson said something about the thing from last week?? also theres a packet maybe, i think its the blue one. bring stuff for the lab thing. not sure when any of this is due', classes: ['Chemistry', 'English'],
    check: t => [[t.every(x => x.dueDate === ''), 'NO invented due dates'], [t.every(x => x.className === ''), 'NO invented class (none was stated)'], [t.length <= 4, `no over-extraction (got ${t.length})`]] },
];
let failed = 0;
for (const [i, c] of cases.entries()) {
  if (i) await new Promise(r => setTimeout(r, 21000));
  console.log(`\n=== ${c.name}\n> ${c.text}`);
  const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: c.text, today, classes: c.classes, deviceId }) });
  const j = await r.json().catch(() => ({}));
  console.log('HTTP', r.status); if (!r.ok) { console.log(j); failed++; continue; }
  for (const t of j.tasks) console.log(`- ${t.title} | class: ${t.className || '(blank)'} | due: ${t.dueDate || '(blank)'} | ${t.estimatedMinutes} min | ${t.type} | steps: ${t.subtasks.join('; ') || '(none)'}`);
  for (const [ok, label] of c.check(j.tasks)) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failed++; }
}
console.log(failed ? `\n${failed} check(s) failed: read the output above, then adjust the prompt in worker/src/index.js (SYSTEM) rather than adding code.` : '\nAll heuristic checks passed. Still read the output for invented content.');
process.exit(failed ? 1 : 0);
