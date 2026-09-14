/* Turns raw file text into an array of records.
   Accepts NDJSON (one JSON object per line) and plain JSON arrays/objects. */

export class ParseError extends Error {
  constructor(key){ super(key); this.key = key; }
}

export function parseText(text){
  text = text.replace(/^\uFEFF/, "").trim();
  if(!text) throw new ParseError("err.empty");

  // A whole-file array or a single-line object: try JSON.parse first.
  if(text[0] === "[" || (text[0] === "{" && text.indexOf("\n") === -1)){
    try{
      const whole = JSON.parse(text);
      return { rows: Array.isArray(whole) ? whole : [whole], bad: 0 };
    }catch(e){ /* fall through to line-by-line */ }
  }

  const rows = [];
  let bad = 0;
  const lines = text.split(/\r?\n/);
  for(let i = 0; i < lines.length; i++){
    let s = lines[i].trim();
    if(!s || s === "[" || s === "]") continue;
    if(s.charAt(s.length - 1) === ",") s = s.slice(0, -1);
    try{ rows.push(JSON.parse(s)); }catch(e){ bad++; }
  }
  if(!rows.length) throw new ParseError("err.nojson");
  return { rows: rows, bad: bad };
}
