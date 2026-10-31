// Glob to RegExp: ** (any dirs), * (no slash), ? (one char), {a,b}.
// A pattern without "/" matches the basename anywhere (like .gitignore).
export function globToRegExp(glob) {
  let g = glob.trim();
  if (g.startsWith('./')) g = g.slice(2);
  if (g.startsWith('/')) g = g.slice(1);
  else if (!g.includes('/')) g = '**/' + g;
  if (g.endsWith('/')) g += '**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      re += '(?:' + g.slice(i + 1, end).split(',').map(s => s.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|') + ')';
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '(?:/.*)?$', 'i');
}
export function matchAny(path, globs) {
  return (globs || []).find(g => globToRegExp(String(g)).test(path)) || null;
}
