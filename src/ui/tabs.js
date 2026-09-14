/* Tab strip shown once a file is loaded. */
import { byId } from "../util/dom.js";
import { state, emit } from "../state.js";

const PANELS = { events: "panelEvents", record: "panelRecord", export: "panelExport" };

export function setTab(name){
  if(!PANELS[name]) return;
  state.activeTab = name;

  Object.keys(PANELS).forEach(function(key){
    byId(PANELS[key]).classList.toggle("on", key === name);
  });
  Array.prototype.forEach.call(byId("tabs").querySelectorAll(".tab-btn"), function(btn){
    const active = btn.getAttribute("data-tab") === name;
    btn.classList.toggle("on", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  emit("refresh");
}

export function mountTabs(){
  Array.prototype.forEach.call(byId("tabs").querySelectorAll(".tab-btn"), function(btn){
    btn.onclick = function(){ setTab(btn.getAttribute("data-tab")); };
  });
}
