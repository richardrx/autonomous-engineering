#!/usr/bin/env node
// Shadow mode entry point. Reads env, classifies, writes outputs and summary.
// Never calls any write API except through the workflow's comment step.
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { parseYaml } from './yaml.mjs';
import { diffFiles } from './git.mjs';
import { classify, renderMarkdown } from './classify.mjs';

const env = process.env;
const base = env.AE_BASE_SHA, head = env.AE_HEAD_SHA || 'HEAD';
if (!base) { console.error('AE_BASE_SHA is required'); process.exit(2); }
const cfgPath = env.AE_CONFIG || '.autonomy.yml';
let raw = {};
// Read the policy from the BASE commit when possible, so a PR cannot relax its own policy.
try {
  const { execFileSync } = await import('node:child_process');
  raw = parseYaml(execFileSync('git', ['show', `${base}:${cfgPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  if (existsSync(cfgPath) && env.AE_ALLOW_HEAD_CONFIG === 'true') raw = parseYaml(readFileSync(cfgPath, 'utf8'));
  else console.log(`No ${cfgPath} on base commit: using conservative defaults (T2).`);
}
const labels = (env.AE_LABELS || '').split(',').map(s => s.trim()).filter(Boolean);
const declared = ((env.AE_PR_BODY || '').match(/^\s*(?:risk|tier)\s*:\s*(T[123])\b/im) || [])[1];
const result = classify(diffFiles(base, head), raw, { declaredTier: declared, labels, headSha: env.AE_HEAD_SHA || head });
const md = renderMarkdown(result);
const outFile = env.AE_OUTPUT_FILE || 'autonomy-shadow.md';
writeFileSync(outFile, md);
writeFileSync(outFile.replace(/\.md$/, '') + '.json', JSON.stringify(result, null, 2));
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md + '\n');
if (env.GITHUB_OUTPUT) {
  appendFileSync(env.GITHUB_OUTPUT, `tier=${result.tier}\neligible=${result.eligible}\nhead-sha=${result.headSha}\ncomment-file=${outFile}\n` +
    `json<<AE_EOF\n${JSON.stringify({ tier: result.tier, eligible: result.eligible, headSha: result.headSha, blockers: result.blockers })}\nAE_EOF\n`);
}
console.log(`shadow-mode tier=${result.tier} eligible=${result.eligible} sha=${result.headSha}`);
