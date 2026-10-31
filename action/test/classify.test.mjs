import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../src/classify.mjs';
import { parseYaml } from '../src/yaml.mjs';
import { diffFiles } from '../src/git.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = parseYaml(readFileSync(join(root, '.autonomy.yml'), 'utf8'));
const f = (path, added = 5, deleted = 0, extra = {}) => ({ path, added, deleted, ...extra });

test('example config parses', () => {
  assert.equal(cfg.default_tier, 'T2');
  assert.ok(cfg.rules.length >= 4);
  assert.equal(cfg.size.t3_max_lines, 100);
  assert.deepEqual(cfg.automerge_tiers, ['T3']);
});

test('T1 path forces T1 even next to docs', () => {
  const r = classify([f('docs/a.md'), f('src/payments/charge.ts')], cfg);
  assert.equal(r.tier, 'T1'); assert.equal(r.eligible, false);
});

test('agent instruction files are T1 (built-in, even with empty config)', () => {
  for (const p of ['AGENTS.md', 'apps/api/CLAUDE.md', '.cursor/rules/x.mdc', '.github/workflows/ci.yml', 'CODEOWNERS', '.autonomy.yml']) {
    assert.equal(classify([f(p)], cfg).tier, 'T1', p);
    assert.equal(classify([f(p)], {}).tier, 'T1', p + ' (empty config)');
  }
});

test('declared lower tier and labels are ignored', () => {
  const r = classify([f('src/auth/login.ts')], cfg, { declaredTier: 'T3', labels: ['tier:T3', 'risk-T3'] });
  assert.equal(r.tier, 'T1'); assert.equal(r.eligible, false);
  assert.ok(r.prReasons.some(x => x.includes('declared T3 ignored')));
});

test('declared higher tier raises', () => {
  assert.equal(classify([f('docs/a.md')], cfg, { declaredTier: 'T1' }).tier, 'T1');
});

test('large diff raises tier', () => {
  assert.equal(classify([f('docs/big.md', 150)], cfg).tier, 'T2');
  assert.equal(classify([f('src/app.ts', 900)], cfg).tier, 'T1');
  const many = Array.from({ length: 12 }, (_, i) => f(`docs/p${i}.md`, 1));
  assert.equal(classify(many, cfg).tier, 'T2');
});

test('docs-only small change is T3 and eligible, with SHA', () => {
  const r = classify([f('docs/guide.md', 10, 2), f('README.md', 3, 1)], cfg, { headSha: 'abc123' });
  assert.equal(r.tier, 'T3'); assert.equal(r.eligible, true); assert.equal(r.headSha, 'abc123');
});

test('empty or missing config defaults to T2, never eligible', () => {
  for (const c of [{}, null, parseYaml(''), parseYaml('# only comments\n')]) {
    const r = classify([f('docs/guide.md')], c);
    assert.equal(r.tier, 'T2'); assert.equal(r.eligible, false);
  }
});

test('config cannot lower risk: default_tier T3 and T3 rules are rejected', () => {
  const r = classify([f('src/x.ts')], { default_tier: 'T3', rules: [{ tier: 'T3', paths: ['src/**'] }] });
  assert.equal(r.tier, 'T2'); assert.equal(r.warnings.length, 2);
});

test('t3_paths cannot override built-in or T1 rules', () => {
  const r = classify([f('.github/workflows/x.yml')], { t3_paths: ['**'] });
  assert.equal(r.tier, 'T1');
});

test('rename out of a protected path stays T1', () => {
  assert.equal(classify([f('docs/moved.md', 0, 0, { oldPath: 'src/auth/secret.ts' })], cfg).tier, 'T1');
});

test('binary files are at least T2', () => {
  assert.equal(classify([f('docs/img.png', 0, 0, { binary: true })], cfg).tier, 'T2');
});

test('no changed files is not eligible', () => {
  assert.equal(classify([], cfg).eligible, false);
});

test('git fixture: diffFiles reads base...head', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ae-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  mkdirSync(join(dir, 'src/auth'), { recursive: true });
  writeFileSync(join(dir, 'README.md'), 'x\n'); writeFileSync(join(dir, 'src/auth/a.ts'), 'a\n');
  g('add', '.'); g('commit', '-qm', 'base'); const base = g('rev-parse', 'HEAD');
  g('checkout', '-qb', 'pr');
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs/new.md'), 'one\ntwo\n');
  g('mv', 'src/auth/a.ts', 'src/auth/b.ts');
  g('add', '.'); g('commit', '-qm', 'pr');
  const files = diffFiles(base, 'HEAD', dir);
  const doc = files.find(x => x.path === 'docs/new.md');
  assert.equal(doc.added, 2);
  const ren = files.find(x => x.path === 'src/auth/b.ts');
  assert.equal(ren.oldPath, 'src/auth/a.ts');
  assert.equal(classify(files, cfg).tier, 'T1');
});
