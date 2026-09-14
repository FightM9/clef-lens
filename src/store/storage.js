/* Key-value storage with three backends, picked in this order:
     widget  - window.storage, available when the page runs as a Claude artifact
     local   - window.localStorage, the normal case on GitHub Pages or file://
     memory  - private mode or a blocked origin; data lives until reload
   Every method returns a Promise so callers do not care which one won. */

let backend = null;
let memory = {};

function detect(){
  if(typeof window !== "undefined" && window.storage && typeof window.storage.get === "function"){
    return "widget";
  }
  try{
    const probe = "__probe" + Date.now();
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return "local";
  }catch(e){
    return "memory";
  }
}

export function storageMode(){
  if(backend === null) backend = detect();
  return backend;
}

export function readKey(key, fallback){
  const mode = storageMode();
  if(mode === "widget"){
    return Promise.resolve()
      .then(function(){ return window.storage.get(key, false); })
      .then(function(r){ return r && r.value ? JSON.parse(r.value) : fallback; })
      .catch(function(){ return memory[key] != null ? memory[key] : fallback; });
  }
  if(mode === "local"){
    try{
      const raw = window.localStorage.getItem(key);
      return Promise.resolve(raw ? JSON.parse(raw) : fallback);
    }catch(e){
      return Promise.resolve(memory[key] != null ? memory[key] : fallback);
    }
  }
  return Promise.resolve(memory[key] != null ? memory[key] : fallback);
}

export function writeKey(key, value){
  memory[key] = value;
  const mode = storageMode();
  if(mode === "widget"){
    return Promise.resolve()
      .then(function(){ return window.storage.set(key, JSON.stringify(value), false); })
      .then(function(){ return true; })
      .catch(function(){ backend = "memory"; return false; });
  }
  if(mode === "local"){
    try{
      window.localStorage.setItem(key, JSON.stringify(value));
      return Promise.resolve(true);
    }catch(e){
      backend = "memory";
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}
