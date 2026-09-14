/* Translation lookup and DOM application.
   Markup opts in with data-i18n / data-i18n-ph / data-i18n-title / data-i18n-aria. */
import { en } from "./en.js";
import { ru } from "./ru.js";

export const LOCALES = { en: en, ru: ru };
export const DEFAULT_LANG = "en";

let currentLang = DEFAULT_LANG;

export function getLang(){ return currentLang; }

export function setLang(lang){
  currentLang = LOCALES[lang] ? lang : DEFAULT_LANG;
  document.documentElement.lang = currentLang;
  applyI18n();
  return currentLang;
}

/* t("presets.count", { n: 12 }) -> "12 br." */
export function t(key, params){
  const dict = LOCALES[currentLang] || en;
  let s = dict[key] != null ? dict[key] : (en[key] != null ? en[key] : key);
  if(Array.isArray(s)) return s;          // string lists, e.g. help.body
  if(params){
    for(const k in params) s = s.split("{" + k + "}").join(String(params[k]));
  }
  return s;
}

export function applyI18n(root){
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach(function(el){
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-ph]").forEach(function(el){
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  scope.querySelectorAll("[data-i18n-title]").forEach(function(el){
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  scope.querySelectorAll("[data-i18n-aria]").forEach(function(el){
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}
