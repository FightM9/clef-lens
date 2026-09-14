/* A small Seq-flavoured query language.

   total < 80 and @l = 'Error'
   report.media.remote.video.maxQuality = '720p'
   email like '%@gmail.com' or not Has(reportId)
   @t >= '2026-09-14T09:00'

   Grammar (loosest binding first):
     or    := and ("or" and)*
     and   := not ("and" not)*
     not   := ("not" | "!") not | cmp
     cmp   := primary (op primary | "like" primary | "in" "[" list "]" | "is" ["not"] "null")?
     prim  := "(" or ")" | literal | Func(args) | dotted.path

   A path always evaluates to a LIST of values: walking through an array
   collects every element, so `remote.video.maxQuality = '720p'` is true when
   any remote participant matches. Comparisons succeed if any pair matches. */

export class QueryError extends Error {
  constructor(message){ super(message); this.name = "QueryError"; }
}

const KEYWORDS = ["and", "or", "not", "like", "in", "is", "null", "true", "false"];
const TWO_CHAR = ["<=", ">=", "<>", "!=", "=="];
const ONE_CHAR = ["=", "<", ">", "(", ")", "[", "]", ","];

export function tokenizeQuery(input){
  const tokens = [];
  let i = 0;
  while(i < input.length){
    const ch = input[i];

    if(/\s/.test(ch)){ i++; continue; }

    if(ch === "'" || ch === '"'){
      const quote = ch;
      let j = i + 1, out = "";
      while(j < input.length && input[j] !== quote){
        if(input[j] === "\\" && j + 1 < input.length){ out += input[j + 1]; j += 2; continue; }
        out += input[j]; j++;
      }
      if(j >= input.length) throw new QueryError("Unclosed string");
      tokens.push({ t: "str", v: out });
      i = j + 1;
      continue;
    }

    if(/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] || ""))){
      let j = i + 1;
      while(j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ t: "num", v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    if(/[A-Za-z_@$]/.test(ch)){
      let j = i;
      while(j < input.length && /[A-Za-z0-9_@$.]/.test(input[j])) j++;
      const word = input.slice(i, j);
      tokens.push(KEYWORDS.indexOf(word.toLowerCase()) !== -1
        ? { t: "kw", v: word.toLowerCase() }
        : { t: "id", v: word });
      i = j;
      continue;
    }

    if(ch === "&" && input[i + 1] === "&"){ tokens.push({ t: "kw", v: "and" }); i += 2; continue; }
    if(ch === "|" && input[i + 1] === "|"){ tokens.push({ t: "kw", v: "or" }); i += 2; continue; }
    if(ch === "!" && input[i + 1] !== "="){ tokens.push({ t: "kw", v: "not" }); i += 1; continue; }

    const two = input.slice(i, i + 2);
    if(TWO_CHAR.indexOf(two) !== -1){ tokens.push({ t: "op", v: two }); i += 2; continue; }
    if(ONE_CHAR.indexOf(ch) !== -1){ tokens.push({ t: ch === "(" || ch === ")" || ch === "[" || ch === "]" || ch === "," ? "punc" : "op", v: ch }); i++; continue; }

    throw new QueryError("Unexpected character: " + ch);
  }
  return tokens;
}

/* A query with no operators and no keywords is treated as plain text search. */
export function isFreeText(tokens){
  return tokens.every(function(tk){ return tk.t === "id" || tk.t === "str" || tk.t === "num"; })
      && !tokens.some(function(tk){ return tk.t === "id" && tk.v.indexOf(".") !== -1; });
}

