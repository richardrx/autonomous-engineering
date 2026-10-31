import { matchAny } from './glob.mjs';

export const RANK = { T3: 1, T2: 2, T1: 3 };
const byRank = r => Object.keys(RANK).find(k => RANK[k] === r);
export const higher = (a, b) => (RANK[a] >= RANK[b] ? a : b);

// Always T1, even if the user config forgets them. Config can add, never remove.
export const BUILTIN_T1 = [
  { paths: ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursor/**', '.cursorrules', '.claude/**', '.github/copilot-instructions.md', '.windsurfrules'], reason: 'agent instruction or policy file' },
  { paths: ['/.github/**', 'CODEOWNERS'], reason: 'CI/CD, repository governance or ownership' },
  { paths: ['/.autonomy.yml', '/.autonomy.yaml'], reason: 'autonomy policy itself' },
];

const DEFAULTS = { default_tier: 'T2', size: { t3_max_lines: 100, t3_max_files: 10, t2_max_lines: 800, t2_max_files: 40 } };

function normTier(t, fallback) {
  const s = String(t ?? '').toUpperCase();
  return RANK[s] ? s : fallback;
}

export function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const warnings = [];
  let def = normTier(c.default_tier, 'T2');
  if (def === 'T3') { warnings.push('default_tier: T3 is not allowed; using T2. List low-risk paths under t3_paths instead.'); def = 'T2'; }
  const rules = Array.isArray(c.rules) ? c.rules : [];
  const parsedRules = [];
  for (const r of rules) {
    const tier = normTier(r?.tier, null);
    const paths = Array.isArray(r?.paths) ? r.paths : r?.paths ? [r.paths] : [];
    if (!tier || !paths.length) { warnings.push(`ignored invalid rule: ${JSON.stringify(r)}`); continue; }
    if (tier === 'T3') { warnings.push('rules cannot assign T3 (rules only raise risk); use t3_paths. Rule ignored.'); continue; }
    parsedRules.push({ tier, paths, reason: r.reason || `matched rule (${tier})` });
  }
  const size = { ...DEFAULTS.size };
  for (const k of Object.keys(size)) if (Number.isFinite(c.size?.[k])) size[k] = c.size[k];
  const t3 = Array.isArray(c.t3_paths) ? c.t3_paths : [];
  const automerge = Array.isArray(c.automerge_tiers) ? c.automerge_tiers.map(t => normTier(t, null)).filter(Boolean) : ['T3'];
  return { default_tier: def, rules: parsedRules, t3_paths: t3, size, automerge_tiers: automerge, warnings };
}

/**
 * files: [{ path, added, deleted, status, oldPath? }]
 * opts: { declaredTier, labels, headSha }
 */
export function classify(files, rawConfig, opts = {}) {
  const cfg = normalizeConfig(rawConfig);
  const perFile = [];
  let tier = 'T3';
  for (const f of files) {
    const reasons = [];
    let t;
    const candidates = [f.path, f.oldPath].filter(Boolean); // a rename out of a protected path is still protected
    const t3hit = candidates.every(p => matchAny(p, cfg.t3_paths));
    if (t3hit) { t = 'T3'; reasons.push(`low-risk class (t3_paths: ${matchAny(f.path, cfg.t3_paths)})`); }
    else { t = cfg.default_tier; reasons.push(`default tier ${cfg.default_tier}`); }
    for (const r of [...BUILTIN_T1.map(b => ({ ...b, tier: 'T1', builtin: true })), ...cfg.rules]) {
      const hit = candidates.map(p => matchAny(p, r.paths)).find(Boolean);
      if (hit && RANK[r.tier] >= RANK[t]) {
        if (RANK[r.tier] > RANK[t] || !reasons.some(x => x.startsWith(r.tier))) reasons.push(`${r.tier}: ${r.reason} (${hit}${r.builtin ? ', built-in' : ''})`);
        t = higher(t, r.tier);
      }
    }
    if (f.binary) { t = higher(t, 'T2'); reasons.push('binary change, raised to at least T2'); }
    perFile.push({ path: f.path, tier: t, added: f.added, deleted: f.deleted, reasons });
    tier = higher(tier, t);
  }
  const totalLines = files.reduce((s, f) => s + (f.added || 0) + (f.deleted || 0), 0);
  const prReasons = [];
  const s = cfg.size;
  if (totalLines > s.t2_max_lines || files.length > s.t2_max_files) {
    if (tier !== 'T1') prReasons.push(`size ${totalLines} lines / ${files.length} files exceeds T2 limit (${s.t2_max_lines} / ${s.t2_max_files}): raised to T1`);
    tier = 'T1';
  } else if (totalLines > s.t3_max_lines || files.length > s.t3_max_files) {
    if (tier === 'T3') prReasons.push(`size ${totalLines} lines / ${files.length} files exceeds T3 limit (${s.t3_max_lines} / ${s.t3_max_files}): raised to T2`);
    tier = higher(tier, 'T2');
  }
  if (files.length === 0) { tier = cfg.default_tier; prReasons.push('no changed files detected: using default tier'); }

  // Declared tier (PR body or labels) is recorded but can never lower the computed tier.
  const declared = [opts.declaredTier, ...(opts.labels || []).map(l => (String(l).match(/\b(T[123])\b/i) || [])[1])]
    .map(t => normTier(t, null)).filter(Boolean);
  for (const d of declared) {
    if (RANK[d] < RANK[tier]) prReasons.push(`declared ${d} ignored: computed tier ${tier} prevails`);
    else if (RANK[d] > RANK[tier]) { prReasons.push(`declared ${d} raises the tier (declarations can only raise)`); tier = d; }
  }

  const blockers = [];
  if (tier !== 'T3') blockers.push(`tier ${tier} requires human approval under this policy`);
  if (!cfg.automerge_tiers.includes('T3') && tier === 'T3') blockers.push('T3 not listed in automerge_tiers');
  if (files.length && !files.every(f => matchAny(f.path, cfg.t3_paths))) {
    if (tier === 'T3') blockers.push('not every file belongs to an approved low-risk class');
  }
  const eligible = blockers.length === 0;
  return { tier, eligible, headSha: opts.headSha || null, totalLines, fileCount: files.length, perFile, prReasons, blockers, warnings: cfg.warnings };
}

export function renderMarkdown(r, marker = '<!-- autonomy-shadow-mode -->') {
  const out = [marker, '### Autonomy shadow mode', ''];
  out.push(`**Computed tier:** ${r.tier}  `);
  out.push(`**Would be eligible for automerge:** ${r.eligible ? 'yes' : 'no'} (shadow)  `);
  out.push(`**Head SHA:** \`${r.headSha || 'unknown'}\`  `);
  out.push(`**Diff:** ${r.fileCount} files, ${r.totalLines} lines changed`, '');
  if (r.prReasons.length) { out.push('**PR level:**'); r.prReasons.forEach(x => out.push(`- ${x}`)); out.push(''); }
  if (r.blockers.length) { out.push('**Why not eligible:**'); r.blockers.forEach(x => out.push(`- ${x}`)); out.push(''); }
  if (r.warnings.length) { out.push('**Config warnings:**'); r.warnings.forEach(x => out.push(`- ${x}`)); out.push(''); }
  const rows = [...r.perFile].sort((a, b) => RANK[b.tier] - RANK[a.tier]);
  out.push('<details><summary>Per file</summary>', '', '| Tier | File | +/- | Reasons |', '| --- | --- | --- | --- |');
  for (const f of rows.slice(0, 200)) out.push(`| ${f.tier} | \`${f.path.replace(/\|/g, '\\|')}\` | +${f.added ?? '?'}/-${f.deleted ?? '?'} | ${f.reasons.join('; ').replace(/\|/g, '\\|')} |`);
  if (rows.length > 200) out.push(`| | ... ${rows.length - 200} more files | | |`);
  out.push('', '</details>', '', '_Shadow mode only comments. It never approves, merges, or changes labels. This result is invalid for any later commit._');
  return out.join('\n');
}
