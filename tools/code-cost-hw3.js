/* HW3 v1.0.0: independent, conservative lexical checks. No legacy core changes.
 * Not a Java compiler or a proof of correctness. Unknown flows produce review notes.
 * The same API is usable from Node and from an offline browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HW3Cost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'hw3-1.0.0';
  const REQUIRED = ['Student','Workshop','RegistrationSystem','RegistrationStorage','RegistrationException','DataFormatException','RegistrationStatus','RegistrationError','FormatError'];
  const COLLECTIONS = new Set(('Collection List ArrayList LinkedList Vector Stack Set HashSet LinkedHashSet TreeSet SortedSet NavigableSet Queue Deque ArrayDeque PriorityQueue Map HashMap LinkedHashMap TreeMap SortedMap NavigableMap Hashtable ConcurrentMap ConcurrentHashMap CopyOnWriteArrayList CopyOnWriteArraySet').split(' '));
  const MUTATORS = new Set('put putAll putIfAbsent add addAll addFirst addLast offer offerFirst offerLast remove removeFirst removeLast poll pollFirst pollLast clear compute computeIfAbsent computeIfPresent merge replace replaceAll push pop retainAll removeAll'.split(' '));
  const QUERIES = new Set('getStudents getWorkshops getEnrolledStudents getWaitingStudents getStudentWorkshops search'.split(' '));
  const ident = s => /^[A-Za-z_$][\w$]*$/.test(s || '');
  function lex(src) {
    const tokens = []; let i=0,line=1;
    while(i<src.length) {
      const c=src[i];
      if (/\s/.test(c)) { if(c==='\n')line++; i++; continue; }
      if(src.startsWith('//',i)){while(i<src.length&&src[i]!=='\n')i++;continue;}
      if(src.startsWith('/*',i)){i+=2;while(i<src.length&&!src.startsWith('*/',i)){if(src[i++]==='\n')line++;}i+=2;continue;}
      const start=i,ln=line;
      if(c==='"'||c==="'") {i++;while(i<src.length){const x=src[i++];if(x==='\n')line++;if(x==='\\'){if(src[i]==='\n')line++;i++;}else if(x===c)break;}tokens.push({v:'LITERAL',raw:src.slice(start,i),start,line:ln});continue;}
      const m=src.slice(i).match(/^[A-Za-z_$][\w$]*|^\d+(?:[\w.]*)/);
      if(m){i+=m[0].length;tokens.push({v:m[0],start,line:ln});continue;}
      tokens.push({v:c,start:i++,line:ln});
    }
    return tokens;
  }
  function pairs(t) {
    const p=new Map(),st=[];const close={')':'(',']':'[','}':'{'};
    for(let i=0;i<t.length;i++){const v=t[i].v;if('([{'.includes(v))st.push(i);else if(close[v]){const a=st.pop();if(a!==undefined&&t[a].v===close[v]){p.set(a,i);p.set(i,a);}}}return p;
  }
  const join = a => a.map(x=>x.v).join(' ');
  function split(t,delimiter=',') {
    const out=[];let start=0,d=0;
    for(let i=0;i<t.length;i++){if(['(','[','{','<'].includes(t[i].v))d++;if([')',']','}','>'].includes(t[i].v))d--;if(t[i].v===delimiter&&d===0){out.push(t.slice(start,i));start=i+1;}}
    out.push(t.slice(start));return out;
  }
  function classes(t,p) {
    const cs=[];
    for(let i=0;i<t.length;i++)if(['class','interface','enum'].includes(t[i].v)&&ident(t[i+1]?.v)&&t[i-1]?.v!=='.'){
      let o=i+2;while(o<t.length&&!['{',';'].includes(t[o].v))o++;
      if(t[o]?.v!=='{'||!p.has(o))continue;
      const c={name:t[i+1].v,open:o,close:p.get(o),fields:[],methods:[]};cs.push(c);
      let start=o+1,j=start;
      while(j<c.close){
        if(t[j].v==='('){j=(p.get(j)??j)+1;continue;}
        if(t[j].v==='{'){
          const d=t.slice(start,j),eq=d.some(x=>x.v==='='),nested=d.some(x=>['class','interface','enum'].includes(x.v));
          const par=d.findIndex(x=>x.v==='(');
          if(!eq&&!nested&&par>0){c.methods.push({name:d[par-1].v,decl:d,open:j,close:p.get(j)??j,body:t.slice(j+1,p.get(j)),public:d.some(x=>x.v==='public')});}
          j=(p.get(j)??j)+1;if(!eq)start=j;continue;
        }
        if(t[j].v===';'){
          const d=t.slice(start,j);const eq=d.findIndex(x=>x.v==='=');const left=eq<0?d:d.slice(0,eq);
          if(!left.some(x=>x.v==='(')){
            const ids=left.filter(x=>ident(x.v));const name=ids.at(-1)?.v;
            if(name)c.fields.push({name,decl:d,collection:left.some(x=>COLLECTIONS.has(x.v)),static:left.some(x=>x.v==='static'),at:d[0]});
          }start=j+1;
        }j++;
      }
    }return cs;
  }
  function analyze(files) {
    const totals={collections:0,exceptions:0,io:0},findings=[],reviews=[],perFile={};const present=new Set(),roles=new Set();
    for(const [file,src] of Object.entries(files)) {
      const t=lex(src),p=pairs(t),cs=classes(t,p),v=t.map(x=>x.v);cs.forEach(c=>present.add(c.name));
      const shadowedTypes=new Set(cs.filter(c=>COLLECTIONS.has(c.name)).map(c=>c.name));
      const pf={collections:0,exceptions:0,io:0,total:0};perFile[file]=pf;
      const seen=new Set();
      function add(rule,category,cost,token,message){const key=rule+':'+token.start;if(seen.has(key))return;seen.add(key);findings.push({file,line:token.line,rule,category,cost,message});totals[category]+=cost;pf[category]+=cost;pf.total+=cost;}
      function review(token,message){reviews.push({file,line:token?.line||1,message});}
      if(!/\bpackage\s+workshop\s*;/.test(join(t))) review(t[0],'Expected package workshop; check the submission scope.');
      if(v.includes('UnsupportedOperationException'))review(t[v.indexOf('UnsupportedOperationException')],'UnsupportedOperationException found: complete the skeleton before using cost for grading.');
      // Generic declarations, including parameters, locals, fields and nested type arguments.
      // Imports, class literals, instanceof and method calls do not count as declarations.
      const rawStatements=new Set();
      for(let i=0;i<t.length;i++)if(COLLECTIONS.has(v[i])){
        let j=i+1,depth=0;
        if(v[j]==='<'){do {if(v[j]==='<')depth++;if(v[j]==='>')depth--;j++;}while(j<t.length&&depth>0);}
        const declaration=ident(v[j])&&['=',';',',',')',':','['].includes(v[j+1]);
        if(!declaration)continue;
        if(shadowedTypes.has(v[i])){review(t[i],'Custom type shadows a JDK collection name; inspect its contract manually.');continue;}
        roles.add(/Map$/.test(v[i])?'Map':/Set$/.test(v[i])?'Set':/Deque$|Queue$/.test(v[i])?'Queue/Deque':'List');
        const rawType=t.slice(i,j).some((x,k,a)=>COLLECTIONS.has(x.v)&&a[k+1]?.v!=='<');
        let end=j;while(end<t.length&&![';','{','}'].includes(v[end]))end++;
        const rawCtor=t.slice(j+1,end).some((x,k,a)=>x.v==='new'&&COLLECTIONS.has(a[k+1]?.v)&&a[k+2]?.v==='(');
        if(rawType||rawCtor){const key=t[j].start;if(!rawStatements.has(key)){rawStatements.add(key);add('C1','collections',1,t[i],'Raw collection declaration or raw constructor; supply generic type arguments.');}}
      }
      for(const c of cs){
        for(const f of c.fields.filter(x=>x.collection&&x.static)){
          const d=join(f.decl);const mutable=/\bnew\s+(?:java\s*\.\s*util\s*\.\s*)?(?:HashMap|TreeMap|LinkedHashMap|ArrayList|LinkedList|HashSet|TreeSet|LinkedHashSet|ArrayDeque|PriorityQueue|Vector|Stack|Hashtable|ConcurrentHashMap)\b/.test(d);
          const writes=t.some((x,i)=>x.v===f.name&&v[i+1]==='.'&&MUTATORS.has(v[i+2])&&v[i+3]==='(');
          const immutable=/\b(?:List|Set|Map)\s*\.\s*(?:of|copyOf)\s*\(|\bCollections\s*\.\s*(?:empty\w*|singleton\w*|unmodifiable\w*)\s*\(/.test(d);
          if(writes||(mutable&&!immutable))add('C3','collections',2,f.at,'Static mutable collection is shared across instances; use instance-owned state.');
          else if(!immutable)review(f.at,'Check whether this static collection holds shared mutable registration state.');
        }
        for(const m of c.methods.filter(x=>x.public&&c.name==='RegistrationSystem'&&QUERIES.has(x.name))){
          const body=m.body,vs=body.map(x=>x.v);let flagged=false;
          for(let i=0;i<body.length;i++)if(vs[i]==='return'){
            let end=i+1;while(end<body.length&&vs[end]!==';')end++;const expr=body.slice(i+1,end),e=join(expr);
            const unmodifiable=/^(?:(?:java\s*\.\s*util\s*\.\s*)?(?:Collections\s*\.\s*(?:unmodifiable\w*|empty\w*|singleton\w*)|List\s*\.\s*(?:of|copyOf)|Arrays\s*\.\s*asList))\s*\(/.test(e);
            const first=expr[0]?.v==='this'?expr[2]?.v:expr[0]?.v;
            const field=c.fields.find(f=>f.collection&&f.name===first);
            const shadow=m.decl.some((x,k)=>x.v===first&&k>m.decl.findIndex(q=>q.v==='('))||body.some((x,k)=>x.v===first&&(ident(body[k-1]?.v)||['>',']'].includes(body[k-1]?.v))&&body[k-1].v!=='return'&&['=', ';',',',':'].includes(body[k+1]?.v));
            const direct=field&&(!shadow||expr[0]?.v==='this')&&(/^(?:this\s*\.\s*)?[\w$]+(?:\s*\.\s*(?:get|values|keySet|entrySet|subList)\s*\([^;]*\))*$/.test(e));
            if((unmodifiable||direct)&&!flagged){add('C2','collections',2,body[i],'Query must return a fresh mutable snapshot, not internal state, a live view or an unmodifiable/fixed-size list.');flagged=true;}
            else if(!direct&&!unmodifiable&&!/^new\s+(?:java\s*\.\s*util\s*\.\s*)?(?:ArrayList|LinkedList|Vector)\b/.test(e)&&/\(/.test(e))review(body[i],'Query delegates result creation; verify freshness and mutability with runtime tests.');
          }
        }
      }
      // Catch rules: at most one cost per catch; specific useful translations are allowed.
      for(let i=0;i<t.length;i++)if(v[i]==='catch'&&v[i+1]==='('&&p.has(i+1)){
        const end=p.get(i+1),open=end+1,close=p.get(open);if(close===undefined)continue;
        const decl=t.slice(i+2,end),body=t.slice(open+1,close),s=join(body);
        const broad=decl.some(x=>['Exception','Throwable'].includes(x.v));
        const io=decl.some(x=>/^(?:IOException|FileNotFoundException|UncheckedIOException|MalformedInputException|CharacterCodingException)$/.test(x.v));
        const swallowed=!body.length||/^(?:System\s*\.\s*(?:out|err)\s*\.\s*print(?:ln|f)?\s*\([^;]*\)\s*;|[\w$]+\s*\.\s*printStackTrace\s*\([^;]*\)\s*;)+$/.test(s);
        const wrong=io&&/\bthrow\s+new\s+(?:[\w$]+\s*\.\s*)*DataFormatException\b/.test(s);
        const parseRecovery=decl.some(x=>['NumberFormatException','IllegalArgumentException'].includes(x.v))&&!broad&&!io;
        const deferredThrow=v[close+1]==='throw';
        if(swallowed&&(parseRecovery||deferredThrow))review(t[i],'Parsing recovery or a later throw may report the failure; verify the caller contract.');
        else if(swallowed||wrong)add('E2','exceptions',3,t[i],wrong?'I/O failure is converted into a format error; preserve IOException.':'Catch suppresses the failure (empty or print-only body).');
        else if(broad)add('E1','exceptions',2,t[i],'Catch a specific exception instead of Exception/Throwable.');
        else if(!/\bthrow\b/.test(s))review(t[i],'Catch delegates or recovers; verify that required failures reach the caller.');
      }
      // Resource ownership: conservative local analysis, without inventing interprocedural guarantees.
      const managed=[];for(let i=0;i<t.length;i++)if(v[i]==='try'&&v[i+1]==='('&&p.has(i+1))managed.push([i+1,p.get(i+1)]);
      const resources=new Set('FileReader FileWriter FileInputStream FileOutputStream RandomAccessFile'.split(' '));
      for(let i=0;i<t.length;i++){
        const ctor=v[i]==='new'&&resources.has(v[i+1])&&v[i+2]==='(';
        const factory=v[i]==='Files'&&v[i+1]==='.'&&['newBufferedReader','newBufferedWriter','newInputStream','newOutputStream','lines','list','walk','find'].includes(v[i+2])&&v[i+3]==='(';
        if(!ctor&&!factory)continue;
        if(managed.some(([a,b])=>i>a&&i<b))continue;
        const m=cs.flatMap(c=>c.methods).filter(m=>m.open<i&&m.close>i).sort((a,b)=>(a.close-a.open)-(b.close-b.open))[0];
        if(!m){review(t[i],'Resource opened outside an analyzed method; verify ownership and closure.');continue;}
        let at=i-1;while(at>m.open&&![';','{','}'].includes(v[at])&&v[at]!=='=')at--;
        const name=v[at]==='='&&ident(v[at-1])?v[at-1]:null;
        const body=join(t.slice(m.open+1,m.close));
        const passed=name&&new RegExp('\\b(?:return\\s+'+name+'\\b|[\\w$]+\\s*\\(\\s*'+name+'\\s*[,\\)])').test(body);
        const anyClose=/\.\s*close\s*\(/.test(body);
        const finallyClose=name&&t.some((x,k)=>k>m.open&&k<m.close&&x.v==='finally'&&v[k+1]==='{'&&new RegExp('\\b'+name+'\\s*\\.\\s*close\\s*\\(').test(join(t.slice(k+2,p.get(k+1)))));
        if(finallyClose)review(t[i],'Finally-based closure detected; verify all failure paths (no automatic cost).');
        else if(passed||anyClose||!name)review(t[i],'Resource closure/ownership needs review (helper, wrapper or non-trivial flow).');
        else add('I1','io',2,t[i],'Locally opened resource has no detected closure or ownership transfer; use try-with-resources.');
      }
      // Default charset APIs; Files reader/writer/readString/writeString defaults are UTF-8.
      for(let i=0;i<t.length;i++)if(v[i]==='new'){
        let n=i+1;while(v[n+1]==='.')n+=2;
        const type=v[n],op=n+1;if(v[op]!=='('||!p.has(op))continue;
        const args=split(t.slice(op+1,p.get(op)));const argc=args[0]?.length?args.length:0;
        let bad=(['InputStreamReader','OutputStreamWriter'].includes(type)&&argc===1);
        if(['FileReader','FileWriter','PrintWriter','PrintStream'].includes(type)){
          if(argc===1)bad=true;
          if(argc===2&&['true','false'].includes(args[1]?.[0]?.v))bad=true;
          if(argc===2&&ident(args[1]?.[0]?.v)&&args[1].length===1)review(t[i],'Verify whether the second constructor argument is a charset or an append/autoflush flag.');
          // PrintWriter/PrintStream over an existing Writer/stream may have external encoding ownership.
          if(['PrintWriter','PrintStream'].includes(type)&&argc===1){bad=false;review(t[i],'Check encoding ownership and I/O error propagation for PrintWriter/PrintStream.');}
        }
        if(bad)add('I2','io',1,t[i],'This constructor relies on the platform default charset; specify UTF-8.');
        if(type==='String'&&argc===1){const name=args[0][0]?.v;if(new RegExp('\\bbyte\\s*\\[\\s*\\]\\s*'+name+'\\b').test(join(t)))add('I2','io',1,t[i],'Decoding a byte array without a charset uses the platform default.');}
      }
      for(let i=0;i<t.length;i++)if(v[i]==='getBytes'&&v[i+1]==='('&&v[i+2]===')') {
        const receiver=v[i-2];
        const known=receiver==='LITERAL'&&t[i-2].raw?.startsWith('\"')||ident(receiver)&&t.some((x,k)=>x.v==='String'&&v[k+1]===receiver);
        if(known&&!cs.some(c=>c.name==='String'))add('I2','io',1,t[i],'String.getBytes() without a charset uses the platform default; specify UTF-8.');
        else review(t[i],'If this receiver is a String, getBytes() needs an explicit UTF-8 charset.');
      }
    }
    const missing=REQUIRED.filter(n=>!present.has(n));
    return {version:VERSION,totals,totalCost:Object.values(totals).reduce((a,b)=>a+b,0),perFile,findings,reviews,missing,roles:[...roles],roleReview:['Map','Set','List','Queue/Deque'].filter(r=>!roles.has(r)),scopeValid:missing.length===0};
  }
  return {VERSION,REQUIRED,analyze,lex};
});
