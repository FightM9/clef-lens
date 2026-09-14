/* The events tab: query bar, chronological list, expandable detail. */
import { byId, el, clear } from "../util/dom.js";
import { t } from "../i18n/index.js";
import { formatEventTime, recordTime, recordLevel, renderMessage, flattenRecord, timeFieldCandidates, spansDays } from "../core/events.js";
import { state, emit } from "../state.js";
import { showToast } from "./toast.js";
import { setTab } from "./tabs.js";

const DETAIL_LIMIT = 400;
let debounce = null;

function openRecord(index){
  const pos = state.view.indexOf(index);
  state.recordCursor = pos < 0 ? 0 : pos;
  setTab("record");
}

function copyRecord(record){
  const text = JSON.stringify(record, null, 2);
  const done = function(){ showToast(t("toast.copied")); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done, done);
  }else{
    done();
  }
}

function detailBlock(record, index){
  const box = el("div", "ev-detail");

  const props = el("table", "ev-props");
  const rows = flattenRecord(record, DETAIL_LIMIT);
  rows.forEach(function(row){
    const tr = el("tr");
    tr.appendChild(el("td", "p", row.path));
    tr.appendChild(el("td", "v", row.value));
    props.appendChild(tr);
  });
  box.appendChild(props);

  if(rows.length >= DETAIL_LIMIT){
    box.appendChild(el("p", "ev-note", t("events.truncated", { n: DETAIL_LIMIT })));
  }

  const actions = el("div", "ev-actions");
  const open = el("button", "btn ghost small", t("events.open"));
  open.onclick = function(e){ e.stopPropagation(); openRecord(index); };
  actions.appendChild(open);

  const copy = el("button", "btn ghost small", t("events.copy"));
  copy.onclick = function(e){ e.stopPropagation(); copyRecord(record); };
  actions.appendChild(copy);

  box.appendChild(actions);
  return box;
}

function eventRow(index){
  const record = state.records[index];
  const wrap = el("div", "ev");
  const isOpen = state.openEvents.has(index);

  const row = el("div", "ev-row" + (isOpen ? " open" : ""));
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");

  row.appendChild(el("span", "ev-time", formatEventTime(recordTime(record, state.timeField), state.withDates)));
  row.appendChild(el("span", "ev-level lvl-" + recordLevel(record)));
  row.appendChild(el("span", "ev-msg", renderMessage(record)));

  const toggle = function(){
    if(state.openEvents.has(index)) state.openEvents.delete(index);
    else state.openEvents.add(index);
    emit("events");
  };
  row.onclick = toggle;
  row.onkeydown = function(e){
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(); }
  };

  wrap.appendChild(row);
  if(isOpen) wrap.appendChild(detailBlock(record, index));
  return wrap;
}

function renderTimeSelect(){
  const select = byId("timeSel");
  const candidates = timeFieldCandidates(state.records);
  clear(select);

  if(!candidates.length){ select.hidden = true; return; }
  select.hidden = false;

  const none = el("option", "", t("events.noTimeField"));
  none.value = "";
  select.appendChild(none);
  candidates.forEach(function(key){
    const option = el("option", "", key);
    option.value = key;
    select.appendChild(option);
  });
  select.value = state.timeField || "";
}

export function renderEvents(){
  renderTimeSelect();
  const host = byId("events");
  clear(host);

  const status = byId("qStatus");
  const total = state.records.length;
  const shown = state.view.length;
  const scope = state.timeField
    ? t("events.timeField", { field: state.timeField })
    : t("events.noTime");
  status.textContent = (shown === total ? t("events.countAll", { total: total })
                                        : t("events.count", { shown: shown, total: total }))
                       + " · " + scope;

  byId("qError").textContent = state.queryError || "";
  byId("qOrder").textContent = state.order === "desc" ? t("events.newestFirst") : t("events.oldestFirst");

  if(!shown){
    host.appendChild(el("div", "nomatch", t("events.none")));
    byId("showMore").hidden = true;
    return;
  }

  const limit = Math.min(state.eventLimit, shown);
  for(let i = 0; i < limit; i++) host.appendChild(eventRow(state.view[i]));

  const rest = shown - limit;
  const more = byId("showMore");
  more.hidden = rest <= 0;
  if(rest > 0){
    more.textContent = t("events.showMore", { n: Math.min(rest, 200) });
    more.onclick = function(){
      state.eventLimit += 200;
      emit("events");
    };
  }
}

function renderHelp(){
  const box = byId("qHelpBox");
  clear(box);
  const lines = t("help.body");
  (Array.isArray(lines) ? lines : [lines]).forEach(function(line){
    box.appendChild(el("p", "", line));
  });
}

export function mountEvents(){
  const input = byId("eq");

  input.oninput = function(e){
    const value = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(function(){
      state.eventQuery = value;
      state.eventLimit = 200;
      emit("refresh");
    }, 160);
  };

  byId("qClear").onclick = function(){
    input.value = "";
    state.eventQuery = "";
    state.eventLimit = 200;
    emit("refresh");
  };

  byId("timeSel").onchange = function(e){
    state.timeField = e.target.value || null;
    state.withDates = spansDays(state.records, state.timeField);
    emit("refresh");
  };

  byId("qOrder").onclick = function(){
    state.order = state.order === "desc" ? "asc" : "desc";
    emit("refresh");
  };

  byId("qHelp").onclick = function(){
    const box = byId("qHelpBox");
    box.hidden = !box.hidden;
    if(!box.hidden) renderHelp();
  };
}
