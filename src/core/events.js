/* Turning records into a chronological event list:
   timestamp detection, level, message rendering, ordering and filtering. */
import { getLang } from "../i18n/index.js";
import { compileQuery } from "./query.js";

/* "@t" is the CLEF timestamp and always wins; the rest are fallbacks. */
const TIME_PRIORITY = { "@t": 50, "_timestamp": 14, "timestamp": 14, "_date": 8, "date": 8, "time": 8 };
const TIME_PATTERN = /(^|_)(t|ts|at|time|timestamp|date)$/i;

export function parseTime(value){
  if(value == null) return null;
  if(typeof value === "number"){
    // Heuristic: anything below ~1e11 is seconds, above is milliseconds.
    const ms = value < 100000000000 ? value * 1000 : value;
    return isFinite(ms) ? ms : null;
  }
  if(typeof value === "string"){
    const ms = Date.parse(value);
    return isNaN(ms) ? null : ms;
  }
  return null;
}

/* Every top-level field whose values parse as a date, best guess first. */
export function timeFieldCandidates(records){
  if(!records.length) return [];
  const sample = records.slice(0, 20);
  const scores = {};

  sample.forEach(function(record){
    if(!record || typeof record !== "object") return;
    Object.keys(record).forEach(function(key){
      if(parseTime(record[key]) === null) return;
      let score = 1;
      if(TIME_PRIORITY[key]) score += TIME_PRIORITY[key];
      if(TIME_PATTERN.test(key)) score += 3;
      if(typeof record[key] === "string") score += 1;
      scores[key] = (scores[key] || 0) + score;
    });
  });

  return Object.keys(scores).sort(function(a, b){ return scores[b] - scores[a]; });
}

export function detectTimeField(records){
  return timeFieldCandidates(records)[0] || null;
}

export function recordTime(record, field){
  if(!field || !record) return null;
  return parseTime(record[field]);
}

export function formatEventTime(ms, withDate){
  if(ms == null) return "—";
  const date = new Date(ms);
  const time = new Intl.DateTimeFormat(getLang(), {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
  if(!withDate) return time;
  const day = new Intl.DateTimeFormat(getLang(), { day: "2-digit", month: "short" }).format(date);
  return day + " " + time;
}

const LEVEL_MAP = {
  v: "verbose", vrb: "verbose", verbose: "verbose", trace: "verbose",
  d: "debug", dbg: "debug", debug: "debug",
  i: "info", inf: "info", info: "info", information: "info",
  w: "warn", wrn: "warn", warn: "warn", warning: "warn",
  e: "error", err: "error", error: "error",
  f: "fatal", ftl: "fatal", fatal: "fatal", critical: "fatal"
};

export function recordLevel(record){
  const raw = record && (record["@l"] || record.level || record.Level);
  if(!raw) return "info";
  return LEVEL_MAP[String(raw).toLowerCase()] || "info";
}

/* CLEF message templates: "{Total} of {Max}" with property substitution.
   Prefers an already-rendered @m, falls back to a couple of scalar fields. */
export function renderMessage(record){
  if(!record || typeof record !== "object") return String(record);
  if(typeof record["@m"] === "string") return record["@m"];

  const template = record["@mt"] || record.message || record.Message;
  if(typeof template === "string"){
    return template.replace(/\{@?([A-Za-z0-9_.]+)(?::[^}]*)?\}/g, function(match, name){
      const value = record[name] !== undefined ? record[name]
                  : record["_" + name] !== undefined ? record["_" + name]
                  : undefined;
      if(value === undefined) return match;
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    });
  }

  const scalars = Object.keys(record)
    .filter(function(k){
      const v = record[k];
      return k[0] !== "@" && v !== null && typeof v !== "object";
    })
    .slice(0, 4)
    .map(function(k){ return k + "=" + record[k]; });
  return scalars.join("  ") || "{…}";
}

/* Flat list of leaf paths for the expanded event detail. */
export function flattenRecord(record, limit){
  const out = [];
  const max = limit || 400;

  (function walk(value, path){
    if(out.length >= max) return;
    if(Array.isArray(value)){
      if(!value.length){ out.push({ path: path, value: "[]" }); return; }
      value.forEach(function(item, i){ walk(item, path + "[" + i + "]"); });
      return;
    }
    if(value && typeof value === "object"){
      const keys = Object.keys(value);
      if(!keys.length){ out.push({ path: path, value: "{}" }); return; }
      keys.forEach(function(key){ walk(value[key], path ? path + "." + key : key); });
      return;
    }
    out.push({ path: path, value: value === null ? "null" : String(value) });
  })(record, "");

  return out;
}

/* Indices of matching records, in display order.
   Throws QueryError when the text does not compile. */
export function buildView(records, queryText, timeField, order){
  const predicate = compileQuery(queryText);
  const indices = [];

  for(let i = 0; i < records.length; i++){
    if(predicate && !predicate(records[i])) continue;
    indices.push(i);
  }

  if(timeField){
    indices.sort(function(a, b){
      const ta = recordTime(records[a], timeField);
      const tb = recordTime(records[b], timeField);
      if(ta === null && tb === null) return a - b;
      if(ta === null) return 1;
      if(tb === null) return -1;
      return order === "asc" ? ta - tb : tb - ta;
    });
  }else if(order === "desc"){
    indices.reverse();
  }

  return indices;
}

/* True when the events span more than one calendar day, so rows need dates. */
export function spansDays(records, timeField){
  if(!timeField) return false;
  let min = null, max = null;
  for(let i = 0; i < records.length; i++){
    const t = recordTime(records[i], timeField);
    if(t === null) continue;
    if(min === null || t < min) min = t;
    if(max === null || t > max) max = t;
  }
  if(min === null || max === null) return false;
  return new Date(min).toDateString() !== new Date(max).toDateString();
}
