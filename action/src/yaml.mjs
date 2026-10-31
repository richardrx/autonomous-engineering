// Minimal YAML subset parser: nested maps, lists of scalars, lists of maps,
// inline lists [a, b], quoted strings, numbers, booleans, comments.
// Enough for .autonomy.yml. No anchors, no multi-line strings.
function scalar(v) {
  v = v.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner ? splitInline(inner).map(scalar) : [];
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function splitInline(s) {
  const out = []; let cur = ''; let q = null;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}
function splitKey(s) {
  const m = s.match(/^("[^"]*"|'[^']*'|[^:]+?):(\s+(.*))?$/);
  if (!m) return null;
  return [scalar(m[1]), m[3] ?? ''];
}
export function parseYaml(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = stripComment(raw).replace(/\s+$/, '');
    if (!l.trim() || l.trim() === '---') continue;
    lines.push({ indent: l.length - l.trimStart().length, text: l.trim() });
  }
  let i = 0;
  function block(indent) {
    if (i >= lines.length) return null;
    return lines[i].text.startsWith('- ') || lines[i].text === '-' ? list(lines[i].indent) : map(lines[i].indent);
  }
  function map(indent) {
    const obj = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('-')) {
      const kv = splitKey(lines[i].text);
      if (!kv) throw new Error(`Cannot parse line: ${lines[i].text}`);
      i++;
      if (kv[1] !== '') obj[kv[0]] = scalar(kv[1]);
      else if (i < lines.length && (lines[i].indent > indent || (lines[i].indent === indent && lines[i].text.startsWith('-')))) obj[kv[0]] = block();
      else obj[kv[0]] = null;
    }
    return obj;
  }
  function list(indent) {
    const arr = [];
    while (i < lines.length && lines[i].indent === indent && (lines[i].text.startsWith('- ') || lines[i].text === '-')) {
      const rest = lines[i].text.slice(1).trim();
      const kv = rest ? splitKey(rest) : null;
      if (!rest) { i++; arr.push(block()); }
      else if (kv && !rest.startsWith('"') && !rest.startsWith("'") && !rest.startsWith('[')) {
        // list item that is a map: rewrite current line as map entry at deeper indent
        const childIndent = indent + 2;
        lines[i] = { indent: childIndent, text: rest };
        arr.push(map(childIndent));
      } else { arr.push(scalar(rest)); i++; }
    }
    return arr;
  }
  const r = block();
  return r ?? {};
}