export function parseQuery(tokens){
  let pos = 0;
  const peek = function(){ return tokens[pos]; };
  const next = function(){ return tokens[pos++]; };
  const isKw = function(word){ const tk = peek(); return tk && tk.t === "kw" && tk.v === word; };
  const isPunc = function(ch){ const tk = peek(); return tk && tk.t === "punc" && tk.v === ch; };
  const expect = function(ch){
    if(!isPunc(ch)) throw new QueryError("Expected " + ch);
    next();
  };

  function parseOr(){
    let left = parseAnd();
    while(isKw("or")){ next(); left = { type: "logical", op: "or", left: left, right: parseAnd() }; }
    return left;
  }
  function parseAnd(){
    let left = parseNot();
    while(isKw("and")){ next(); left = { type: "logical", op: "and", left: left, right: parseNot() }; }
    return left;
  }
  function parseNot(){
    if(isKw("not")){ next(); return { type: "not", expr: parseNot() }; }
    return parseCmp();
  }
  function parseCmp(){
    const left = parsePrimary();
    const tk = peek();
    if(!tk) return left;

    if(tk.t === "op"){
      next();
      return { type: "binary", op: tk.v, left: left, right: parsePrimary() };
    }
    if(tk.t === "kw" && (tk.v === "like" || tk.v === "in" || tk.v === "is")){
      next();
      if(tk.v === "like") return { type: "like", left: left, right: parsePrimary(), negate: false };
      if(tk.v === "is"){
        let negate = false;
        if(isKw("not")){ next(); negate = true; }
        if(!isKw("null")) throw new QueryError("Expected null after is");
        next();
        return { type: "isnull", expr: left, negate: negate };
      }
      expect("[");
      const list = [];
      while(!isPunc("]")){
        list.push(parsePrimary());
        if(isPunc(",")) next();
      }
      expect("]");
      return { type: "in", left: left, list: list };
    }
    return left;
  }
  function parsePrimary(){
    const tk = next();
    if(!tk) throw new QueryError("Unexpected end of query");

    if(tk.t === "punc" && tk.v === "("){
      const inner = parseOr();
      expect(")");
      return inner;
    }
    if(tk.t === "str") return { type: "lit", value: tk.v };
    if(tk.t === "num") return { type: "lit", value: tk.v };
    if(tk.t === "kw" && tk.v === "true") return { type: "lit", value: true };
    if(tk.t === "kw" && tk.v === "false") return { type: "lit", value: false };
    if(tk.t === "kw" && tk.v === "null") return { type: "lit", value: null };
    if(tk.t === "kw" && tk.v === "not") return { type: "not", expr: parseNot() };
    if(tk.t === "id"){
      if(isPunc("(")){
        next();
        const args = [];
        while(!isPunc(")")){
          args.push(parseOr());
          if(isPunc(",")) next();
        }
        expect(")");
        return { type: "call", name: tk.v.toLowerCase(), args: args };
      }
      return { type: "path", path: tk.v };
    }
    throw new QueryError("Unexpected token: " + tk.v);
  }

  const ast = parseOr();
  if(pos < tokens.length) throw new QueryError("Unexpected token: " + tokens[pos].v);
  return ast;
}

/* Walks a dotted path, flattening arrays on the way. Falls back to the
   underscore-prefixed name, so `email` also finds CLEF's `_email`. */
export function resolvePath(record, path){
  const direct = [];
  walk(record, path.split("."), 0, direct);
  if(direct.length || path[0] === "_" || path[0] === "@") return direct;

  const parts = path.split(".");
  parts[0] = "_" + parts[0];
  const prefixed = [];
  walk(record, parts, 0, prefixed);
  return prefixed;

  function walk(value, parts, i, out){
    if(value === undefined) return;
    if(i >= parts.length){ out.push(value); return; }
    if(Array.isArray(value)){
      value.forEach(function(item){ walk(item, parts, i, out); });
      return;
    }
    if(value && typeof value === "object"){ walk(value[parts[i]], parts, i + 1, out); return; }
  }
}

