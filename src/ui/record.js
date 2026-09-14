/* The record tab: one event at a time, raw or as it will be exported. */
import { byId, el, clear } from "../util/dom.js";
import { t } from "../i18n/index.js";
import { formatEventTime, recordTime, recordLevel, renderMessage } from "../core/events.js";
import { pruneValue } from "../core/filter.js";
import { state, emit } from "../state.js";
import { showToast } from "./toast.js";
import { readOptions } from "./options.js";

function currentIndex(){
  if(!state.view.length) return -1;
  if(state.recordCursor >= state.view.length) state.recordCursor = 0;
  return state.view[state.recordCursor];
}

export function renderRecord(){
  const head = byId("recHead");
  const body = byId("pre");
  clear(head);

  const index = currentIndex();
  byId("pos").textContent = state.view.length
    ? t("record.ofFiltered", { pos: state.recordCursor + 1, total: state.view.length })
    : "0 / 0";
  byId("prev").disabled = state.recordCursor <= 0;
  byId("next").disabled = state.recordCursor >= state.view.length - 1;

  if(index < 0){
    body.textContent = t("record.empty");
    return;
  }

  const record = state.records[index];
  head.appendChild(el("span", "ev-time", formatEventTime(recordTime(record, state.timeField), true)));
  head.appendChild(el("span", "ev-level lvl-" + recordLevel(record)));
  head.appendChild(el("span", "ev-msg", renderMessage(record)));

  const shown = state.recordFiltered
    ? pruneValue(record, "", state.excluded, readOptions())
    : record;
  body.textContent = JSON.stringify(shown, null, 2);
}

export function mountRecord(){
  byId("prev").onclick = function(){
    if(state.recordCursor > 0){ state.recordCursor--; emit("refresh"); }
  };
  byId("next").onclick = function(){
    if(state.recordCursor < state.view.length - 1){ state.recordCursor++; emit("refresh"); }
  };
  byId("recFiltered").onchange = function(e){
    state.recordFiltered = e.target.checked;
    emit("refresh");
  };
  byId("recCopy").onclick = function(){
    const done = function(){ showToast(t("toast.copied")); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(byId("pre").textContent).then(done, done);
    }else{
      done();
    }
  };
}
