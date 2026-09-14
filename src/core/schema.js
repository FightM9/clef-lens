/* Merges every record into one field tree.
   A node's path ignores array indices, so report.media.remote[3].audio
   and report.media.remote[0].audio are the same node. */

export function makeNode(name, path){
  return {
    name: name, path: path,
    kids: new Map(), kinds: new Set(),
    isArray: false, isObject: false,
    seen: new Set(), samples: [], maxLen: 0
  };
}

export function kindOf(v){
  if(v === null) return "null";
  const t = typeof v;
  if(t === "number") return Number.isInteger(v) ? "int" : "num";
  if(t === "boolean") return "bool";
  if(t === "string") return "str";
  return t;
}

function observeValue(node, value, rec){
  node.seen.add(rec);

  if(Array.isArray(value)){
    node.isArray = true;
    if(value.length > node.maxLen) node.maxLen = value.length;
    for(let i = 0; i < value.length; i++) observeValue(node, value[i], rec);
    return;
  }

  if(value && typeof value === "object"){
    node.isObject = true;
    const keys = Object.keys(value);
    for(let k = 0; k < keys.length; k++){
      const key = keys[k];
      let kid = node.kids.get(key);
      if(!kid){
        kid = makeNode(key, node.path ? node.path + "." + key : key);
        node.kids.set(key, kid);
      }
      observeValue(kid, value[key], rec);
    }
    return;
  }

  node.kinds.add(kindOf(value));
  if(node.samples.length < 2 && value !== null && value !== "") node.samples.push(value);
}

export function buildSchema(rows){
  const root = makeNode("", "");
  for(let i = 0; i < rows.length; i++) observeValue(root, rows[i], i);
  return root;
}

export function collectPaths(node, into){
  node.kids.forEach(function(kid){
    into.add(kid.path);
    collectPaths(kid, into);
  });
  return into;
}

/* "[2]" for arrays, "{7}" for objects, "int|null" for leaves,
   plus "2/3" when the field is missing from some records. */
export function nodeLabel(node, totalRecords){
  const bits = [];
  if(node.isArray) bits.push("[" + node.maxLen + "]");
  else if(node.isObject) bits.push("{" + node.kids.size + "}");
  else {
    const kinds = Array.from(node.kinds);
    if(kinds.length) bits.push(kinds.join("|"));
  }
  if(node.seen.size < totalRecords) bits.push(node.seen.size + "/" + totalRecords);
  return bits.join(" ");
}

export function sampleText(node){
  if(node.isObject || !node.samples.length) return "";
  const s = node.samples.map(function(v){
    return typeof v === "string" ? v : JSON.stringify(v);
  }).join(", ");
  return s.length > 70 ? s.slice(0, 70) + "…" : s;
}
