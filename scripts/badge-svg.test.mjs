import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { badgeSvg, textWidth, COLORS } from './lib/badge-svg.mjs';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('badgeSvg: label, message and colour are in the file, the sizes add up, and the same input gives the same bytes', () => {
  const a = badgeSvg({ label: 'verified', message: '67/68', color: 'brightgreen' });
  assert.equal(a.svg, badgeSvg({ label: 'verified', message: '67/68', color: 'brightgreen' }).svg);
  assert.match(a.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="20" role="img" aria-label="verified: 67\/68">/);
  assert.match(a.svg, /<title>verified: 67\/68<\/title>/);
  assert.ok(a.svg.includes(`fill="${COLORS.brightgreen}"`));
  assert.equal(a.width, textWidth('verified') + 10 + textWidth('67/68') + 10);
  assert.ok(a.width > 50 && a.width < 120, `a badge this size is between 50 and 120 px wide (got ${a.width})`);
});
test('badgeSvg: text is escaped and an unknown colour name throws instead of shipping a wrong badge', () => {
  const x = badgeSvg({ label: 'a<b', message: 'x&"y', color: '#abc' });
  assert.ok(!x.svg.includes('a<b') && x.svg.includes('a&lt;b') && x.svg.includes('x&amp;&quot;y'));
  assert.throws(() => badgeSvg({ label: 'a', message: 'b', color: 'chartreuse' }), /colour not known/);
});
test('the built site serves the verified badge itself: it matches the endpoint file and no page asks another origin for an image', () => {
  execFileSync(process.execPath, [join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const json = JSON.parse(readFileSync(join(ROOT, 'site/badge-verified.json'), 'utf8'));
  assert.equal(readFileSync(join(ROOT, 'site/badge-verified.svg'), 'utf8'), badgeSvg(json).svg);
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : (p.endsWith('.html') ? [p] : []);
  });
  const offenders = [];
  for (const file of walk(join(ROOT, 'site'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g)) offenders.push(`${file.replace(ROOT, '')}: ${m[1]}`);
  }
  assert.deepEqual(offenders.slice(0, 5), [], 'no page may load an image from another origin: the privacy page says so');
  assert.match(readFileSync(join(ROOT, 'site/index.html'), 'utf8'), /<img class="trust-badge" src="badge-verified\.svg"/);
});
