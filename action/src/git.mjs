import { execFileSync } from 'node:child_process';
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Changed files between merge-base(base, head) and head, with line stats and renames.
export function diffFiles(base, head, cwd = process.cwd()) {
  const range = `${base}...${head}`;
  const status = git(['diff', '--name-status', '-M', '-z', range], cwd).split('\0').filter(Boolean);
  const files = new Map();
  for (let i = 0; i < status.length;) {
    const code = status[i++];
    if (code.startsWith('R') || code.startsWith('C')) { const oldPath = status[i++]; const path = status[i++]; files.set(path, { path, oldPath, status: code[0] }); }
    else { const path = status[i++]; files.set(path, { path, status: code[0] }); }
  }
  const num = git(['diff', '--numstat', '-M', '-z', range], cwd).split('\0');
  for (let i = 0; i < num.length; i++) {
    const rec = num[i]; if (!rec) continue;
    const [a, d, p] = rec.split('\t');
    let path = p;
    if (p === '') { i++; path = num[++i]; } // rename: "a\td\t" then old, new
    const f = files.get(path); if (!f) continue;
    if (a === '-') { f.binary = true; f.added = 0; f.deleted = 0; } else { f.added = +a; f.deleted = +d; }
  }
  return [...files.values()];
}
