/* The actual filtering: drop excluded branches, then apply clean-up rules.

   excluded — Set of dot paths, e.g. "report.systemLoad"
   options  — { dropNull, dropArr, dropZero, dropEmpty, round }
              round is -1 when rounding is off, otherwise the digit count. */

export function isEmptyObject(v){
  return v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;
}

/* Should this value be left out after its own children were processed? */
export function isJunk(v, o){
  if(v === null) return !!o.dropNull;
  if(Array.isArray(v)) return !!o.dropArr && v.length === 0;
  if(typeof v === "object") return !!o.dropEmpty && Object.keys(v).length === 0;
  if(o.dropZero) return v === 0 || v === false || v === "";
  return false;
}

export function pruneValue(value, path, excluded, o){
  if(Array.isArray(value)){
    const arr = [];
    for(let i = 0; i < value.length; i++){
      const item = pruneValue(value[i], path, excluded, o);
      if(isJunk(item, o)) continue;
      arr.push(item);
    }
    return arr;
  }

  if(value && typeof value === "object"){
    const out = {};
    const keys = Object.keys(value);
    for(let k = 0; k < keys.length; k++){
      const key = keys[k];
      const childPath = path ? path + "." + key : key;
      if(excluded.has(childPath)) continue;
      const res = pruneValue(value[key], childPath, excluded, o);
      if(isJunk(res, o)) continue;
      out[key] = res;
    }
    return out;
  }

  if(o.round >= 0 && typeof value === "number" && !Number.isInteger(value)){
    return Number(value.toFixed(o.round));
  }
  return value;
}

export function pruneAll(records, excluded, o){
  const out = [];
  for(let i = 0; i < records.length; i++){
    out.push(pruneValue(records[i], "", excluded, o));
  }
  return out;
}
