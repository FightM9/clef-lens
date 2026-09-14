/* Wiring. Owns the redraw cycle and the file-loading flow;
   every other module stays unaware of the others. */
import { state, on, emit } from "./state.js";
import { setLang, applyI18n, t, DEFAULT_LANG } from "./i18n/index.js";
import { parseText, ParseError } from "./core/parse.js";
import { buildSchema, collectPaths } from "./core/schema.js";
import { pruneAll } from "./core/filter.js";
import { serializeRows, byteLength } from "./core/format.js";
import { QueryError } from "./core/query.js";
import { buildView, detectTimeField, spansDays } from "./core/events.js";
import { loadDb, saveDb, findPreset } from "./store/presets.js";
import { mountDropzone, showParseError, showApp, showDropzone, setFileTag } from "./ui/dropzone.js";
import { mountTabs, setTab } from "./ui/tabs.js";
import { renderEvents, mountEvents } from "./ui/events.js";
import { renderRecord, mountRecord } from "./ui/record.js";
import { renderTree, mountTree } from "./ui/tree.js";
import { mountOptions, readOptions, applyOptionsToDom, renderDeltas, renderScopeLabel, exportRecords } from "./ui/options.js";
import { renderStats } from "./ui/summary.js";
import { renderPresets, renderRecipe, mountPresets } from "./ui/presets.js";
import { mountLang, syncLangButtons } from "./ui/lang.js";
import { mountTheme, applyTheme } from "./ui/theme.js";
import { showToast } from "./ui/toast.js";
import { byId } from "./util/dom.js";

/* Re-runs the query, then repaints. The export text is always recomputed,
   because the stats live on a different tab from the switches that change it. */
function refresh(){
  recomputeView();

  const options = readOptions();
  const rows = pruneAll(exportRecords(), state.excluded, options);
  state.outText = serializeRows(rows, state.format, options.pretty);

  renderEvents();
  renderRecord();
  renderScopeLabel();
  renderTree();
  renderStats();
  renderDeltas();
  renderRecipe();
}

function recomputeView(){
  if(!state.records.length){
    state.view = [];
    state.queryError = null;
    return;
  }
  try{
    state.view = buildView(state.records, state.eventQuery, state.timeField, state.order);
    state.queryError = null;
  }catch(e){
    if(!(e instanceof QueryError)) throw e;
    // Keep the previous result on screen and explain what is wrong.
    state.queryError = e.message;
  }
}

function loadFile(text, name){
  let parsed;
  try{
    parsed = parseText(text);
  }catch(e){
    showParseError(e instanceof ParseError ? e.key : "err.read");
    return;
  }
  showParseError(null);

  state.records = parsed.rows;
  state.fileName = (name || "events").replace(/\.[^.]+$/, "");
  state.beforeBytes = byteLength(text);

  state.timeField = detectTimeField(state.records);
  state.withDates = spansDays(state.records, state.timeField);
  state.openEvents = new Set();
  state.eventLimit = 200;
  state.recordCursor = 0;

  state.root = buildSchema(state.records);
  state.allPaths = collectPaths(state.root, new Set());
  state.expanded = new Set();
  state.root.kids.forEach(function(node){
    if(node.kids.size) state.expanded.add(node.path);
  });
  state.treeQuery = "";
  byId("q").value = "";

  // Re-apply the last preset so a similar export lands ready to go.
  const auto = findPreset(state.db, state.db.lastId);
  state.excluded = auto ? new Set(auto.paths) : new Set();
  if(auto) applyOptionsToDom(auto.opts);

  let tag = t("file.tag", { name: name, n: state.records.length });
  if(parsed.bad) tag += " · " + t("file.bad", { n: parsed.bad });
  setFileTag(tag);

  showApp();
  renderPresets();
  setTab("events");

  if(auto){
    const hit = auto.paths.filter(function(p){ return state.allPaths.has(p); }).length;
    showToast(t("toast.presetApplied", { name: auto.name, hit: hit, total: auto.paths.length }));
  }
}

function onThemeChange(theme){
  state.db.theme = theme;
  saveDb(state.db);
}

function onLangChange(lang){
  state.db.lang = lang;
  saveDb(state.db);
  renderPresets();
  if(state.records.length) refresh();
}

function boot(){
  on("refresh", refresh);
  on("tree", renderTree);
  on("events", renderEvents);

  mountDropzone(loadFile);
  mountTabs();
  mountEvents();
  mountRecord();
  mountTree();
  mountOptions();
  mountPresets();
  mountLang(onLangChange);
  mountTheme(onThemeChange);

  byId("newFile").onclick = function(){
    showDropzone();
    state.records = [];
    state.root = null;
    state.view = [];
  };

  setLang(DEFAULT_LANG);
  syncLangButtons();
  applyTheme("auto");

  loadDb().then(function(db){
    state.db = db;
    if(db.lang){
      setLang(db.lang);
      syncLangButtons();
    }
    if(db.theme) applyTheme(db.theme);
    renderPresets();
  });

  applyI18n();

  // Debug hook: inspect or drive the app from the console, and from tools/smoke-test.js
  window.clefLens = { state: state, refresh: refresh };
}

boot();
