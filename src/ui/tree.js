/* The field tree: one row per node, checkbox = keep, unchecked = drop.
   Unchecking a node removes its descendants from the exclusion set,
   because the parent already covers them. */
import { byId, el, clear } from "../util/dom.js";
import { t } from "../i18n/index.js";
import { nodeLabel, sampleText } from "../core/schema.js";
import { state, emit } from "../state.js";

function hasExcludedDescendant(node){
  let found = false;
  node.kids.forEach(function(kid){
    if(found) return;
    if(state.excluded.has(kid.path) || hasExcludedDescendant(kid)) found = true;
  });
  return found;
}

function treeMatches(node){
  if(!state.treeQuery) return true;
  if(node.path.toLowerCase().indexOf(state.treeQuery) !== -1) return true;
  let found = false;
  node.kids.forEach(function(kid){ if(!found && treeMatches(kid)) found = true; });
  return found;
}

function toggleNodeExclusion(node){
  if(state.excluded.has(node.path)){
    state.excluded.delete(node.path);
  }else{
    Array.from(state.excluded).forEach(function(p){
      if(p.indexOf(node.path + ".") === 0) state.excluded.delete(p);
    });
    state.excluded.add(node.path);
  }
  emit("refresh");
}

function renderNode(node, parentDropped){
  const selfDropped = state.excluded.has(node.path);
  const dropped = selfDropped || parentDropped;
  const wrap = el("div");

  const row = el("div", "row" + (selfDropped ? " dropped" : "") + (parentDropped ? " inherited" : ""));

  const isOpen = state.expanded.has(node.path) || !!state.treeQuery;
  const twisty = el("button", "twisty" + (node.kids.size ? "" : " leaf"), isOpen ? "▾" : "▸");
  twisty.setAttribute("aria-label", isOpen ? t("fields.collapse") : t("fields.expand"));
  twisty.onclick = function(){
    if(state.expanded.has(node.path)) state.expanded.delete(node.path);
    else state.expanded.add(node.path);
    emit("tree");
  };
  row.appendChild(twisty);

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = !dropped;
  box.disabled = parentDropped;
  box.indeterminate = !dropped && hasExcludedDescendant(node);
  box.title = node.path;
  box.onchange = function(){ toggleNodeExclusion(node); };
  row.appendChild(box);

  const body = el("div", "body");
  body.appendChild(el("span", "key", node.name + (node.isArray ? "[]" : "")));
  body.appendChild(el("span", "meta", nodeLabel(node, state.records.length)));
  const sample = sampleText(node);
  if(sample) body.appendChild(el("span", "val", sample));
  row.appendChild(body);

  wrap.appendChild(row);

  if(node.kids.size && isOpen){
    const kids = el("div", "kids");
    node.kids.forEach(function(kid){
      if(treeMatches(kid)) kids.appendChild(renderNode(kid, dropped));
    });
    wrap.appendChild(kids);
  }
  return wrap;
}

export function renderTree(){
  const host = byId("tree");
  clear(host);
  if(!state.root) return;

  let any = false;
  state.root.kids.forEach(function(kid){
    if(!treeMatches(kid)) return;
    any = true;
    host.appendChild(renderNode(kid, false));
  });
  if(!any) host.appendChild(el("div", "nomatch", t("fields.nomatch")));
}

export function mountTree(){
  byId("q").oninput = function(e){
    state.treeQuery = e.target.value.trim().toLowerCase();
    emit("tree");
  };
  byId("expandAll").onclick = function(){
    (function walk(node){
      node.kids.forEach(function(kid){
        if(kid.kids.size) state.expanded.add(kid.path);
        walk(kid);
      });
    })(state.root);
    emit("tree");
  };
  byId("collapseAll").onclick = function(){
    state.expanded = new Set();
    emit("tree");
  };
  byId("resetSel").onclick = function(){
    state.excluded = new Set();
    emit("refresh");
  };
}
