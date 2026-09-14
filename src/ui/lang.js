/* EN / RU switch in the header. */
import { byId } from "../util/dom.js";
import { getLang, setLang } from "../i18n/index.js";

export function syncLangButtons(){
  const current = getLang();
  ["langEn", "langRu"].forEach(function(id){
    const btn = byId(id);
    if(btn) btn.classList.toggle("on", btn.getAttribute("data-lang") === current);
  });
}

export function mountLang(onChange){
  ["langEn", "langRu"].forEach(function(id){
    const btn = byId(id);
    if(!btn) return;
    btn.onclick = function(){
      setLang(btn.getAttribute("data-lang"));
      syncLangButtons();
      onChange(getLang());
    };
  });
  syncLangButtons();
}
