/* Saved exclusion sets. A preset carries both the branch list and the
   clean-up options, so applying one restores the whole setup. */
import { byId, el, clear } from "../util/dom.js";
import { t } from "../i18n/index.js";
import { storageMode } from "../store/storage.js";
import { saveDb, upsertPreset, removePreset } from "../store/presets.js";
import { state, emit } from "../state.js";
import { showToast } from "./toast.js";
import { readOptions, applyOptionsToDom } from "./options.js";

export function applyPreset(preset, announce){
  state.excluded = new Set(preset.paths);
  applyOptionsToDom(preset.opts);
  state.db.lastId = preset.id;
  saveDb(state.db);
  emit("refresh");

  if(!announce) return;
  if(!state.records.length){
    showToast(t("toast.presetNoFile", { name: preset.name }));
    return;
  }
  const hit = preset.paths.filter(function(p){ return state.allPaths.has(p); }).length;
  showToast(t("toast.presetApplied", { name: preset.name, hit: hit, total: preset.paths.length }));
}

export function renderPresets(){
  const list = byId("plist");
  clear(list);

  state.db.presets.forEach(function(preset){
    const li = el("li", preset.id === state.db.lastId ? "active" : "");
    li.appendChild(el("span", "nm", preset.name));
    li.appendChild(el("span", "cnt", t("presets.count", { n: preset.paths.length })));

    const use = el("button", "btn ghost small", t("presets.apply"));
    use.onclick = function(){ applyPreset(preset, true); };
    li.appendChild(use);

    const del = el("button", "x", "×");
    del.setAttribute("aria-label", t("presets.delete", { name: preset.name }));
    del.onclick = function(){
      removePreset(state.db, preset.id);
      saveDb(state.db);
      renderPresets();
    };
    li.appendChild(del);

    list.appendChild(li);
  });

  byId("pEmpty").style.display = state.db.presets.length ? "none" : "";
  byId("storeNote").textContent = storageMode() === "memory" ? t("presets.memory") : "";
}

export function renderRecipe(){
  byId("recipe").value = Array.from(state.excluded).sort().join("\n");
}

export function mountPresets(){
  byId("savePreset").onclick = function(){
    const field = byId("presetName");
    const name = field.value.trim() || t("presets.fallbackName", { n: state.db.presets.length + 1 });
    const result = upsertPreset(
      state.db,
      name,
      Array.from(state.excluded).sort(),
      readOptions()
    );
    field.value = "";
    renderPresets();
    saveDb(state.db).then(function(ok){
      if(!ok){ showToast(t("toast.presetSession")); return; }
      showToast(t(result.replaced ? "toast.presetUpdated" : "toast.presetSaved", { name: name }));
    });
  };

  byId("applyRecipe").onclick = function(){
    const lines = byId("recipe").value
      .split(/[\n,]/)
      .map(function(s){ return s.trim(); })
      .filter(Boolean);
    state.excluded = new Set(lines);
    emit("refresh");
    showToast(t("toast.listApplied", { n: lines.length }));
  };
}
