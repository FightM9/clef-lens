/* Preset records live in one storage key, together with the chosen language.
   A preset = { id, name, paths, opts, ts } */
import { readKey, writeKey } from "./storage.js";

export const DB_KEY = "clefLens:db";
const LEGACY_KEY = "reportFilter:db";   // pre-rename storage, read once

function blankDb(){ return { presets: [], lastId: null, lang: null, theme: null }; }

export function loadDb(){
  return readKey(DB_KEY, null).then(function(db){
    if(db && Array.isArray(db.presets)) return normalise(db);
    // Nothing under the current key: pick up presets saved before the rename.
    return readKey(LEGACY_KEY, null).then(function(legacy){
      return legacy && Array.isArray(legacy.presets) ? normalise(legacy) : blankDb();
    });
  });
}

function normalise(db){
  return {
    presets: db.presets,
    lastId: db.lastId || null,
    lang: db.lang || null,
    theme: db.theme || null
  };
}

export function saveDb(db){ return writeKey(DB_KEY, db); }

export function findPreset(db, id){
  return db.presets.filter(function(p){ return p.id === id; })[0] || null;
}

/* Saving under an existing name overwrites that preset. */
export function upsertPreset(db, name, paths, opts){
  const existing = db.presets.filter(function(p){ return p.name === name; })[0];
  const preset = {
    id: existing ? existing.id : String(Date.now()),
    name: name,
    paths: paths,
    opts: opts,
    ts: Date.now()
  };
  if(existing){
    db.presets = db.presets.map(function(p){ return p.id === existing.id ? preset : p; });
  }else{
    db.presets.push(preset);
  }
  db.lastId = preset.id;
  return { preset: preset, replaced: !!existing };
}

export function removePreset(db, id){
  db.presets = db.presets.filter(function(p){ return p.id !== id; });
  if(db.lastId === id) db.lastId = null;
}
