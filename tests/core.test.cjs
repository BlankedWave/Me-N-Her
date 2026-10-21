const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
const pure = source.slice(source.indexOf('  const clone = '), source.indexOf('  function showToast('));
const utilities = vm.runInNewContext(`(() => { ${pure}\n return {
  normalize, localDay, previousDay, escapeHtml, inviteCode,
  displayMood, streakCount, dateCount
}; })()`, { crypto: webcrypto, Date, Intl, console });

test('fresh normalization starts with no fabricated activity', () => {
  const s = utilities.normalize(null);
  assert.equal(s.messages.length, 0);
  assert.equal(s.plans.length, 0);
  assert.equal(s.moments.length, 0);
  assert.deepEqual(Object.keys(s.moods), []);
  assert.equal(utilities.streakCount(s, 'demo'), 0);
});

test('legacy content is retained and assigned stable IDs', () => {
  const s = utilities.normalize({ messages: [{who:'me',text:'Hello'}],
    plans: [{title:'Plan',done:false}], moments: [{title:'Memory'}] });
  assert.equal(s.messages[0].id, 'legacy-message-0');
  assert.equal(s.plans[0].id, 'legacy-plan-0');
  assert.equal(s.moments[0].id, 'legacy-moment-0');
});

test('HTML content is escaped, including attributes and text', () => {
  assert.equal(utilities.escapeHtml(`<img src="x" onerror='evil()'>&`),
    '&lt;img src=&quot;x&quot; onerror=&#39;evil()&#39;&gt;&amp;');
});

test('codes have eight permitted random characters with no observed collision', () => {
  const codes = new Set();
  for (let i = 0; i < 1000; i++) {
    const code = utilities.inviteCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    codes.add(code);
  }
  assert.equal(codes.size, 1000);
});

test('previousDay works across leap-day and year boundaries', () => {
  assert.equal(utilities.previousDay('2024-03-01'), '2024-02-29');
  assert.equal(utilities.previousDay('2026-01-01'), '2025-12-31');
});

test('moods are member-specific; unidentified legacy mood never assigned to partner', () => {
  const s = utilities.normalize({ moods: { '2026-10-21': { a: 'bright', b: 'low' } } });
  assert.equal(utilities.displayMood(s, '2026-10-21', 'a'), 'bright');
  assert.equal(utilities.displayMood(s, '2026-10-21', 'b'), 'low');
  assert.equal(utilities.displayMood(s, '2026-10-21', 'c'), null);
  const legacy = utilities.normalize({ moods: { '2026-10-21': 'steady' } });
  assert.equal(utilities.displayMood(legacy, '2026-10-21', 'a'), null);
});

test('invalid anniversary dates do not create made-up counts', () => {
  assert.equal(utilities.dateCount('2025-02-29'), null);
  assert.equal(utilities.dateCount(''), null);
  assert.equal(utilities.dateCount('2040-01-01'), 0);
});
