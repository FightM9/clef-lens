/* Single shared state object plus a tiny event bus.
   UI modules mutate state and emit("refresh"); main.js owns the redraw. */

export const state = {
  // --- source data ---
  records: [],          // parsed events, in file order
  fileName: "events",
  beforeBytes: 0,

  // --- events tab ---
  activeTab: "events",
  eventQuery: "",       // query language text
  queryError: null,     // message shown under the query bar
  view: [],             // indices into records, in display order
  timeField: null,      // detected timestamp key
  withDates: false,     // events span more than one day
  order: "desc",        // "desc" = newest first
  openEvents: new Set(),
  eventLimit: 200,      // rows rendered before "show more"

  // --- record tab ---
  recordCursor: 0,      // position within view
  recordFiltered: false,// show the record as it will be exported

  // --- export tab ---
  root: null,           // merged field tree
  allPaths: new Set(),
  excluded: new Set(),  // paths the user removed
  expanded: new Set(),  // open tree nodes
  treeQuery: "",        // field search
  format: "ndjson",     // "ndjson" | "array"
  onlyMatching: false,  // export just the queried events
  outText: "",

  theme: "auto",        // "auto" | "light" | "dark"

  db: { presets: [], lastId: null, lang: null, theme: null }
};

const handlers = {};

export function on(event, fn){
  if(!handlers[event]) handlers[event] = [];
  handlers[event].push(fn);
}

export function emit(event, payload){
  (handlers[event] || []).forEach(function(fn){ fn(payload); });
}
