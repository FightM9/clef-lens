/* Output format, clean-up switches, and the per-switch byte savings.
   Deltas are recomputed on every change, so they are skipped on big files. */
import { byId } from "../util/dom.js";
import { pruneAll } from "../core/filter.js";
import { serializeRows, byteLength, formatSaving } from "../core/format.js";
import { state, emit } from "../state.js";
import { showToast } from "./toast.js";
import { t } from "../i18n/index.js";

const DELTA_LIMIT = 400; // records
const DELTA_IDS = {
  dPretty: "pretty",
  dNull: "dropNull",
  dArr: "dropArr",
  dZero: "dropZero",
  dEmpty: "dropEmpty"
};

/* Which records leave the building: everything, or just the queried ones.
   Export keeps file order even when the events list is sorted newest first. */
export function exportRecords(){
  if(!state.onlyMatching) return state.records;
  return state.view.slice().sort(function(a, b){ return a - b; })
    .map(function(i){ return state.records[i]; });
}

export function readOptions(overrides){
  const o = {
    // NDJSON must stay one record per line, so indentation is an array-only option.
    pretty: byId("optPretty").checked && state.format === "array",
    dropNull: byId("optNull").checked,
    dropArr: byId("optArr").checked,
    dropZero: byId("optZero").checked,
    dropEmpty: byId("optEmpty").checked,
    round: byId("optRound").checked ? parseInt(byId("optDigits").value, 10) : -1
  };
  if(overrides) for(const k in overrides) o[k] = overrides[k];
  return o;
}

export function renderScopeLabel(){
  byId("onlyMatchingLabel").textContent = t("opts.onlyMatching", { n: state.view.length });
  byId("optOnlyMatching").checked = state.onlyMatching;
}

export function syncPrettyAvailability(){
  const arrayMode = state.format === "array";
  byId("optPretty").disabled = !arrayMode;
  byId("optPretty").parentElement.style.opacity = arrayMode ? "" : ".5";
  byId("prettyHint").style.display = arrayMode ? "none" : "";
}

export function applyOptionsToDom(o){
  if(!o) return;
  byId("optPretty").checked = !!o.pretty;
  byId("optNull").checked = !!o.dropNull;
  byId("optArr").checked = !!o.dropArr;
  byId("optZero").checked = !!o.dropZero;
  byId("optEmpty").checked = !!o.dropEmpty;
  byId("optRound").checked = o.round >= 0;
  if(o.round >= 0) byId("optDigits").value = String(o.round);
}

function sizeWith(overrides){
  const o = readOptions(overrides);
  const rows = pruneAll(exportRecords(), state.excluded, o);
  return byteLength(serializeRows(rows, state.format, o.pretty));
}

export function renderDeltas(){
  const ids = Object.keys(DELTA_IDS).concat(["dRound"]);
  const count = exportRecords().length;
  if(count > DELTA_LIMIT || !count){
    ids.forEach(function(id){ byId(id).textContent = ""; });
    return;
  }
  Object.keys(DELTA_IDS).forEach(function(id){
    const key = DELTA_IDS[id];
    const on = {}; on[key] = true;
    const off = {}; off[key] = false;
    // "pretty" costs bytes, the clean-up switches save them.
    const diff = key === "pretty" ? sizeWith(on) - sizeWith(off) : sizeWith(off) - sizeWith(on);
    byId(id).textContent = formatSaving(diff);
  });
  const digits = parseInt(byId("optDigits").value, 10);
  byId("dRound").textContent = formatSaving(sizeWith({ round: -1 }) - sizeWith({ round: digits }));
}

function download(){
  const ext = state.format === "array" ? ".json" : ".ndjson.json";
  const blob = new Blob([state.outText], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = state.fileName + "-filtered" + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  showToast(t("toast.saved"));
}

function copyOut(){
  const done = function(){ showToast(t("toast.copied")); };
  const fallback = function(){
    const ta = document.createElement("textarea");
    ta.value = state.outText;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand("copy"); done(); }
    catch(e){ showToast(t("toast.copyFail")); }
    document.body.removeChild(ta);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(state.outText).then(done, fallback);
  }else{
    fallback();
  }
}

export function mountOptions(){
  const seg = byId("fmt");
  Array.prototype.forEach.call(seg.children, function(btn){
    btn.onclick = function(){
      Array.prototype.forEach.call(seg.children, function(b){ b.classList.remove("on"); });
      btn.classList.add("on");
      state.format = btn.getAttribute("data-v");
      syncPrettyAvailability();
      emit("refresh");
    };
  });

  ["optPretty", "optNull", "optArr", "optZero", "optEmpty", "optRound"].forEach(function(id){
    byId(id).onchange = function(){ emit("refresh"); };
  });
  byId("optDigits").onchange = function(){
    byId("optRound").checked = true;
    emit("refresh");
  };

  byId("optOnlyMatching").onchange = function(e){
    state.onlyMatching = e.target.checked;
    emit("refresh");
  };

  syncPrettyAvailability();
  byId("dl").onclick = download;
  byId("copy").onclick = copyOut;
}