function looseEquals(a, b){
  if(a === null || b === null) return a === b;
  if(typeof a === "number" && typeof b === "string" && b !== "" && !isNaN(Number(b))) return a === Number(b);
  if(typeof b === "number" && typeof a === "string" && a !== "" && !isNaN(Number(a))) return Number(a) === b;
  if(typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function ordered(op, a, b){
  if(a === null || b === null || a === undefined || b === undefined) return false;
  let x = a, y = b;
  if(typeof x === "string" && typeof y === "number" && !isNaN(Number(x))) x = Number(x);
  if(typeof y === "string" && typeof x === "number" && !isNaN(Number(y))) y = Number(y);
  if(typeof x === "object" || typeof y === "object") return false;
  switch(op){
    case "<": return x < y;
    case "<=": return x <= y;
    case ">": return x > y;
    case ">=": return x >= y;
  }
  return false;
}

function likeToRegExp(pattern){
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.split("%").join(".*").split("_").join(".") + "$", "i");
}

/* Every node evaluates to a list of values; booleans are lists of one. */
function evalValues(node, record){
  switch(node.type){
    case "lit": return [node.value];
    case "path": return resolvePath(record, node.path);
    case "call": return [callFunction(node, record)];
    default: return [evalBool(node, record)];
  }
}

function callFunction(node, record){
  const args = node.args.map(function(a){ return evalValues(a, record); });
  const first = args[0] || [];
  const second = args[1] || [];
  const anyPair = function(fn){
    return first.some(function(a){ return second.some(function(b){ return fn(a, b); }); });
  };
  switch(node.name){
    case "has": return first.length > 0 && first.some(function(v){ return v !== undefined && v !== null; });
    case "contains": return anyPair(function(a, b){ return String(a).toLowerCase().indexOf(String(b).toLowerCase()) !== -1; });
    case "startswith": return anyPair(function(a, b){ return String(a).toLowerCase().indexOf(String(b).toLowerCase()) === 0; });
    case "endswith": return anyPair(function(a, b){
      const s = String(a).toLowerCase(), t = String(b).toLowerCase();
      return s.lastIndexOf(t) === s.length - t.length && t.length <= s.length;
    });
    case "length": return first.length ? (first[0] == null ? 0 : (first[0].length != null ? first[0].length : String(first[0]).length)) : 0;
    case "lower": return first.length ? String(first[0]).toLowerCase() : "";
    case "count": return first.length;
    default: throw new QueryError("Unknown function: " + node.name);
  }
}

export function evalBool(node, record){
  switch(node.type){
    case "logical":
      return node.op === "and"
        ? evalBool(node.left, record) && evalBool(node.right, record)
        : evalBool(node.left, record) || evalBool(node.right, record);

    case "not":
      return !evalBool(node.expr, record);

    case "binary": {
      const left = evalValues(node.left, record);
      const right = evalValues(node.right, record);
      if(!left.length || !right.length){
        // Missing field: only "not equal" can still be true.
        return (node.op === "!=" || node.op === "<>") && !!right.length;
      }
      return left.some(function(a){
        return right.some(function(b){
          if(node.op === "=" || node.op === "==") return looseEquals(a, b);
          if(node.op === "!=" || node.op === "<>") return !looseEquals(a, b);
          return ordered(node.op, a, b);
        });
      });
    }

    case "like": {
      const left = evalValues(node.left, record);
      const right = evalValues(node.right, record);
      if(!left.length || !right.length) return false;
      const re = likeToRegExp(right[0]);
      return left.some(function(v){ return re.test(String(v)); });
    }

    case "in": {
      const left = evalValues(node.left, record);
      const options = node.list.reduce(function(acc, item){ return acc.concat(evalValues(item, record)); }, []);
      return left.some(function(a){ return options.some(function(b){ return looseEquals(a, b); }); });
    }

    case "isnull": {
      const values = evalValues(node.expr, record);
      const isNull = !values.length || values.every(function(v){ return v === null || v === undefined; });
      return node.negate ? !isNull : isNull;
    }

    default: {
      const values = evalValues(node, record);
      return values.some(function(v){
        return Array.isArray(v) ? v.length > 0 : !!v;
      });
    }
  }
}

/* Compiles text into a predicate. Returns null for an empty query. */
export function compileQuery(text){
  const trimmed = (text || "").trim();
  if(!trimmed) return null;

  const tokens = tokenizeQuery(trimmed);
  if(!tokens.length) return null;

  if(isFreeText(tokens)){
    const needle = trimmed.replace(/^['"]|['"]$/g, "").toLowerCase();
    return function(record){
      return JSON.stringify(record).toLowerCase().indexOf(needle) !== -1;
    };
  }

  const ast = parseQuery(tokens);
  return function(record){ return evalBool(ast, record); };
}
