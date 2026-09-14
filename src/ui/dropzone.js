/* File picking, drag and drop, and the parse error line. */
import { byId } from "../util/dom.js";
import { t } from "../i18n/index.js";

export function showParseError(key){
  const node = byId("err");
  if(node) node.textContent = key ? t(key) : "";
}

export function showApp(){
  byId("dz").style.display = "none";
  byId("app").classList.add("on");
}

export function showDropzone(){
  byId("app").classList.remove("on");
  byId("dz").style.display = "";
  byId("fileTag").classList.add("hidden");
  byId("file").value = "";
}

export function setFileTag(text){
  const tag = byId("fileTag");
  tag.classList.remove("hidden");
  tag.textContent = text;
}

export function mountDropzone(onFile){
  const zone = byId("dz");
  const input = byId("file");

  byId("pick").onclick = function(){ input.click(); };
  input.onchange = function(e){
    if(e.target.files && e.target.files[0]) read(e.target.files[0]);
  };

  ["dragenter", "dragover"].forEach(function(ev){
    zone.addEventListener(ev, function(e){ e.preventDefault(); zone.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function(ev){
    zone.addEventListener(ev, function(e){ e.preventDefault(); zone.classList.remove("over"); });
  });
  zone.addEventListener("drop", function(e){
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if(file) read(file);
  });

  function read(file){
    const reader = new FileReader();
    reader.onload = function(){ onFile(String(reader.result), file.name); };
    reader.onerror = function(){ showParseError("err.read"); };
    reader.readAsText(file, "utf-8");
  }
}
