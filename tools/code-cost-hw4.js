/* HW4 v1.0.0 (Section 2): C++ design and memory cost. Independent, conservative lexical analysis.
 * Not a C++ compiler, a memory checker or a proof of correctness. Runtime leak and crash
 * checks (sanitizers / tests) are still required. Unknown flows produce zero-cost review notes.
 * The same API is usable from Node and from an offline browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HW4Cost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'hw4-1.0.0';
  // Only Section 2 (parking lot) is assessed with this calculator.
  const SECTIONS = {
    'Section 2': ['Timestamp', 'Vehicle', 'Car', 'CompactCar', 'Motorcycle', 'Receipt', 'ParkingLot']
  };
  const HEADER = /\.(?:h|hh|hpp|hxx)$/i;
  const KEYWORDS = new Set(('alignas alignof and asm auto bool break case catch char char16_t char32_t class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while override final std string cout cin cerr endl').split(' '));
  const BUILTIN = new Set('bool char char16_t char32_t wchar_t short int long float double signed unsigned void auto size_t'.split(' '));
  const STATEMENT_WORDS = new Set('return else do case default throw delete new goto co_return'.split(' '));
  const OPS = ['->*', '<<=', '>>=', '...', '::', '->', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<'];
  const isId = t => t && t.kind === 'id';

  // ---------------------------------------------------------------- lexer
  function lex(src) {
    const tokens = [], pp = []; let i = 0, line = 1, lineStart = true;
    const push = (v, kind, ln) => { tokens.push({ v, kind, line: ln }); lineStart = false; };
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { line++; i++; lineStart = true; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) { i += 2; while (i < src.length && !src.startsWith('*/', i)) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '#' && lineStart) {                       // preprocessor line (with continuations)
        const ln = line; let text = '';
        while (i < src.length && src[i] !== '\n') {
          if (src[i] === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
          if (src[i] === '\\' && src[i + 1] === '\r' && src[i + 2] === '\n') { i += 3; line++; continue; }
          if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; break; }
          if (src.startsWith('/*', i)) { i += 2; while (i < src.length && !src.startsWith('*/', i)) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
          text += src[i++];
        }
        pp.push({ text: text.replace(/\s+/g, ' ').trim(), line: ln }); continue;
      }
      const raw = src.slice(i, i + 20).match(/^(?:u8|u|U|L)?R"([^()\\\s]{0,16})\(/);
      if (raw) {
        const end = src.indexOf(')' + raw[1] + '"', i + raw[0].length), stop = end < 0 ? src.length : end + raw[1].length + 2, ln = line;
        for (let k = i; k < stop; k++) if (src[k] === '\n') line++;
        push(src.slice(i, stop), 'lit', ln); i = stop; continue;
      }
      if (c === '"' || c === "'") {
        const ln = line, start = i; i++;
        while (i < src.length) { const x = src[i++]; if (x === '\\') { if (src[i] === '\n') line++; i++; } else if (x === c || x === '\n') { if (x === '\n') line++; break; } }
        push(src.slice(start, i), 'lit', ln); continue;
      }
      const num = src.slice(i, i + 64).match(/^(?:0[xXbB][\da-fA-F']+|\d[\d']*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)[a-zA-Z]*/);
      if (num) { push(num[0], 'num', line); i += num[0].length; continue; }
      const id = src.slice(i, i + 256).match(/^[A-Za-z_][\w]*/);
      if (id) { push(id[0], 'id', line); i += id[0].length; continue; }
      const op = OPS.find(o => src.startsWith(o, i));
      if (op) { push(op, 'op', line); i += op.length; continue; }
      push(c, 'op', line); i++;
    }
    return { tokens, pp };
  }
  function pairs(t) {
    const p = new Map(), st = [], close = new Map([[')', '('], [']', '['], ['}', '{']]);
    for (let i = 0; i < t.length; i++) {
      const v = t[i].v;
      if (v === '(' || v === '[' || v === '{') st.push(i);
      else if (close.has(v)) { while (st.length && t[st[st.length - 1]].v !== close.get(v)) st.pop(); const a = st.pop(); if (a !== undefined) { p.set(a, i); p.set(i, a); } }
    }
    return p;
  }
  const join = a => a.map(x => x.v).join(' ');
  // Split at top-level commas; angle brackets count as nesting only inside declarations.
  function splitTop(t, delimiter = ',') {
    const out = []; let start = 0, d = 0;
    for (let i = 0; i < t.length; i++) {
      const v = t[i].v;
      if (v === '(' || v === '[' || v === '{' || v === '<') d++;
      else if (v === ')' || v === ']' || v === '}' || v === '>') d = Math.max(0, d - 1);
      else if (v === delimiter && d === 0) { out.push(t.slice(start, i)); start = i + 1; }
    }
    out.push(t.slice(start)); return out.filter(x => x.length);
  }
  function skipAngles(t, i) {           // t[i] is '<'; returns the index after the matching '>'
    let d = 0;
    for (; i < t.length; i++) { if (t[i].v === '<') d++; else if (t[i].v === '>') { d--; if (d === 0) return i + 1; } else if (t[i].v === ';' || t[i].v === '{') return i; }
    return i;
  }

  // Parameter list -> normalized types (names and default values removed).
  function paramInfo(tokens) {
    const parts = splitTop(tokens);
    if (parts.length === 1 && parts[0].length === 1 && parts[0][0].v === 'void') return { types: [], names: [], parts: [] };
    const types = [], names = [];
    for (const raw of parts) {
      let p = raw; const eq = p.findIndex(x => x.v === '='); if (eq >= 0) p = p.slice(0, eq);
      let name = null; const last = p[p.length - 1];
      const arr = last && last.v === ']' ? p.findIndex(x => x.v === '[') : -1;
      const nameAt = arr > 0 ? arr - 1 : p.length - 1;
      const cand = p[nameAt], before = p[nameAt - 1];
      if (p.length > 1 && isId(cand) && !BUILTIN.has(cand.v) && cand.v !== 'const' && before && before.v !== '::' && !(before.v === 'unsigned' || before.v === 'signed' || before.v === 'long' || before.v === 'short') || (p.length > 1 && isId(cand) && before && BUILTIN.has(before.v) && !BUILTIN.has(cand.v) && cand.v !== 'const')) {
        name = cand.v; p = p.slice(0, nameAt).concat(arr > 0 ? p.slice(arr) : []);
      }
      types.push(p.filter(x => x.v !== 'struct' && x.v !== 'class').map(x => x.v).join(''));
      names.push(name);
    }
    return { types, names, parts };
  }

  // ---------------------------------------------------------------- structure
  function parseFile(file, src) {
    const { tokens: T, pp } = lex(src), P = pairs(T);
    const classes = [], functions = [], globals = [], reviews = [];
    function newClass(kind, name, line, outer) { const c = { name, kind, file, line, bases: [], members: [], methods: [], outer: outer ? outer.name : null }; classes.push(c); return c; }

    function parseHeadBases(head) {     // tokens between the class name and '{'
      const colon = head.findIndex(x => x.v === ':'); if (colon < 0) return [];
      return splitTop(head.slice(colon + 1)).map(part => {
        const access = part.find(x => ['public', 'protected', 'private'].includes(x.v));
        let ids = []; for (let k = 0; k < part.length; k++) { if (part[k].v === '<') { k = skipAngles(part, k) - 1; continue; } if (isId(part[k]) && !['public', 'protected', 'private', 'virtual'].includes(part[k].v)) ids.push(part[k].v); }
        return { name: ids[ids.length - 1], access: access ? access.v : null };
      }).filter(b => b.name);
    }

    function declInfo(s, firstParen, closeParen, end) {
      // Name before the parameter list (operators, destructors, qualified names).
      let k = firstParen - 1, name, owner = null;
      let opAt = -1; for (let q = firstParen - 1; q >= s && q >= firstParen - 4; q--) if (T[q].v === 'operator') { opAt = q; break; }
      if (opAt >= 0) { name = 'operator' + T.slice(opAt + 1, firstParen).map(x => x.v).join(''); k = opAt; }
      else {
        if (T[k] && T[k].v === '>') { let d = 0; for (; k >= s; k--) { if (T[k].v === '>') d++; else if (T[k].v === '<') { d--; if (d === 0) { k--; break; } } } }
        name = T[k] ? T[k].v : '(function)';
        if (T[k - 1] && T[k - 1].v === '~') { name = '~' + name; k--; }
      }
      let nameStart = k;
      if (T[k - 1] && T[k - 1].v === '::') {
        let o = k - 2; if (T[o] && T[o].v === '>') { let d = 0; for (; o >= s; o--) { if (T[o].v === '>') d++; else if (T[o].v === '<') { d--; if (d === 0) { o--; break; } } } }
        owner = T[o] ? T[o].v : null; nameStart = o;
        while (T[nameStart - 1] && T[nameStart - 1].v === '::' && isId(T[nameStart - 2])) nameStart -= 2;
      }
      const pre = T.slice(s, nameStart), post = T.slice(closeParen + 1, end);
      const spec = new Set(['virtual', 'static', 'inline', 'explicit', 'friend', 'constexpr', 'extern']);
      const retType = pre.filter(x => !spec.has(x.v));
      const pi = paramInfo(T.slice(firstParen + 1, closeParen));
      const postV = post.map(x => x.v);
      const eq = postV.indexOf('=');
      return {
        name, owner, line: T[k] ? T[k].line : T[s].line, retType, params: pi.types, paramNames: pi.names,
        isVirtual: pre.some(x => x.v === 'virtual'), isStatic: pre.some(x => x.v === 'static'), isFriend: pre.some(x => x.v === 'friend'),
        isConst: postV.slice(0, eq < 0 ? postV.length : eq).includes('const'),
        isOverride: postV.includes('override'), isFinal: postV.includes('final'),
        isPure: eq >= 0 && postV[eq + 1] === '0', isDefault: eq >= 0 && postV[eq + 1] === 'default', isDeleted: eq >= 0 && postV[eq + 1] === 'delete'
      };
    }

    function parseScope(lo, hi, ctx) {
      let i = lo;
      while (i < hi) {
        const t = T[i], v = t.v;
        if (v === ';') { i++; continue; }
        if (ctx.cls && (v === 'public' || v === 'private' || v === 'protected') && T[i + 1] && T[i + 1].v === ':') { ctx.access = v; i += 2; continue; }
        if (v === 'namespace') {
          let j = i + 1; while (j < hi && T[j].v !== '{' && T[j].v !== ';') j++;
          if (T[j] && T[j].v === '{' && P.has(j)) { parseScope(j + 1, P.get(j), { cls: null, access: null, anon: ctx.anon || j === i + 1 }); i = P.get(j) + 1; continue; }
          i = j + 1; continue;
        }
        if (v === 'extern' && T[i + 1] && T[i + 1].kind === 'lit' && T[i + 2] && T[i + 2].v === '{' && P.has(i + 2)) { parseScope(i + 3, P.get(i + 2), ctx); i = P.get(i + 2) + 1; continue; }
        if (v === 'template' && T[i + 1] && T[i + 1].v === '<') { i = skipAngles(T, i + 1); continue; }
        if (v === 'using' || v === 'typedef' || v === 'static_assert' || (v === 'friend' && T[i + 1] && ['class', 'struct'].includes(T[i + 1].v))) {
          let j = i; while (j < hi && T[j].v !== ';') { if (P.has(j) && '([{'.includes(T[j].v)) j = P.get(j); j++; } i = j + 1; continue;
        }
        if (v === 'enum') {
          let j = i; while (j < hi && T[j].v !== ';' && T[j].v !== '{') j++;
          if (T[j] && T[j].v === '{' && P.has(j)) j = P.get(j) + 1;
          while (j < hi && T[j].v !== ';') j++; i = j + 1; continue;
        }
        if ((v === 'class' || v === 'struct' || v === 'union') && isId(T[i + 1])) {
          let j = i + 1; while (j < hi && T[j].v !== '{' && T[j].v !== ';' && T[j].v !== '(' && T[j].v !== '=') j++;
          if (T[j] && T[j].v === '{' && P.has(j)) {
            const head = T.slice(i + 2, j).filter(x => x.v !== 'final');
            const c = newClass(v === 'union' ? 'struct' : v, T[i + 1].v, t.line, ctx.cls);
            c.bases = parseHeadBases(head);
            parseScope(j + 1, P.get(j), { cls: c, access: v === 'class' ? 'private' : 'public', anon: ctx.anon });
            i = P.get(j) + 1; while (i < hi && T[i].v !== ';') i++; i++; continue;
          }
        }
        // generic declaration / definition
        let j = i, firstParen = -1, closeParen = -1, sawEq = false, body = -1, init = null;
        while (j < hi) {
          const w = T[j].v;
          if (w === 'operator') {         // operator symbol is part of the name: operator=, operator(), operator<<, operator bool
            j++;
            if (T[j] && T[j].v === '(' && T[j + 1] && T[j + 1].v === ')' && T[j + 2] && T[j + 2].v === '(') j += 2;
            else while (j < hi && T[j].v !== '(' && T[j].v !== ';') j++;
            continue;
          }
          if (w === '(' && P.has(j)) {
            if (firstParen < 0 && !sawEq) { firstParen = j; closeParen = P.get(j); }
            j = P.get(j) + 1; continue;
          }
          if (w === '[' && P.has(j)) { j = P.get(j) + 1; continue; }
          if (w === '<' && firstParen < 0 && T[j - 1] && isId(T[j - 1]) && !sawEq) { const e = skipAngles(T, j); if (e > j + 1 && e <= hi && T[e - 1].v === '>') { j = e; continue; } }
          if (w === '=') { sawEq = true; j++; continue; }
          if (w === ':' && firstParen >= 0 && j > closeParen && !sawEq) {   // constructor initializer list
            let k = j + 1; const istart = k;
            while (k < hi) {
              while (k < hi && T[k].v !== '(' && T[k].v !== '{') { if (T[k].v === '<') { k = skipAngles(T, k); continue; } k++; }
              if (k >= hi || !P.has(k)) break;
              k = P.get(k) + 1;
              if (T[k] && T[k].v === ',') { k++; continue; }
              break;
            }
            init = [istart, k]; j = k;
            if (T[j] && T[j].v === '{') { body = j; break; }
            continue;
          }
          if (w === '{' && P.has(j)) {
            if (firstParen >= 0 && j > closeParen && !sawEq) { body = j; break; }
            j = P.get(j) + 1; continue;
          }
          if (w === ';') break;
          j++;
        }
        const isFuncPtr = firstParen >= 0 && T[firstParen + 1] && T[firstParen + 1].v === '*';
        const looksCall = firstParen >= 0 && T[firstParen + 1] && (T[firstParen + 1].kind === 'num' || T[firstParen + 1].kind === 'lit');
        if (firstParen >= 0 && !isFuncPtr && !looksCall) {
          const end = body >= 0 ? (init ? init[0] - 1 : body) : j;
          const d = declInfo(i, firstParen, closeParen, end);
          const m = Object.assign(d, { file, access: ctx.cls ? ctx.access : null, cls: ctx.cls ? ctx.cls.name : d.owner, anon: ctx.anon, defined: body >= 0 });
          if (body >= 0) { m.body = T.slice(body + 1, P.get(body)); m.init = init ? T.slice(init[0], init[1]) : []; m.decl = T.slice(i, init ? init[0] - 1 : body); m.defFile = file; m.defLine = m.line; }
          if (ctx.cls && !d.isFriend) { if (!d.owner) m.owner = ctx.cls.name; ctx.cls.methods.push(m); if (body >= 0) functions.push(m); }
          else if (body >= 0) { if (d.isFriend) m.cls = null, m.owner = null; functions.push(m); }
          i = body >= 0 ? P.get(body) + 1 : j + 1; continue;
        }
        // variables / data members
        const declToks = T.slice(i, j);
        if (declToks.length && !declToks.some(x => x.v === 'friend')) {
          const parts = splitTop(declToks);
          const first = parts[0] || [];
          const isStatic = first.some(x => x.v === 'static'), isExtern = first.some(x => x.v === 'extern');
          const isConstexpr = first.some(x => x.v === 'constexpr');
          const baseStar = (() => { const nm = nameOf(first); return nm ? first.slice(0, nm.at) : first; })();
          parts.forEach((part, idx) => {
            const nm = nameOf(part); if (!nm) return;
            const declarator = idx === 0 ? part.slice(0, nm.at) : baseStar.concat(part.slice(0, nm.at));
            const stars = declarator.reduce((a, x, k) => x.v === '*' ? k : a, -1);
            const isConst = isConstexpr || (stars >= 0 ? declarator.slice(stars + 1).some(x => x.v === 'const') : declarator.some(x => x.v === 'const'));
            const after = part.slice(nm.at + 1);
            const rec = { name: nm.name, line: part[nm.at].line, file, isStatic, isConst, isExtern, isArray: after.length > 0 && after[0].v === '[', isPointer: stars >= 0, isRef: declarator.some(x => x.v === '&' || x.v === '&&'),
              type: declarator.filter(x => !['static', 'mutable', 'inline', 'constexpr', 'extern'].includes(x.v)).map(x => x.v).join(''), access: ctx.access, anon: ctx.anon };
            if (ctx.cls) ctx.cls.members.push(rec); else globals.push(rec);
          });
        }
        i = j + 1;
      }
    }
    function nameOf(part) {
      let end = part.length;
      const cut = part.findIndex((x, k) => (x.v === '=' || x.v === '{' || (x.v === '[' && k > 0) || x.v === ':' ) && k > 0);
      if (cut >= 0) end = cut;
      for (let k = end - 1; k >= 0; k--) if (isId(part[k]) && !KEYWORDS.has(part[k].v)) return { name: part[k].v, at: k };
      return null;
    }
    parseScope(0, T.length, { cls: null, access: null, anon: false });
    return { file, tokens: T, pairs: P, pp, classes, functions, globals, reviews };
  }

  // ---------------------------------------------------------------- metrics shared with v2
  function complexity(body) {
    let c = 1, d = 0;
    for (let i = 0; i < body.length; i++) {
      const v = body[i].v;
      if (v === '{') { d++; continue; } if (v === '}') { d = Math.max(0, d - 1); continue; }
      if (v === '&&' || v === '||' || v === 'and' || v === 'or') { c += 1; continue; }
      if (v === 'else' && body[i + 1] && body[i + 1].v === 'if') { c += 1 + d; i++; continue; }
      if (['if', 'for', 'while', 'do', 'switch', 'catch', 'case', '?'].includes(v)) c += 1 + d;
    }
    return c;
  }
  function statements(body) {
    let n = 0;
    for (let i = 0; i < body.length; i++) {
      const v = body[i].v;
      if (v === 'for' && body[i + 1] && body[i + 1].v === '(') { let d = 0, k = i + 1; for (; k < body.length; k++) { if (body[k].v === '(') d++; else if (body[k].v === ')') { d--; if (d === 0) break; } } n++; i = k; continue; }
      if (v === ';') n++;
      else if (v === 'else' && body[i + 1] && body[i + 1].v === 'if') { n++; i++; }
      else if (['if', 'while', 'do', 'switch', 'catch', 'try'].includes(v)) n++;
    }
    return n;
  }
  const norm = t => t.kind === 'id' && !KEYWORDS.has(t.v) ? 'ID' : t.v;
  function isTrivialAccessor(f) {
    const b = f.body || [], v = b.map(x => x.v);
    if (/^(?:get|is|set|has)[A-Z_]/.test(f.name) === false) return false;
    const strip = a => (a[0] === 'this' && a[1] === '->') ? a.slice(2) : a;
    if (v[0] === 'return' && v[v.length - 1] === ';') { const e = strip(v.slice(1, -1)); return e.length === 1; }
    const s = strip(v); return s.length === 4 && s[1] === '=' && s[3] === ';';
  }
  // Same window/cost formula as v2. Differences for C++: only function definitions are scanned
  // (class declarations and constructor initializer lists are not scanned), a window never spans two functions, and two
  // occurrences must not overlap (a list of similar lines such as a swap is not a copy).
  // A window made of one short statement repeated (swap(a, o.a); swap(b, o.b); ...) is a list, not a copy.
  function periodic(win) {
    for (let p = 1; p <= win.length / 3; p++) { let ok = true; for (let i = p; i < win.length && ok; i++) ok = win[i] === win[i - p]; if (ok) return true; }
    return false;
  }
  function findDuplicates(model, minTokens) {
    const w = Math.max(10, minTokens), seen = new Map(), groups = [], units = [];
    for (const fn of model.functions) if (!isTrivialAccessor(fn)) {
      const toks = fn.decl.concat([{ v: '{' }], fn.body, [{ v: '}' }]).filter(t => t.kind !== 'lit').map(norm);
      const u = { file: fn.defFile, label: (fn.cls ? fn.cls + '::' : '') + fn.name + '()', toks, used: new Set() }; units.push(u);
      for (let i = 0; i <= toks.length - w; i++) { const k = toks.slice(i, i + w).join(' '); if (!seen.has(k)) seen.set(k, []); seen.get(k).push({ u, index: i }); }
    }
    for (const ps of seen.values()) {
      const pick = [];
      for (const p of ps) {
        if (p.u.used.has(p.index)) continue;
        if (pick.some(q => q.u === p.u && Math.abs(q.index - p.index) < w)) continue;
        pick.push(p);
      }
      if (pick.length < 2 || periodic(pick[0].u.toks.slice(pick[0].index, pick[0].index + w))) continue;
      const fs = [...new Set(pick.map(p => p.u.file))], cost = Math.ceil(w / 10) * (pick.length - 1);
      groups.push({ cost, files: fs, where: [...new Set(pick.map(p => p.u.label))] });
      for (const p of pick) for (let k = 0; k < w; k++) p.u.used.add(p.index + k);
    }
    const perFile = Object.fromEntries(Object.keys(model.files).map(n => [n, 0])); let total = 0;
    for (const g of groups) { total += g.cost; const sh = g.cost / g.files.length; g.files.forEach(f => perFile[f] += sh); }
    return { totalDuplicateCost: total, duplicateGroups: groups.length, perFile, groups };
  }

  // ---------------------------------------------------------------- model
  function buildModel(files) {
    const parsed = Object.entries(files).map(([f, s]) => parseFile(f, s));
    const classes = parsed.flatMap(p => p.classes), functions = parsed.flatMap(p => p.functions), globals = parsed.flatMap(p => p.globals);
    const byName = new Map(); classes.forEach(c => { if (!byName.has(c.name)) byName.set(c.name, c); });
    const reviews = [];
    // Link out-of-class definitions (Class::method) to their in-class declarations.
    for (const fn of functions) {
      if (!fn.owner || fn.access) continue;
      const c = byName.get(fn.owner); if (!c) continue;
      const sig = fn.params.join(',');
      let decl = c.methods.find(m => !m.defined && m.name === fn.name && m.params.join(',') === sig && m.isConst === fn.isConst);
      if (!decl) { const same = c.methods.filter(m => !m.defined && m.name === fn.name); if (same.length === 1) decl = same[0]; }
      if (decl) {
        Object.assign(decl, { defined: true, body: fn.body, init: fn.init, decl: fn.decl, defFile: fn.defFile, defLine: fn.line, paramNames: fn.paramNames });
        functions[functions.indexOf(fn)] = decl;
      } else {
        Object.assign(fn, { access: 'public', cls: c.name }); c.methods.push(fn);
        reviews.push({ file: fn.file, line: fn.line, message: `${fn.owner}::${fn.name} has no matching declaration in class ${fn.owner}; check the header.` });
      }
    }
    for (const c of classes) for (const m of c.methods) {
      m.cls = c.name; m.isCtor = m.name === c.name; m.isDtor = m.name === '~' + c.name;
      m.signature = `${m.name}(${m.params.join(',')})${m.isConst ? ' const' : ''}`;
      if (m.defined && !m.defFile) { m.defFile = m.file; m.defLine = m.line; }
    }
    const parentOf = c => c.bases.map(b => byName.get(b.name)).filter(Boolean);
    function ancestors(c) { const out = [], seen = new Set([c.name]), st = [...parentOf(c)]; while (st.length) { const a = st.shift(); if (seen.has(a.name)) continue; seen.add(a.name); out.push(a); st.push(...parentOf(a)); } return out; }
    // effective virtual-ness (declared virtual, override/final, or overriding a virtual ancestor)
    const virtualMap = new Map();
    function isVirtual(c, m) {
      const key = c.name + '|' + m.signature; if (virtualMap.has(key)) return virtualMap.get(key);
      virtualMap.set(key, false);
      let r = m.isVirtual || m.isOverride || m.isFinal || m.isPure;
      if (!r && !m.isCtor && !m.isStatic) for (const a of ancestors(c)) { const pm = a.methods.find(x => (m.isDtor ? x.isDtor : x.signature === m.signature)); if (pm && isVirtual(a, pm)) { r = true; break; } }
      virtualMap.set(key, r); return r;
    }
    return { files, parsed, classes, functions: functions.filter(f => f.body), globals, byName, ancestors, parentOf, isVirtual, reviews };
  }

  // ---------------------------------------------------------------- analysis
  function analyze(files, options) {
    const opt = Object.assign({ complexityLimit: 10, sizeLimit: 30, minTokens: 50 }, options || {});
    const M = buildModel(files);
    const classNames = new Set(M.classes.map(c => c.name));
    const coreKeys = ['complexity', 'size', 'encapsulation', 'reuse', 'hiding', 'override', 'polymorphism'];
    const core = {}; const addedKeys = ['memory', 'exceptions', 'practices'];
    for (const f of Object.keys(files)) core[f] = Object.assign({ classes: 0, methods: 0, dup: 0 }, Object.fromEntries(coreKeys.map(k => [k, 0])));
    const added = {}; for (const f of Object.keys(files)) added[f] = Object.assign(Object.fromEntries(addedKeys.map(k => [k, 0])), { total: 0 });
    const warnings = [], info = [], findings = [], reviews = [...M.reviews];
    const seen = new Set();
    function add(rule, category, cost, file, line, message) {
      const key = rule + ':' + file + ':' + line + ':' + message; if (seen.has(key)) return; seen.add(key);
      findings.push({ file, line, rule, category, cost, message }); added[file][category] += cost; added[file].total += cost;
    }
    const review = (file, line, message) => reviews.push({ file, line, message });
    const classFile = c => c.file;

    // ---- the original eight, measured on C++ ------------------------------------------
    const dup = findDuplicates(M, opt.minTokens);
    for (const g of dup.groups) warnings.push(`Duplicated code (+${g.cost}): ${g.where.join(' / ')}; move the shared steps into one helper function.`);
    for (const c of M.classes) core[c.file].classes++;
    for (const fn of M.functions) {
      const f = fn.defFile; core[f].methods++;
      const label = (fn.cls ? fn.cls + '::' : '') + fn.name + '()';
      const cx = complexity(fn.body), st = statements(fn.body);
      if (cx > opt.complexityLimit) { core[f].complexity += (cx - opt.complexityLimit) * 2; warnings.push(`${label}: complexity ${cx} exceeds ${opt.complexityLimit}; split it into helper functions.`); }
      if (st > opt.sizeLimit) { core[f].size += Math.ceil((st - opt.sizeLimit) / 5); warnings.push(`${label}: ${st} statements exceed ${opt.sizeLimit}.`); }
    }
    // Encapsulation
    for (const c of M.classes) {
      const aggregate = c.kind === 'struct' && !c.methods.some(m => !m.isCtor);
      if (aggregate) continue;
      for (const m of c.members) {
        if (m.isStatic && m.isConst) continue;
        if (m.access === 'public') { core[c.file].encapsulation += 2; warnings.push(`${c.name}::${m.name} is a public ${m.isConst ? '' : 'mutable '}data member; make it private and add member functions.`); }
      }
      const arrays = new Set(c.members.filter(m => !m.isStatic && (m.isArray || (m.isPointer && ownsArray(c, m.name)))).map(m => m.name));
      for (const fn of c.methods.filter(x => x.body && x.access !== 'private')) {
        const v = fn.body.map(x => x.v), rt = fn.retType.map(x => x.v);
        for (let i = 0; i < v.length; i++) if (v[i] === 'return') {
          let e = i + 1; while (e < v.length && v[e] !== ';') e++;
          let ex = v.slice(i + 1, e); if (ex[0] === 'this' && ex[1] === '->') ex = ex.slice(2);
          const element = ex.length > 3 && ex[1] === '[' && ex[ex.length - 1] === ']';
          if (element) { if (arrays.has(ex[0]) && rt.includes('&') && !rt.includes('const')) { core[fn.defFile].encapsulation += 2; warnings.push(`${c.name}::${fn.name}() returns a non-const reference into the internal array '${ex[0]}'; return the value or a const reference.`); } continue; }
          if (ex.length !== 1) continue;
          const member = c.members.find(x => x.name === ex[0] && !x.isStatic); if (!member) continue;
          const constRet = rt[0] === 'const' || (rt.includes('const') && rt.lastIndexOf('const') > rt.lastIndexOf('*'));
          if (arrays.has(ex[0]) && rt.includes('*') && rt[0] !== 'const') { core[fn.defFile].encapsulation += 2; warnings.push(`${c.name}::${fn.name}() returns the internal array '${ex[0]}'; callers can change or delete it. Return a copy or one element.`); }
          else if ((rt.includes('&')) && !constRet) { core[fn.defFile].encapsulation += 2; warnings.push(`${c.name}::${fn.name}() returns a non-const reference to '${ex[0]}'; return by value or const reference.`); }
        }
      }
    }
    // Inheritance reuse, field hiding, override practice
    for (const c of M.classes) {
      const anc = M.ancestors(c); const counted = new Set();
      for (const a of anc) {
        const pf = new Map(a.members.filter(m => m.access !== 'private' && !m.isStatic).map(m => [m.name, m]));
        for (const m of c.members) if (!m.isStatic && pf.has(m.name)) { core[c.file].hiding += 2; core[c.file].reuse += 2; warnings.push(`${c.name}::${m.name} hides the data member of ${a.name}; reuse the inherited member instead.`); }
        for (const m of c.methods) {
          if (m.isCtor || m.isDtor || m.isStatic || counted.has(m.signature)) continue;
          const pm = a.methods.find(x => x.signature === m.signature && x.access !== 'private' || (x.signature === m.signature && M.isVirtual(a, x)));
          if (!pm) continue;
          counted.add(m.signature);
          if (M.isVirtual(a, pm)) {
            if (!m.isOverride && !m.isFinal) { core[c.file].override += 1; warnings.push(`${c.name}::${m.signature} overrides ${a.name} without 'override'.`); }
          } else { core[c.file].override += 1; warnings.push(`${c.name}::${m.signature} redefines non-virtual ${a.name}::${pm.name}; calls through a ${a.name} pointer/reference still run the base version. Make the base function virtual.`); }
          if (m.body && pm.body) { const x = join(m.body), y = join(pm.body); if (x && x === y) { core[m.defFile].reuse += Math.max(1, Math.ceil(x.split(' ').length / 10)); warnings.push(`${c.name}::${m.name}() copies ${a.name}::${pm.name}(); inherit it or call ${a.name}::${pm.name}() instead.`); } }
        }
        // a derived class member with the same name but a different signature hides every base overload
        for (const m of c.methods) if (!m.isCtor && !m.isDtor && !m.isStatic && !m.name.startsWith('operator') && a.methods.some(x => x.name === m.name && x.access !== 'private') && !a.methods.some(x => x.signature === m.signature) && !c.methods.some(x => a.methods.some(y => y.signature === x.signature && x.name === m.name))) review(c.file, m.line, `${c.name}::${m.name} hides the ${a.name}::${m.name} overloads (different parameters); add 'using ${a.name}::${m.name};' if they should stay visible.`);
      }
    }
    for (const parent of M.classes) {
      const kids = M.classes.filter(c => c.bases.some(b => b.name === parent.name)); if (kids.length < 2) continue;
      const pn = new Set(parent.members.map(m => m.name)), seenF = new Map();
      for (const k of kids) for (const m of k.members) { if (m.isStatic || pn.has(m.name)) continue; const key = m.name + ':' + m.type; if (!seenF.has(key)) seenF.set(key, []); seenF.get(key).push(k); }
      for (const [key, owners] of seenF) if (owners.length >= 2) { owners.slice(1).forEach(o => core[o.file].reuse += 2); warnings.push(`Data member '${key.split(':')[0]}' is declared in ${owners.map(o => o.name).join(', ')}; move it up to ${parent.name}.`); }
    }
    // Polymorphism
    for (const fn of M.functions) {
      const v = fn.body.map(x => x.v), label = (fn.cls ? fn.cls + '::' : '') + fn.name + '()';
      if (fn.name !== 'operator==' && fn.name !== 'operator!=') {
        const checks = v.filter(x => x === 'dynamic_cast' || x === 'typeid').length;
        if (checks) { core[fn.defFile].polymorphism += 2 * checks; warnings.push(`${label}: ${checks} run-time type check(s) (dynamic_cast/typeid); use a virtual function instead.`); }
      }
      let casts = 0;
      for (let i = 0; i < v.length; i++) {
        if ((v[i] === 'static_cast' || v[i] === 'reinterpret_cast') && v[i + 1] === '<') { const tgt = v.slice(i + 2, skipAngles(fn.body, i + 1) - 1).filter(x => /^[A-Za-z_]/.test(x) && x !== 'const'); if (tgt.some(x => classNames.has(x) && x !== fn.cls)) casts++; }
        if (v[i] === '(' && classNames.has(v[i + 1]) && v[i + 1] !== fn.cls && ['*', '&'].includes(v[i + 2]) && v[i + 3] === ')' && fn.body[i + 4] && (isId(fn.body[i + 4]) || v[i + 4] === '(' || v[i + 4] === '*')) casts++;
      }
      if (casts) { core[fn.defFile].polymorphism += casts; warnings.push(`${label}: ${casts} cast(s) to a class type; let dynamic binding choose the function.`); }
    }
    for (const c of M.classes) {
      const groups = new Map();
      for (const m of c.methods.filter(x => x.body)) {
        if (m.isCtor && m.params.length === 1 && new RegExp('^(?:const)?' + c.name + '&{1,2}$').test(m.params[0])) continue;   // copy / move constructor
        if (m.name === 'operator=') continue;
        const k = m.isCtor ? '<init>' : m.name; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m);
      }
      for (const [k, ms] of groups) {
        if (ms.length < 2) continue;
        const delegates = m => k === '<init>' ? (m.init || []).some((t, i, a) => t.v === c.name && a[i + 1] && (a[i + 1].v === '(' || a[i + 1].v === '{')) || m.body.some((t, i, a) => t.v === c.name && a[i + 1] && a[i + 1].v === '(')
          : m.body.some((t, i, a) => t.v === k && a[i + 1] && a[i + 1].v === '(');
        const workers = ms.filter(m => !delegates(m) && statements(m.body) >= 2);
        if (workers.length > 1) { core[c.file].polymorphism += 2 * (workers.length - 1); warnings.push(`${c.name}: ${workers.length} overloads of ${k === '<init>' ? 'the constructor' : k + '()'} each do the work; let one call the other${k === '<init>' ? ' (delegating constructor)' : ''}.`); }
      }
    }

    // ---- M: memory management --------------------------------------------------------
    function allocations(fn, c) {
      const out = []; const toks = (fn.init || []).concat([{ v: ';' }], fn.body || []); const v = toks.map(x => x.v);
      const members = new Set(c ? c.members.map(m => m.name) : []), params = new Set((fn.paramNames || []).filter(Boolean));
      for (let k = 0; k < toks.length; k++) {
        if (v[k] !== 'new') continue;
        let q = k + 1; if (v[q] === '(') q = (() => { let d = 0; for (; q < v.length; q++) { if (v[q] === '(') d++; else if (v[q] === ')') { d--; if (d === 0) return q + 1; } } return q; })();
        while (q < v.length && (isId(toks[q]) || v[q] === '::' || v[q] === '*' || v[q] === '<')) { if (v[q] === '<') { q = skipAngles(toks, q); continue; } q++; }
        const kind = v[q] === '[' ? 'array' : 'scalar', line = toks[k].line;
        if (v[k - 1] === '(' && isId(toks[k - 2]) && members.has(v[k - 2]) && k < (fn.init || []).length) { out.push({ name: v[k - 2], kind, elem: false, member: true, line }); continue; }
        if (v[k - 1] === '=') {
          let n = k - 2, elem = false;
          if (v[n] === ']') { let d = 0; for (; n >= 0; n--) { if (v[n] === ']') d++; else if (v[n] === '[') { d--; if (d === 0) break; } } n--; elem = true; }
          if (!isId(toks[n])) continue;
          const name = v[n], viaThis = v[n - 1] === '->' && v[n - 2] === 'this';
          const declared = !elem && !viaThis && toks[n - 1] && (['*', '&', '>'].includes(v[n - 1]) || (isId(toks[n - 1]) && !STATEMENT_WORDS.has(v[n - 1])));
          if (declared) out.push({ name, kind, elem, local: true, line, at: k });
          else if (viaThis || (members.has(name) && !params.has(name))) out.push({ name, kind, elem, member: true, line });
          else if (params.has(name)) out.push({ name, kind, elem, param: true, line });
          else out.push({ name, kind, elem, other: true, line });
          continue;
        }
        if ([';', '{', '}'].includes(v[k - 1])) out.push({ discarded: true, line });
      }
      return out;
    }
    function deletes(fn) {
      const out = [], b = fn.body || [], v = b.map(x => x.v);
      for (let k = 0; k < b.length; k++) {
        if (v[k] !== 'delete' || v[k - 1] === '=') continue;
        let q = k + 1, array = false; if (v[q] === '[' && v[q + 1] === ']') { array = true; q += 2; }
        if (v[q] === 'this' && v[q + 1] === '->') q += 2;
        if (!isId(b[q])) continue;
        out.push({ name: v[q], array, elem: v[q + 1] === '[', line: b[k].line, at: k });
      }
      return out;
    }
    function ownsArray(c, name) { return c.methods.some(m => m.body && allocations(m, c).some(a => a.member && a.name === name && !a.elem && a.kind === 'array')); }
    for (const c of M.classes) {
      const fns = c.methods.filter(m => m.body);
      const allocs = fns.flatMap(m => allocations(m, c).filter(a => a.member).map(a => Object.assign(a, { file: m.defFile })));
      const dels = fns.flatMap(m => deletes(m).map(d => Object.assign(d, { file: m.defFile })));
      const owned = new Map();
      for (const a of allocs) { const key = a.name + (a.elem ? '[]' : ''); if (!owned.has(key)) owned.set(key, { name: a.name, elem: a.elem, kinds: new Set(), line: a.line, file: a.file }); owned.get(key).kinds.add(a.kind); }
      for (const o of owned.values()) {
        const ds = dels.filter(d => d.name === o.name && d.elem === o.elem);
        const what = o.elem ? `elements of '${o.name}'` : `'${o.name}'`;
        if (!ds.length) add('M2', 'memory', 3, o.file, o.line, `${c.name}: ${what} ${o.elem ? 'are' : 'is'} allocated with new but never deleted by the class (memory leak). Release ${o.elem ? 'each element' : 'it'} in the destructor.`);
        for (const d of ds) {
          if (o.kinds.size === 1 && o.kinds.has('array') && !d.array) add('M1', 'memory', 3, d.file, d.line, `${c.name}: ${what} comes from new[] but is released with delete; use delete[].`);
          if (o.kinds.size === 1 && o.kinds.has('scalar') && d.array) add('M1', 'memory', 3, d.file, d.line, `${c.name}: ${what} comes from new but is released with delete[]; use delete.`);
        }
      }
      const dtor = c.methods.find(m => m.isDtor);
      const ownsMemory = owned.size > 0 || (dtor && dtor.body && deletes(dtor).length > 0);
      if (ownsMemory) {
        const copyCtor = c.methods.find(m => m.isCtor && m.params.length === 1 && new RegExp('^(?:const)?' + c.name + '&$').test(m.params[0]));
        const copyAssign = c.methods.find(m => m.name === 'operator=' && m.params.length === 1 && new RegExp('^(?:const)?' + c.name + '&?$').test(m.params[0]));
        if (!dtor) add('M3', 'memory', 2, c.file, c.line, `${c.name} owns heap memory but declares no destructor (Rule of Three).`);
        if (!copyCtor) add('M3', 'memory', 2, c.file, c.line, `${c.name} owns heap memory but has no copy constructor: a copy shares the same pointers and both delete them (Rule of Three). Define it, or declare it = delete.`);
        if (!copyAssign) add('M3', 'memory', 2, c.file, c.line, `${c.name} owns heap memory but has no copy assignment operator: assignment leaks the old memory and shares pointers (Rule of Three). Define it, or declare it = delete.`);
        if (copyAssign && copyAssign.body && /^(?:const)?\w+&$/.test(copyAssign.params[0])) {
          const s = join(copyAssign.body);
          const self = /\bthis\s*(?:==|!=)\s*&|&\s*\w+\s*(?:==|!=)\s*this\b/.test(s);
          if (deletes(copyAssign).length && !self) add('M5', 'memory', 2, copyAssign.defFile, copyAssign.defLine || copyAssign.line, `${c.name}::operator= deletes memory without a self-assignment check; 'x = x' would read freed memory. Check this != &other or use copy-and-swap.`);
        }
      }
      // polymorphic root without a virtual destructor
      const hasVirtual = c.methods.some(m => !m.isDtor && M.isVirtual(c, m));
      const polyAncestor = M.ancestors(c).some(a => a.methods.some(m => !m.isDtor && M.isVirtual(a, m)));
      if (hasVirtual && !polyAncestor) {
        const vd = (dtor && M.isVirtual(c, dtor));
        if (!vd) add('M4', 'memory', 2, c.file, (dtor || c).line, `${c.name} has virtual functions but its destructor is not virtual; deleting a derived object through a ${c.name}* skips the derived destructor.`);
      }
    }
    for (const fn of M.functions) {
      const c = fn.cls ? M.byName.get(fn.cls) : null;
      const allocs = allocations(fn, c), dels = deletes(fn), b = fn.body, v = b.map(x => x.v);
      for (const a of allocs) {
        if (a.discarded) { add('M2', 'memory', 2, fn.defFile, a.line, `${fn.cls ? fn.cls + '::' : ''}${fn.name}(): the result of new is discarded (memory leak).`); continue; }
        if (!a.local && !a.param) continue;
        const ds = dels.filter(d => d.name === a.name && !d.elem);
        for (const d of ds) {
          if (a.kind === 'array' && !d.array) add('M1', 'memory', 3, fn.defFile, d.line, `${fn.name}(): '${a.name}' comes from new[] but is released with delete; use delete[].`);
          if (a.kind === 'scalar' && d.array) add('M1', 'memory', 3, fn.defFile, d.line, `${fn.name}(): '${a.name}' comes from new but is released with delete[]; use delete.`);
        }
        if (!a.local) continue;
        const after = b.filter((x, k) => k > (a.at - (fn.init || []).length - 1));
        const av = after.map(x => x.v);
        const used = ds.length || av.some((x, k) => x === a.name && (
          av[k - 1] === 'return' || av[k - 1] === '=' || ((av[k - 1] === '(' || av[k - 1] === ',' || av[k - 1] === '{') && (av[k + 1] === ')' || av[k + 1] === ',' || av[k + 1] === '}'))));
        if (!used) add('M2', 'memory', 2, fn.defFile, a.line, `${fn.cls ? fn.cls + '::' : ''}${fn.name}(): '${a.name}' is allocated with new but never deleted, returned or handed to an owner (memory leak).`);
      }
      for (let k = 0; k < v.length; k++) if (['malloc', 'calloc', 'realloc', 'free'].includes(v[k]) && v[k + 1] === '(' && v[k - 1] !== '.' && v[k - 1] !== '->') add('M6', 'memory', 1, fn.defFile, b[k].line, `${fn.cls ? fn.cls + '::' : ''}${fn.name}(): ${v[k]}() is C memory management; use new/delete (constructors and destructors do not run with ${v[k]}).`);
    }

    // ---- E: exceptions ----------------------------------------------------------------
    const OUTPUT = new Set(['cout', 'cerr', 'clog', 'printf', 'fprintf', 'puts', 'perror']);
    for (const fn of M.functions) {
      const b = fn.body, v = b.map(x => x.v), label = (fn.cls ? fn.cls + '::' : '') + fn.name + '()';
      for (let k = 0; k < b.length; k++) {
        if (v[k] === 'catch' && v[k + 1] === '(') {
          let e = k + 1, d = 0; for (; e < b.length; e++) { if (v[e] === '(') d++; else if (v[e] === ')') { d--; if (d === 0) break; } }
          const decl = b.slice(k + 2, e), open = e + 1; if (v[open] !== '{') continue;
          let close = open; d = 0; for (; close < b.length; close++) { if (v[close] === '{') d++; else if (v[close] === '}') { d--; if (d === 0) break; } }
          const body = b.slice(open + 1, close), dv = decl.map(x => x.v);
          const stmts = splitTop(body, ';');
          const swallowed = !body.length || stmts.every(s => { const w = s.map(x => x.v).filter(x => x !== 'std' && x !== '::'); return w.length && OUTPUT.has(w[0]); });
          const broad = dv.includes('...') || (dv.includes('exception') && !dv.some(x => /_error$|^bad_|^out_of_range$|^invalid_argument$|^length_error$|^domain_error$/.test(x)));
          const byValue = !dv.includes('...') && !dv.includes('&') && !dv.includes('*') && !dv.some(x => BUILTIN.has(x));
          if (swallowed) add('E2', 'exceptions', 3, fn.defFile, b[k].line, `${label}: catch block ${body.length ? 'only prints' : 'is empty'}; the failure is hidden from the caller.`);
          else if (broad) add('E1', 'exceptions', 2, fn.defFile, b[k].line, `${label}: catch (${dv.join(' ').replace(/ ?:: ?/g, '::').replace(/ &/g, '&')}) is too broad; catch the specific exception type you can handle.`);
          else if (byValue) add('E3', 'exceptions', 1, fn.defFile, b[k].line, `${label}: exception caught by value (copy and slicing); catch by const reference.`);
        }
        if (v[k] === 'throw' && v[k + 1] === 'new') add('E4', 'exceptions', 2, fn.defFile, b[k].line, `${label}: 'throw new' throws a pointer that nobody deletes; throw the object itself.`);
        else if (v[k] === 'throw' && b[k + 1] && (b[k + 1].kind === 'lit' || b[k + 1].kind === 'num')) add('E5', 'exceptions', 1, fn.defFile, b[k].line, `${label}: throws a literal; throw a std::exception type (for example std::invalid_argument).`);
      }
    }

    // ---- P: C++ practices --------------------------------------------------------------
    for (const p of M.parsed) {
      const head = HEADER.test(p.file);
      if (head) {
        const d = p.pp.map(x => x.text);
        const guard = d.some(x => /^#\s*pragma\s+once\b/.test(x)) || (d[0] && d[1] && (() => { const a = d[0].match(/^#\s*ifndef\s+(\w+)/) || d[0].match(/^#\s*if\s+!\s*defined\s*\(?\s*(\w+)/); const b = d[1].match(/^#\s*define\s+(\w+)/); return a && b && a[1] === b[1]; })());
        if (!guard) add('P2', 'practices', 1, p.file, 1, 'Header has no include guard (#ifndef/#define/#endif) or #pragma once.');
        p.tokens.forEach((t, k) => { if (t.v === 'using' && p.tokens[k + 1] && p.tokens[k + 1].v === 'namespace') add('P1', 'practices', 2, p.file, t.line, `'using namespace ${p.tokens[k + 2] ? p.tokens[k + 2].v : ''}' in a header leaks into every file that includes it; qualify names (std::string) instead.`); });
      }
      for (const g of p.globals) {
        if (g.isConst || g.isExtern) continue;
        if (g.isStatic || g.anon) review(g.file, g.line, `File-local mutable variable '${g.name}'; check that shared state is intended.`);
        else add('P4', 'practices', 2, g.file, g.line, `Global mutable variable '${g.name}' is shared by every object; keep state inside a class.`);
      }
    }
    for (const c of M.classes) for (const m of c.methods) {
      if (!m.body || m.isConst || m.isStatic || m.isCtor || m.isDtor || m.name.startsWith('operator')) continue;
      const v = m.body.map(x => x.v); if (v[0] !== 'return' || v[v.length - 1] !== ';' || v.slice(0, -1).includes(';')) continue;
      const e = v.slice(1, -1);
      if (e.includes('(') || e.includes('=') || e.includes('++') || e.includes('--') || e.includes('new') || e.includes('delete')) continue;
      const rt = m.retType.map(x => x.v); if (rt.includes('&') && !rt.includes('const')) continue;
      if (!e.some(x => c.members.some(mm => mm.name === x && !mm.isStatic))) continue;
      add('P3', 'practices', 1, m.defFile, m.defLine || m.line, `${c.name}::${m.name}() only reads data members but is not const; declare it '${m.name}(...) const'.`);
    }

    // ---- scope, information and per-file totals ----------------------------------------
    let section = null, missing = [];
    for (const [s, req] of Object.entries(SECTIONS)) { const present = req.filter(n => classNames.has(n)).length; if (present && (!section || present > SECTIONS[section].filter(n => classNames.has(n)).length)) section = s; }
    if (section) missing = SECTIONS[section].filter(n => !classNames.has(n));
    for (const c of M.classes) {
      if (c.bases.length) info.push(`${c.name} : ${c.bases.map(b => (b.access || (c.kind === 'class' ? 'private' : 'public')) + ' ' + b.name).join(', ')}`);
      if (c.bases.some(b => b.access === 'private' || (!b.access && c.kind === 'class'))) warnings.push(`${c.name} inherits privately (default for class); write ': public Base' for an is-a relationship.`);
      if (c.methods.some(m => m.isPure)) info.push(`${c.name} is abstract (pure virtual functions)`);
      const vs = c.methods.filter(m => !m.isDtor && M.isVirtual(c, m)).length; if (vs) info.push(`${c.name}: ${vs} virtual function(s)`);
      const ops = c.methods.filter(m => m.name.startsWith('operator')).map(m => m.name); if (ops.length) info.push(`${c.name} overloads ${[...new Set(ops)].join(', ')}`);
    }
    const perFile = {}; let totalMethods = 0;
    const totals = Object.fromEntries(coreKeys.map(k => [k, 0]));
    for (const [f, x] of Object.entries(core)) {
      x.dup = Math.round((dup.perFile[f] || 0) * 100) / 100; totalMethods += x.methods; coreKeys.forEach(k => totals[k] += x[k]);
      perFile[f] = Object.assign({}, x, { total: x.dup + coreKeys.reduce((a, k) => a + x[k], 0) });
    }
    const coreTotal = dup.totalDuplicateCost + coreKeys.reduce((a, k) => a + totals[k], 0);
    const addedTotals = Object.fromEntries(addedKeys.map(k => [k, findings.filter(x => x.category === k).reduce((a, x) => a + x.cost, 0)]));
    findings.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line);
    if (!info.length) info.push('No inheritance or virtual functions detected.');
    return {
      version: VERSION,
      core: { totalCost: coreTotal, duplicates: dup, totals, perFile, totalMethods, classCount: M.classes.length, warnings: [...new Set(warnings)], info: [...new Set(info)] },
      totals: addedTotals, totalCost: addedKeys.reduce((a, k) => a + addedTotals[k], 0), perFile: added, findings, reviews,
      section, missing, scopeValid: !!section && missing.length === 0
    };
  }
  return { VERSION, SECTIONS, analyze, lex };
});
