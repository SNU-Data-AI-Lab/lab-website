self.addEventListener('DOMContentLoaded', () => {
  const codeEl = document.getElementById('code');
  const lineNums = document.getElementById('line-numbers');
  const cursorEl = document.getElementById('cursor');
  const analyzeBtn = document.getElementById('analyze');
  const uploadBtn = document.getElementById('upload');
  const fileInput = document.getElementById('file-input');
  const fileTabsContainer = document.getElementById('files');
  const filenameInput = document.getElementById('filename');
  const removeBtn = document.getElementById('remove-file');
  const saveBaselineBtn = document.getElementById('save-baseline');
  const deltaEl = document.getElementById('delta');

  // Baseline Tracking State
  let baselineCost = null;
  let lastTotalCost = 0;
  let savedBaselines = [];

  // 1. State Management
  let filesState = { 'Main.java': codeEl.value };
  let activeFile = 'Main.java';
  const modeEl = document.getElementById('analysis-mode');
  const isHW3 = () => modeEl.value === 'hw3';
  const isHW4 = () => modeEl.value === 'hw4';
  const CPP_FILE = /\.(?:h|hh|hpp|hxx|cpp|cc|cxx)$/i;
  const CPP_EXCLUDED = /^(?:main|hidden_tests)\.(?:cpp|h)$|^test/i;
  function resetBaselines() {
    baselineCost = null; savedBaselines = []; saveBaselineBtn.disabled = true;
    document.getElementById('baseline-select').hidden = true;
    document.getElementById('baseline-select').innerHTML = '';
    document.getElementById('baseline-list').innerHTML = ''; deltaEl.hidden = true;
  }
  function markStale() {
    saveBaselineBtn.disabled = true;
    document.getElementById('result-status').textContent = 'Reanalyze';
    document.getElementById('result-status').className = 'status-label stale';
  }
  modeEl.addEventListener('change', () => {
    filesState[activeFile] = codeEl.value;
    if (isHW3()) {
      delete filesState['Main.java']; delete filesState['TestSupport.java'];
      if (!Object.keys(filesState).length) filesState = { 'Student.java': '' };
      activeFile = Object.keys(filesState)[0]; codeEl.value = filesState[activeFile];
      filenameInput.value = activeFile; renderTabs(); updateLines();
    }
    if (isHW4()) {
      for (const f of Object.keys(filesState)) if (!CPP_FILE.test(f) || CPP_EXCLUDED.test(f)) delete filesState[f];
      if (!Object.keys(filesState).length) filesState = { 'source.cpp': '' };
      activeFile = Object.keys(filesState)[0]; codeEl.value = filesState[activeFile];
      filenameInput.value = activeFile; renderTabs(); updateLines();
    }
    fileInput.accept = isHW4() ? '.h,.hh,.hpp,.hxx,.cpp,.cc,.cxx' : '.java';
    resetBaselines(); markStale();
    document.getElementById('hw3-results').hidden = !isHW3();
    document.getElementById('hw3-details').hidden = !isHW3();
    document.getElementById('hw4-results').hidden = !isHW4();
    document.getElementById('hw4-details').hidden = !isHW4();
    document.getElementById('scope-note').textContent = isHW3() ? 'HW3: each upload replaces the entire source set; grading thresholds are pending.' : isHW4() ? 'HW4 Section 2 (C++): each upload replaces the entire source set; grading thresholds are pending.' : 'Original analysis rules and upload behavior.';
  });
  ['complexityLimit','sizeLimit','duplicateTokens'].forEach(id => document.getElementById(id).addEventListener('input', () => { resetBaselines(); markStale(); }));


const baselineSelect = document.getElementById('baseline-select');

// Save Baseline Event Listener & UI Updater
  saveBaselineBtn.addEventListener('click', () => {
    // Save to list
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const baselineId = savedBaselines.length + 1;
    savedBaselines.push({ cost: lastTotalCost, time: timestamp, id: baselineId });

    baselineCost = lastTotalCost;

    // Update dropdown options (time removed)
    baselineSelect.innerHTML = savedBaselines.map(b =>
      `<option value="${b.id}">Baseline ${b.id}</option>`
    ).join('');

    baselineSelect.value = baselineId;
    baselineSelect.hidden = false;

    updateBaselineUI();
  });

  // Handle user changing the baseline comparison
  baselineSelect.addEventListener('change', (e) => {
    const selectedId = parseInt(e.target.value, 10);
    const selectedBaseline = savedBaselines.find(b => b.id === selectedId);

    if (selectedBaseline) {
      baselineCost = selectedBaseline.cost;
      updateBaselineUI();
    }
  });

  function updateBaselineUI() {
    if (baselineCost === null) {
      deltaEl.hidden = true;
      return;
    }

    const diff = lastTotalCost - baselineCost;
    deltaEl.hidden = false;

    if (diff === 0) {
      deltaEl.textContent = '0 vs baseline';
      deltaEl.className = 'delta';
    } else if (diff < 0) {
      deltaEl.textContent = `${diff} vs baseline`;
      deltaEl.className = 'delta';
    } else {
      deltaEl.textContent = `+${diff} vs baseline`;
      deltaEl.className = 'delta higher';
    }

    // Render baseline list (time removed)
    const listContainer = document.getElementById('baseline-list');
    if(listContainer) {
      listContainer.innerHTML = savedBaselines.map((b, i) =>
        `<div class="baseline-item">
          <span>Baseline ${i + 1}</span>
          <b>Cost: ${b.cost}</b>
        </div>`
      ).join('');
    }
  }

  // 2. UI Updaters
  function updateLines() {
    const lines = codeEl.value.split('\n').length;
    lineNums.textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
  }

  function updateCursor() {
    const pos = codeEl.selectionStart;
    const lines = codeEl.value.substring(0, pos).split('\n');
    cursorEl.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
  }

  function renderTabs() {
    fileTabsContainer.innerHTML = '';
    Object.keys(filesState).forEach(fileName => {
      const btn = document.createElement('button');
      btn.className = 'file-tab';
      btn.textContent = fileName;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', fileName === activeFile ? 'true' : 'false');

      btn.onclick = () => {
        filesState[activeFile] = codeEl.value; // Save current editor state
        activeFile = fileName;                 // Switch active file
        codeEl.value = filesState[fileName];   // Load new file into editor
        filenameInput.value = fileName;
        renderTabs();
        updateLines();
      };

      fileTabsContainer.appendChild(btn);
    });
  }

  // 3. Multi-file Upload Logic
  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    const selected = Array.from(files);
    if (isHW3()) {
      const invalid = selected.filter(f => !f.name.endsWith('.java') || ['Main.java','TestSupport.java'].includes(f.name));
      const duplicate = new Set(selected.map(f => f.name)).size !== selected.length;
      if (invalid.length || duplicate) {
        const n=document.getElementById('notice'); n.hidden=false;
        n.textContent='Select only workshop .java files (including helpers), with unique filenames. Main.java/TestSupport.java are excluded.';
        fileInput.value=''; return;
      }
    }
    if (isHW4()) {
      const invalid = selected.filter(f => !CPP_FILE.test(f.name) || CPP_EXCLUDED.test(f.name));
      const duplicate = new Set(selected.map(f => f.name)).size !== selected.length;
      if (invalid.length || duplicate) {
        const n=document.getElementById('notice'); n.hidden=false;
        n.textContent='Select only the Section 2 class .h/.cpp files, with unique filenames. main.cpp, hidden_tests.cpp and test files are excluded.';
        fileInput.value=''; return;
      }
    }
    if (isHW3() || isHW4()) selected.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const incoming = await Promise.all(selected.map(async file => [file.name, await file.text()]));
    if (isHW3() || isHW4()) filesState = {};
    for (let i = 0; i < incoming.length; i++) {
      const file = { name: incoming[i][0] };
      const text = incoming[i][1];
      filesState[file.name] = text;
      activeFile = file.name; // Focus the last uploaded file
    }

    codeEl.value = filesState[activeFile];
    filenameInput.value = activeFile;

    renderTabs();
    updateLines();
//    runAnalysis();
    markStale();
    document.getElementById('notice').hidden=true;
    fileInput.value = ''; // Reset input
  });

  // 4. Remove File Logic
  removeBtn.addEventListener('click', () => {
    markStale();
    delete filesState[activeFile];

    const remainingFiles = Object.keys(filesState);

    if (remainingFiles.length === 0) {
      activeFile = isHW3() ? 'Student.java' : isHW4() ? 'source.cpp' : 'Main.java';
      filesState[activeFile] = '';
    } else {
      activeFile = remainingFiles[0];
    }

    codeEl.value = filesState[activeFile];
    filenameInput.value = activeFile;

    renderTabs();
    updateLines();
//    runAnalysis();
  });

  // Keep state synced when typing
  codeEl.addEventListener('input', () => {
    markStale();
    updateLines();
    filesState[activeFile] = codeEl.value;
  });

  // 5. Aggregated Analysis
  // ===================== Analysis core (v2) =====================
  // v1 rules are unchanged except two false-positive fixes (marked FIX).
  // New rules are marked NEW with the lecture slide they come from.
  function stripJavaComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));
  }
  function stripJavaCommentsAndStrings(src) {
    return stripJavaComments(src)
      .replace(/"(?:\\.|[^"\\])*"/g, m => m.replace(/[^\n]/g, ' '))
      .replace(/'(?:\\.|[^'\\])*'/g, m => m.replace(/[^\n]/g, ' '));
  }
  function findMatchingBrace(src, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return src.length - 1;
  }
  // Split a parameter list at top-level commas (generic arguments may contain commas).
  function splitParams(pm) {
    const out = []; let depth = 0, cur = '';
    for (const ch of pm) {
      if (ch === '<') depth++;
      if (ch === '>') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  // FIX: parameter types (not just the count) identify a method, so an overload is never mistaken for an override.
  function paramTypes(pm) {
    return splitParams(pm).map(p => {
      let t = p.replace(/@\w+/g, ' ').replace(/\bfinal\b/g, ' ').trim();
      const m = t.match(/^(.*?)([A-Za-z_$][\w$]*)\s*((?:\[\s*\])*)$/);
      if (m) t = m[1] + m[3];
      t = t.replace(/\s+/g, '').replace(/<.*>/, '');      // drop generic arguments: List<String> -> List
      return t.replace(/^.*\./, '');                       // java.lang.Object -> Object
    });
  }
  function classMetrics(src) {
    const clean = stripJavaCommentsAndStrings(src), noComment = stripJavaComments(src), classes = [];
    const rx = /\b((?:public|protected|private|abstract|final|static)\s+)*(class|interface)\s+([A-Za-z_$][\w$]*)([^\{]*)\{/g;
    let m;
    while ((m = rx.exec(clean)) !== null) {
      const name = m[3], tail = m[4] || '', open = clean.indexOf('{', m.index), close = findMatchingBrace(clean, open);
      const isInterface = m[2] === 'interface';
      const body = clean.slice(open + 1, close), methods = [], abstractMethods = [], fields = [];
      let depth = 0, last = 0;
      const vis = d => /\bpublic\b/.test(d) ? 'public' : /\bprotected\b/.test(d) ? 'protected' : /\bprivate\b/.test(d) ? 'private' : (isInterface ? 'public' : 'package');
      const methodInfo = decl => {
        const mm = decl.match(/([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*(?:throws[\s\S]*)?$/);
        const mn = mm ? mm[1] : '(method)', pm = mm ? mm[2] : '';
        const types = pm.trim() ? paramTypes(pm) : [];
        return { name: mn, paramCount: types.length, paramTypes: types, signature: mn + '(' + types.join(',') + ')',
                 decl, visibility: vis(decl), override: /@Override\b/.test(decl), isConstructor: mn === name };
      };
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '{') {
          if (depth === 0) {
            const decl = body.slice(last, i).trim();
            if (/\([^;{}]*\)\s*(?:throws\s+[\w$.,\s]+)?$/.test(decl)) {
              const absOpen = open + 1 + i, mc = findMatchingBrace(clean, absOpen);
              methods.push(Object.assign(methodInfo(decl), { body: clean.slice(absOpen + 1, mc), rawBody: noComment.slice(absOpen + 1, mc) }));
            }
          }
          depth++;
        } else if (ch === '}') { depth = Math.max(0, depth - 1); if (depth === 0) last = i + 1; }
        else if (ch === ';' && depth === 0) {
          const decl = body.slice(last, i).trim();
          if (decl && /\([^;{}]*\)\s*(?:throws\s+[\w$.,\s]+)?$/.test(decl)) {
            abstractMethods.push(methodInfo(decl));          // NEW: abstract / interface method declarations
          } else if (decl) {
            const left = decl.split('=')[0].trim(), fm = left.match(/([A-Za-z_$][\w$]*)\s*((?:\[\s*\])*)\s*$/);
            const typePart = fm ? left.slice(0, left.length - fm[0].length) : '';
            fields.push({ decl, name: fm ? fm[1] : '(field)', visibility: vis(decl),
                          isStatic: /\bstatic\b/.test(decl) || isInterface, isFinal: /\bfinal\b/.test(decl) || isInterface,
                          isArray: /\[\s*\]/.test(left), type: typePart.replace(/\b(public|protected|private|static|final|transient|volatile)\b/g, '').replace(/\s+/g, '') + (fm && fm[2] ? fm[2].replace(/\s/g, '') : '') });
          }
          last = i + 1;
        }
      }
      const ex = tail.match(/\bextends\s+([A-Za-z_$][\w$]*)/);
      const im = tail.match(/\bimplements\s+([^\{]+)/);
      const interfaces = im ? splitParams(im[1]).map(x => x.trim().replace(/<.*$/, '')) : [];
      classes.push({ name, kind: m[2], tail, body, methods, abstractMethods, fields, parent: isInterface ? null : (ex ? ex[1] : null), interfaces });
      rx.lastIndex = Math.max(rx.lastIndex, close + 1);
    }
    return classes;
  }
  function methodComplexity(body) {
    let c = 1, d = 0; const ts = body.match(/\belse\s+if\b|\bif\b|\bfor\b|\bwhile\b|\bdo\b|\bswitch\b|\bcatch\b|\bcase\b|\?|&&|\|\||\{|\}/g) || [];
    for (const t of ts) { if (t === '{') { d++; continue } if (t === '}') { d = Math.max(0, d - 1); continue } c += (t === '&&' || t === '||') ? 1 : 1 + d; } return c;
  }
  function methodStatementCount(body) { const x = body.replace(/\bfor\s*\([^)]*\)/g, m => m.replace(/;/g, ' ')); return (x.match(/;/g) || []).length + (body.match(/\belse\s+if\b|\bif\b|\bfor\b|\bwhile\b|\bdo\b|\bswitch\b|\bcatch\b|\btry\b/g) || []).length; }
  const JAVA_KW = new Set(['class','public','private','protected','static','final','abstract','void','int','long','double','float','boolean','char','byte','short','String','if','else','for','while','do','switch','case','default','break','continue','return','new','try','catch','finally','throw','throws','this','super','null','true','false','instanceof','extends','implements','interface','enum','package','import']);
  function tokenizeJava(src) { const clean = stripJavaCommentsAndStrings(src), raw = clean.match(/[A-Za-z_$][\w$]*|[0-9]+|==|!=|<=|>=|&&|\|\||\+\+|--|[+\-*\/%&|^!=<>{}()\[\];,]/g) || []; return raw.map(t => /^[A-Za-z_$][\w$]*$/.test(t) && !JAVA_KW.has(t) ? 'ID' : (/^[0-9]+$/.test(t) ? 'NUM' : t)); }
  // FIX: for "copied parent method" keep literal values, so return 180; and return 250; are not a copy.
  function literalAwareBody(rawBody) {
    const raw = stripJavaComments(rawBody).match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$]*|[0-9][\w.]*|==|!=|<=|>=|&&|\|\||\+\+|--|[+\-*\/%&|^!=<>{}()\[\];,.?:]/g) || [];
    return raw.map(t => /^[A-Za-z_$][\w$]*$/.test(t) && !JAVA_KW.has(t) ? 'ID' : t).join(' ');
  }
  // FIX: duplicate detection keeps number values (v1 replaced every number with NUM), so sibling classes that
  // differ only in their constants (e.g. a range 1..100 vs 18..30) are not reported as copied code.
  // Tokens are otherwise exactly v1's, so real copy-paste costs the same as before.
  // FIX (HW1 survey): one-line getters/setters (getX / isX / setX whose whole body is `return x;` or `this.x = x;`)
  // all look the same, so v1 reported them as duplicated code and private fields + getters cost more than
  // package-private fields. They are removed before duplicate detection. Getters/setters with validation stay.
  const TRIVIAL_ACCESSOR = /(?:\b(?:public|protected|private|static|final)\s+)*[\w$<>\[\],.\s]+?\s(?:get|is|set)[A-Z][\w$]*\s*\([^()]*\)\s*\{\s*(?:return\s+(?:this\s*\.\s*)?[A-Za-z_$][\w$]*\s*;|(?:this\s*\.\s*)?[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\s*;)\s*\}/g;
  function removeTrivialAccessors(clean) { return clean.replace(TRIVIAL_ACCESSOR, m => m.replace(/[^\n]/g, ' ')); }
  function tokenizeForDuplicates(src) { const clean = removeTrivialAccessors(stripJavaCommentsAndStrings(src)), raw = clean.match(/[A-Za-z_$][\w$]*|[0-9]+|==|!=|<=|>=|&&|\|\||\+\+|--|[+\-*\/%&|^!=<>{}()\[\];,]/g) || []; return raw.map(t => /^[A-Za-z_$][\w$]*$/.test(t) && !JAVA_KW.has(t) ? 'ID' : t); }
  function findDuplicates(files, minTokens) { const tok = Object.fromEntries(Object.entries(files).map(([n, s]) => [n, tokenizeForDuplicates(s)])), names = Object.keys(tok), w = Math.max(10, minTokens), seen = new Map(), groups = []; for (const n of names) for (let i = 0; i <= tok[n].length - w; i++) { const k = tok[n].slice(i, i + w).join(' '); if (!seen.has(k)) seen.set(k, []); seen.get(k).push({ file: n, index: i }); } const occ = Object.fromEntries(names.map(n => [n, new Set()])); for (const ps of seen.values()) { const u = ps.filter(p => !occ[p.file].has(p.index)); if (u.length < 2) continue; const fs = [...new Set(u.map(p => p.file))], cost = Math.ceil(w / 10) * (u.length - 1); groups.push({ cost, files: fs }); for (const p of u) for (let k = 0; k < w; k++) occ[p.file].add(p.index + k); } const perFile = Object.fromEntries(names.map(n => [n, 0])); let totalDuplicateCost = 0; for (const g of groups) { totalDuplicateCost += g.cost; const sh = g.cost / g.files.length; g.files.forEach(f => perFile[f] += sh); } return { totalDuplicateCost, duplicateGroups: groups.length, perFile }; }

  function parentClass(cls, all) { return cls.parent ? all.find(c => c.name === cls.parent) || null : null; }
  function ancestorClasses(cls, all) { const out = []; let p = parentClass(cls, all), seen = new Set(); while (p && !seen.has(p.name)) { out.push(p); seen.add(p.name); p = parentClass(p, all); } return out; }
  function allInterfaceNames(cls, all) {
    const names = new Set(), stack = [cls, ...ancestorClasses(cls, all)].flatMap(c => c.interfaces || []);
    while (stack.length) { const n = stack.pop(); if (names.has(n)) continue; names.add(n); const it = all.find(c => c.name === n && c.kind === 'interface'); if (it) stack.push(...(it.interfaces || []), ...(it.tail.match(/\bextends\s+([^\{]+)/) ? splitParams(it.tail.match(/\bextends\s+([^\{]+)/)[1]).map(x => x.trim().replace(/<.*$/, '')) : [])); }
    return names;
  }
  // Methods every class inherits from Object (7-inheritance-2: Object Class Methods).
  const OBJECT_METHODS = new Set(['toString()', 'equals(Object)', 'hashCode()']);

  function inheritanceMetrics(cls, all, out) {
    const ancestors = ancestorClasses(cls, all); let reuse = 0, hiding = 0, override = 0;
    const counted = new Set();
    for (const anc of ancestors) {
      const parentFields = new Map(anc.fields.filter(f => f.visibility !== 'private').map(f => [f.name, f]));
      for (const f of cls.fields) {
        if (parentFields.has(f.name)) { hiding += 2; reuse += 2; out.warnings.push(`${cls.name}.${f.name} hides the field of ${anc.name}; reuse the parent field instead.`); }
      }
      const parentMethods = new Map(anc.methods.filter(m => m.visibility !== 'private').map(m => [m.signature, m]));
      for (const m of cls.methods) {
        const pm = parentMethods.get(m.signature); if (!pm) continue;
        if (!m.override && !counted.has(m.signature)) { override += 1; counted.add(m.signature); out.warnings.push(`${cls.name}.${m.signature}: missing @Override.`); }
        const a = literalAwareBody(m.rawBody), b = literalAwareBody(pm.rawBody);
        if (a && b && a === b) { reuse += Math.max(1, Math.ceil(a.split(' ').length / 10)); out.warnings.push(`${cls.name}.${m.signature} copies ${anc.name}.${m.signature}; inherit it or call super instead.`); }
      }
    }
    // NEW (6-inheritance-1 @Override, 7-inheritance-2 Object methods / Interface / Abstract class):
    // implementing an abstract or interface method, or overriding toString/equals/hashCode, also needs @Override.
    const inherited = new Set();
    for (const anc of ancestors) anc.abstractMethods.filter(m => m.visibility !== 'private').forEach(m => inherited.add(m.signature));
    for (const n of allInterfaceNames(cls, all)) {
      const it = all.find(c => c.name === n && c.kind === 'interface');
      if (it) { it.abstractMethods.forEach(m => inherited.add(m.signature)); it.methods.forEach(m => inherited.add(m.signature)); }
    }
    const comparable = [...allInterfaceNames(cls, all)].some(n => n === 'Comparable');
    for (const m of cls.methods) {
      if (m.override || m.isConstructor || counted.has(m.signature)) continue;
      const fromObject = cls.kind === 'class' && OBJECT_METHODS.has(m.signature);
      const fromComparable = comparable && m.name === 'compareTo' && m.paramCount === 1;
      if (inherited.has(m.signature) || fromObject || fromComparable) {
        override += 1; counted.add(m.signature); out.warnings.push(`${cls.name}.${m.signature}: missing @Override.`);
      }
      if (cls.kind === 'class' && m.name === 'equals' && m.paramCount === 1 && m.paramTypes[0] !== 'Object') {
        out.warnings.push(`${cls.name}.equals(${m.paramTypes[0]}) overloads equals instead of overriding equals(Object).`);
      }
    }
    return { reuse, hiding, override };
  }

  // NEW (6-inheritance-1 "Advantage: Reusability", 7-inheritance-2 "Abstract Class: related classes share instance fields"):
  // the same field declared in two or more sibling classes belongs in their parent.
  function siblingFieldCost(all, out) {
    let cost = 0; const perClass = {};
    for (const parent of all.filter(c => c.kind === 'class')) {
      const kids = all.filter(c => c.parent === parent.name);
      if (kids.length < 2) continue;
      const parentNames = new Set(parent.fields.map(f => f.name));
      const seen = new Map();
      for (const k of kids) for (const f of k.fields) {
        if (f.isStatic || parentNames.has(f.name)) continue;
        const key = f.name + ':' + f.type;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(k.name);
      }
      for (const [key, owners] of seen) {
        if (owners.length < 2) continue;
        cost += 2 * (owners.length - 1);
        owners.slice(1).forEach(o => perClass[o] = (perClass[o] || 0) + 2);
        out.warnings.push(`Field '${key.split(':')[0]}' is declared in ${owners.join(', ')}; move it up to ${parent.name}.`);
      }
    }
    return { cost, perClass };
  }

  function encapsulationCost(cls, out) {
    let cost = 0;
    if (cls.kind !== 'class') return 0;
    for (const f of cls.fields) {
      if (f.isStatic && f.isFinal) continue;
      if (f.visibility === 'public') { cost += 2; out.warnings.push(`${cls.name}.${f.name} is a public mutable field.`); }
      // NEW (5-encapsulation "Access Modifiers": default access is package-wide): +1 for a package-private mutable field.
      else if (f.visibility === 'package' && !f.isStatic) { cost += 1; out.warnings.push(`${cls.name}.${f.name} has default (package) access; make it private.`); }
    }
    // NEW (5-encapsulation "Defensive programming: protect data from an unauthorized access"):
    // a non-private method that returns an internal array lets callers change the object.
    const arrays = new Set(cls.fields.filter(f => f.isArray && !f.isStatic).map(f => f.name));
    for (const m of cls.methods) {
      if (m.visibility === 'private') continue;
      const rx = /\breturn\s+(?:this\s*\.\s*)?([A-Za-z_$][\w$]*)\s*;/g; let r;
      while ((r = rx.exec(m.body)) !== null) {
        if (arrays.has(r[1])) { cost += 2; out.warnings.push(`${cls.name}.${m.name}() returns the internal array '${r[1]}'; return a copy.`); }
      }
    }
    return cost;
  }

  function polymorphismCost(cls, classNames, out) {
    let cost = 0;
    for (const m of cls.methods) {
      const inEquals = m.name === 'equals' && m.paramCount === 1;
      if (!inEquals) {
        // NEW (8-polymorphism "Use of instanceof / getClass()" and "Limitations of instanceof and getClass()"):
        // a type check that imitates overriding.
        const checks = (m.body.match(/\binstanceof\b|\bgetClass\s*\(\s*\)/g) || []).length;
        if (checks) { cost += 2 * checks; out.warnings.push(`${cls.name}.${m.name}(): ${checks} type check(s) (instanceof/getClass); use overriding instead.`); }
        // NEW (8-polymorphism "Casting: Downcasting ... rarely used"): a cast to one of your own classes.
        const rx = /\(\s*([A-Z][\w$]*)\s*\)\s*(?=[A-Za-z_$(])/g; let c, casts = 0;
        while ((c = rx.exec(m.body)) !== null) if (classNames.has(c[1]) && c[1] !== cls.name) casts++;
        if (casts) { cost += casts; out.warnings.push(`${cls.name}.${m.name}(): ${casts} cast(s) to a class type; let dynamic binding choose the method.`); }
      }
    }
    // NEW (8-polymorphism "Overloading Principles: only one of the overloading methods should do most of the work",
    //      "Constructor Overloading Rules: one constructor can call another constructor with this()").
    const groups = new Map();
    for (const m of cls.methods) { const k = m.isConstructor ? '<init>' : m.name; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    for (const [k, ms] of groups) {
      if (ms.length < 2) continue;
      const call = k === '<init>' ? /\bthis\s*\(/ : new RegExp('\\b' + k.replace(/\$/g, '\\$') + '\\s*\\(');
      const workers = ms.filter(m => !call.test(m.body) && methodStatementCount(m.body) >= 2);
      if (workers.length > 1) {
        cost += 2 * (workers.length - 1);
        out.warnings.push(`${cls.name}: ${workers.length} overloads of ${k === '<init>' ? 'the constructor' : k + '()'} each do the work; let one call the other${k === '<init>' ? ' with this(...)' : ''}.`);
      }
    }
    return cost;
  }

  function analyzeFiles(filesState, limitC, limitS, minTokens) {
    const duplicates = findDuplicates(filesState, minTokens), parsed = {}; let all = [];
    for (const [f, src] of Object.entries(filesState)) { parsed[f] = classMetrics(src); all.push(...parsed[f]); }
    const classNames = new Set(all.map(c => c.name));
    const out = { warnings: [], info: [] };
    const sib = siblingFieldCost(all, out);
    const keys = ['complexity', 'size', 'encapsulation', 'reuse', 'hiding', 'override', 'polymorphism'];
    const totals = Object.fromEntries(keys.map(k => [k, 0])), perFile = {}; let totalMethods = 0;
    for (const [fileName, classes] of Object.entries(parsed)) {
      const x = Object.fromEntries(keys.map(k => [k, 0])); let methods = 0;
      for (const cls of classes) {
        methods += cls.methods.length;
        for (const m of cls.methods) { x.complexity += Math.max(0, methodComplexity(m.body) - limitC) * 2; x.size += Math.max(0, Math.ceil((methodStatementCount(m.body) - limitS) / 5)); }
        x.encapsulation += encapsulationCost(cls, out);
        const im = inheritanceMetrics(cls, all, out); x.reuse += im.reuse + (sib.perClass[cls.name] || 0); x.hiding += im.hiding; x.override += im.override;
        x.polymorphism += polymorphismCost(cls, classNames, out);
      }
      totalMethods += methods; keys.forEach(k => totals[k] += x[k]);
      const dup = Math.round((duplicates.perFile[fileName] || 0) * 100) / 100;
      perFile[fileName] = { classes: classes.length, methods, dup, ...x, total: dup + keys.reduce((a, k) => a + x[k], 0) };
    }
    const totalCost = duplicates.totalDuplicateCost + keys.reduce((a, k) => a + totals[k], 0);
    return { totalCost, duplicates, totals, perFile, totalMethods, classCount: all.length, parsed, all, warnings: [...new Set(out.warnings)] };
  }
  // ===================== end of analysis core =====================

  function teachingFeedback(parsed, coreWarnings) {
    const warnings = [], info = []; let interfaces = 0, abstracts = 0, inheritanceLinks = 0, implementLinks = 0;
    for (const [file, classes] of Object.entries(parsed)) for (const cls of classes) {
      if (cls.kind === 'interface') { interfaces++; info.push(`${file}: interface ${cls.name}`); }
      if (/\babstract\b/.test(cls.body) || /\babstract\s+class\b/.test(stripJavaCommentsAndStrings(filesState[file]))) { abstracts++; }
      if (cls.parent) { inheritanceLinks++; info.push(`${cls.name} extends ${cls.parent}`); }
      const impl = cls.tail.match(/\bimplements\s+([^\{]+)/); if (impl) { const names = impl[1].split(',').map(x => x.trim()).filter(Boolean); implementLinks += names.length; names.forEach(n => info.push(`${cls.name} implements ${n}`)); }
      for (const m of cls.methods) {
        const setter = m.name.match(/^set([A-Z].*)/); if (setter) {
          const simple = /^\s*(?:this\.)?[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\s*;?\s*$/.test(m.body.trim());
          if (simple) warnings.push(`${cls.name}.${m.name}(): simple setter; check validation.`);
        }
        if (m.name === 'equals' && m.paramCount === 1 && !cls.methods.some(x => x.name === 'hashCode' && x.paramCount === 0)) warnings.push(`${cls.name}: equals(...) is overridden but hashCode() was not detected.`);
      }
      const srcText = filesState[file];
      const objectEq = /\b([A-Za-z_$][\w$]*)\s*==\s*([A-Za-z_$][\w$]*)\b/g; let q;
      while ((q = objectEq.exec(srcText)) !== null) { if (!/^(?:true|false|null)$/.test(q[1]) && !/^(?:true|false|null)$/.test(q[2])) warnings.push(`${file}: '${q[1]} == ${q[2]}' may compare object references.`); }
    }
    if (abstracts) info.push(`${abstracts} abstract class(es)`);
    if (!interfaces && !abstracts && !inheritanceLinks && !implementLinks) info.push('No OOP relationships detected.');
    return { warnings: [...new Set([...coreWarnings, ...warnings])], info: [...new Set(info)] };
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderFeedback(f) {
    const w = document.getElementById('warning-list'), i = document.getElementById('info-list');
    w.innerHTML = f.warnings.length ? f.warnings.map(x => `<div class="feedback-item warning">${escapeHtml(x)}</div>`).join('') : '<div class="feedback-item ok">None</div>';
    i.innerHTML = f.info.length ? f.info.map(x => `<div class="feedback-item info">${escapeHtml(x)}</div>`).join('') : '<div class="feedback-item info">None</div>';
  }

  function runAnalysis() {
    filesState[activeFile] = codeEl.value;
    const limitC = parseInt(document.getElementById('complexityLimit').value, 10) || 10, limitS = parseInt(document.getElementById('sizeLimit').value, 10) || 30, minTokens = parseInt(document.getElementById('duplicateTokens').value, 10) || 50;
    const cpp = isHW4() ? HW4Cost.analyze(filesState, { complexityLimit: limitC, sizeLimit: limitS, minTokens }) : null;
    const r = cpp ? cpp.core : analyzeFiles(filesState, limitC, limitS, minTokens);
    const feedback = cpp ? { warnings: cpp.core.warnings, info: cpp.core.info } : teachingFeedback(r.parsed, r.warnings);
    const hw = isHW3() ? HW3Cost.analyze(filesState) : null;
    document.getElementById('hw4-results').hidden = !cpp;
    document.getElementById('hw4-details').hidden = !cpp;
    if (cpp) {
      document.getElementById('hw4-core-subtotal').textContent = r.totalCost;
      document.getElementById('memory-cost').textContent = cpp.totals.memory;
      document.getElementById('cpp-exceptions-cost').textContent = cpp.totals.exceptions;
      document.getElementById('practices-cost').textContent = cpp.totals.practices;
      document.getElementById('hw4-scope').textContent = !cpp.section ? 'No Section 2 class names detected (Timestamp, Vehicle, Car, CompactCar, Motorcycle, Receipt, ParkingLot). Cost is diagnostic only.' : cpp.missing.length ? 'Incomplete Section 2 source set: missing ' + cpp.missing.join(', ') + '. Cost is diagnostic only.' : 'All Section 2 classes detected. Run functional and memory tests separately. Added cost: ' + cpp.totalCost + '.';
      document.getElementById('hw4-findings').innerHTML = cpp.findings.length ? cpp.findings.map(x => `<div class="feedback-item warning">${escapeHtml(x.file)}:${x.line} · ${x.rule} +${x.cost} · ${escapeHtml(x.message)}</div>`).join('') : '<div class="feedback-item ok">No additional cost patterns detected.</div>';
      document.getElementById('hw4-reviews').innerHTML = cpp.reviews.map(x => `<div class="feedback-item info">Review (0 cost): ${escapeHtml(x.file + ':' + x.line + ' · ' + x.message)}</div>`).join('');
      document.getElementById('hw4-table').innerHTML = Object.entries(cpp.perFile).map(([f, x]) => `<tr><td>${escapeHtml(f)}</td><td>${x.memory}</td><td>${x.exceptions}</td><td>${x.practices}</td><td>${x.total}</td><td>${r.perFile[f].total + x.total}</td></tr>`).join('');
    }
    document.getElementById('hw3-results').hidden = !hw;
    document.getElementById('hw3-details').hidden = !hw;
    if (hw) {
      document.getElementById('legacy-subtotal').textContent = r.totalCost;
      for(const key of ['collections','exceptions','io']) document.getElementById(key+'-cost').textContent=hw.totals[key];
      document.getElementById('hw3-scope').textContent = hw.missing.length ? 'Incomplete source set: missing '+hw.missing.join(', ')+'. Cost is diagnostic only.' : 'Required type names detected. Run functional tests separately. Added cost: '+hw.totalCost+'.';
      document.getElementById('hw3-findings').innerHTML=hw.findings.length ? hw.findings.map(x=>`<div class="feedback-item warning">${escapeHtml(x.file)}:${x.line} · ${x.rule} +${x.cost} · ${escapeHtml(x.message)}</div>`).join('') : '<div class="feedback-item ok">No additional cost patterns detected.</div>';
      const notes=hw.reviews.map(x=>`${x.file}:${x.line} · ${x.message}`);
      if(hw.roleReview.length) notes.push('Collection roles not detected: '+hw.roleReview.join(', ')+'. Inspect manually; no automatic cost.');
      document.getElementById('hw3-reviews').innerHTML=notes.map(x=>`<div class="feedback-item info">Review (0 cost): ${escapeHtml(x)}</div>`).join('');
      document.getElementById('hw3-table').innerHTML=Object.entries(hw.perFile).map(([f,x])=>`<tr><td>${escapeHtml(f)}</td><td>${x.collections}</td><td>${x.exceptions}</td><td>${x.io}</td><td>${x.total}</td><td>${r.perFile[f].total+x.total}</td></tr>`).join('');
    }
    let rows = '';
    for (const [fileName, x] of Object.entries(r.perFile)) {
      rows += `<tr><td>${escapeHtml(fileName)}</td><td>${x.classes}</td><td>${x.methods}</td><td>${x.dup}</td><td>${x.complexity}</td><td>${x.size}</td><td>${x.encapsulation}</td><td>${x.reuse}</td><td>${x.hiding}</td><td>${x.override}</td><td>${x.polymorphism}</td><td><strong>${x.total}</strong></td></tr>`;
    }
    const totalCost = r.totalCost + (hw ? hw.totalCost : 0) + (cpp ? cpp.totalCost : 0); lastTotalCost = totalCost; saveBaselineBtn.disabled = false; updateBaselineUI();
    document.getElementById('score').textContent = totalCost; document.getElementById('dup-cost').textContent = r.duplicates.totalDuplicateCost; document.getElementById('complexity-cost').textContent = r.totals.complexity; document.getElementById('size-cost').textContent = r.totals.size; document.getElementById('encapsulation-cost').textContent = r.totals.encapsulation; document.getElementById('inheritance-reuse-cost').textContent = r.totals.reuse; document.getElementById('field-hiding-cost').textContent = r.totals.hiding; document.getElementById('override-cost').textContent = r.totals.override; document.getElementById('polymorphism-cost').textContent = r.totals.polymorphism;
    document.getElementById('stat-files').textContent = Object.keys(filesState).length; document.getElementById('stat-methods').textContent = r.totalMethods; document.getElementById('stat-duplicates').textContent = r.duplicates.duplicateGroups; document.getElementById('result-status').textContent = 'Analyzed'; document.getElementById('result-status').className = 'status-label current';
    document.getElementById('method-table').innerHTML = rows; document.getElementById('method-count').textContent = `${Object.keys(filesState).length} files · ${r.classCount} classes · ${r.totalMethods} methods`; renderFeedback(feedback);
  }

  analyzeBtn.addEventListener('click', runAnalysis);

  // Initialize
  renderTabs();
  updateLines();
  runAnalysis();
});
